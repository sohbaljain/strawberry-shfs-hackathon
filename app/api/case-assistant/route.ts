import {
  CASE_ASSISTANT_UNAVAILABLE_MESSAGE,
  type CaseAssistantRequest,
  type CaseAssistantResponse,
  type CaseIntelligenceReport,
  type FictionalCaseInput,
  validateAnalysisReport,
  validateCaseInput,
} from "../../lib/caseflow-analysis";
import { createServerComponentClient } from "@/lib/supabase/server";
import { isSupportedLanguageCode, type SupportedLanguageCode } from "@/lib/i18n/config";
import { requestGeminiWithFallback, type GeminiResponse } from "@/lib/gemini-request";

type RequestValidationResult =
  | {
      ok: true;
      request: CaseAssistantRequest;
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

const questionLimit = 700;
const historyLimit = 12;
const historyMessageLimit = 900;
const answerLimit = 1800;

const assistantResponseSchema = {
  type: "object",
  properties: {
    answer: { type: "string" },
    sources: {
      type: "array",
      items: { type: "string" },
    },
    limitations: {
      type: "array",
      items: { type: "string" },
    },
    requiresHumanVerification: { type: "boolean" },
  },
  required: ["answer", "sources", "limitations", "requiresHumanVerification"],
} as const;

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const validation = validateAssistantRequest(payload);

  if (!validation.ok) {
    return Response.json({ error: validation.error }, { status: validation.status });
  }

  const supabase = await createServerComponentClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data: caseData, error: caseError } = await supabase
    .schema("public")
    .from("cases")
    .select("id")
    .eq("id", validation.request.caseId)
    .maybeSingle();

  if (caseError || !caseData?.id) {
    return Response.json(
      { error: "Case not found or access is not authorised." },
      { status: 404 },
    );
  }

  try {
    const { model, response } = await requestGeminiWithFallback(
      buildGeminiBody(validation.request),
    );
    const text = extractGeminiText(response);
    const parsed = parseReportJson(text);
    const answer = validateAssistantResponse(
      parsed,
      buildAllowedSources(validation.request.caseInput, validation.request.analysisReport),
    );

    if (!answer) {
      console.error("Case assistant rejected invalid model output.");
      return Response.json({ error: CASE_ASSISTANT_UNAVAILABLE_MESSAGE }, { status: 502 });
    }

    return Response.json({ ...answer, model });
  } catch (error) {
    console.error("Case assistant request failed:", {
      message: error instanceof Error ? error.message : "Unknown assistant error",
    });
    return Response.json(
      {
        error: "Gemini is temporarily unavailable.",
        retryable: true,
      },
      { status: 503 },
    );
  }
}

function validateAssistantRequest(value: unknown): RequestValidationResult {
  const record = toRecord(value);
  if (!record) {
    return { ok: false, error: "Request body must be an object.", status: 400 };
  }

  const caseId = asText(record.caseId);
  const question = asText(record.question);
  const caseInput = validateCaseInput(record.caseInput);
  const analysisReport = validateAnalysisReport(record.analysisReport);
  const uiLanguage = parseUiLanguage(record.uiLanguage);

  if (!caseId || caseId.length > 80) {
    return { ok: false, error: "A valid case ID is required.", status: 400 };
  }

  if (!question || question.length > questionLimit) {
    return {
      ok: false,
      error: `Question must be between 1 and ${questionLimit} characters.`,
      status: 400,
    };
  }

  if (!caseInput || caseInput.caseId !== caseId) {
    return {
      ok: false,
      error: "The current case packet is missing or does not match the case ID.",
      status: 400,
    };
  }

  if (!analysisReport) {
    return { ok: false, error: "A validated case intelligence report is required.", status: 400 };
  }

  const history = parseHistory(record.history);

  return {
    ok: true,
    request: {
      caseId,
      question,
      caseInput,
      analysisReport,
      uiLanguage,
      history,
    },
  };
}

function parseHistory(value: unknown): CaseAssistantRequest["history"] {
  if (!Array.isArray(value)) return [];

  return value
    .slice(-historyLimit)
    .map((item) => {
      const record = toRecord(item);
      const role = record?.role === "user" || record?.role === "assistant" ? record.role : null;
      const content = asText(record?.content).slice(0, historyMessageLimit);

      return role && content ? { role, content } : null;
    })
    .filter((item): item is CaseAssistantRequest["history"][number] => Boolean(item));
}

function buildGeminiBody(request: CaseAssistantRequest) {
  return {
    systemInstruction: {
      parts: [{ text: buildSystemInstruction() }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: buildPrompt(request) }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: assistantResponseSchema,
      temperature: 0.1,
      maxOutputTokens: 1600,
    },
  };
}

function buildSystemInstruction() {
  return [
    "You are the CaseFlow AI Case Assistant.",
    "You answer questions only about the single fictional case supplied in the current request.",
    "Treat the supplied fictional case packet and validated Case Intelligence Report as the complete source of truth.",
    "Do not add facts, speculate, or rely on unrelated knowledge.",
    'If the answer is not supported by the supplied material, say: "The submitted case material does not provide enough information to answer that."',
    "Use neutral, factual, explainable language.",
    "You may explain the case timeline, summarise submitted information, identify differences between records, describe missing information, explain evidence gaps, explain forensic dependencies, explain preparation-status reasons, suggest safe procedural verification or documentation steps, and identify areas requiring authorised human review.",
    "You must never determine guilt or innocence.",
    "You must never recommend arrest, bail, punishment, conviction, or sentencing.",
    "You must never claim a person is lying, accuse an officer of corruption, label a person as suspicious, create a guilt, danger, corruption, or crime-prediction score, invent evidence or events, or treat AI observations as official police records.",
    'When accounts differ, use: "These accounts differ and require human verification."',
    'When discussing areas needing human attention, use: "This area may require authorised review."',
    "Every response is advisory and requires verification by an authorised officer.",
    "Return valid JSON only in this structure: { \"answer\": \"string\", \"sources\": [\"string\"], \"limitations\": [\"string\"], \"requiresHumanVerification\": true }",
  ].join(" ");
}

function buildPrompt(request: CaseAssistantRequest) {
  const allowedSources = buildAllowedSources(request.caseInput, request.analysisReport);
  const responseLanguage = request.uiLanguage ? languageDisplayName(request.uiLanguage) : "English";

  return `
Answer the officer's question using only the supplied fictional case material.
Respond in ${responseLanguage}, unless the user explicitly asked for another language.

Allowed source labels:
${allowedSources.map((source) => `- ${source}`).join("\n")}

Conversation history for this case only:
${request.history.map((message) => `${message.role}: ${message.content}`).join("\n") || "No previous messages."}

Officer question:
${request.question}

Current fictional case input:
${JSON.stringify(request.caseInput, null, 2)}

Validated Case Intelligence Report:
${JSON.stringify(request.analysisReport, null, 2)}
`;
}

function parseUiLanguage(value: unknown): SupportedLanguageCode | undefined {
  return isSupportedLanguageCode(value) ? value : undefined;
}

function languageDisplayName(language: SupportedLanguageCode) {
  switch (language) {
    case "as":
      return "Assamese";
    case "bn":
      return "Bengali";
    case "brx":
      return "Bodo";
    case "doi":
      return "Dogri";
    case "gu":
      return "Gujarati";
    case "hi":
      return "Hindi";
    case "kn":
      return "Kannada";
    case "kok":
      return "Konkani";
    case "ks":
      return "Kashmiri";
    case "mai":
      return "Maithili";
    case "ml":
      return "Malayalam";
    case "mni":
      return "Meitei";
    case "mr":
      return "Marathi";
    case "ne":
      return "Nepali";
    case "or":
      return "Oriya";
    case "pa":
      return "Punjabi";
    case "sa":
      return "Sanskrit";
    case "sat":
      return "Santali";
    case "sd":
      return "Sindhi";
    case "ta":
      return "Tamil";
    case "te":
      return "Telugu";
    case "ur":
      return "Urdu";
    case "en":
    default:
      return "English";
  }
}

function validateAssistantResponse(
  value: unknown,
  allowedSources: string[],
): CaseAssistantResponse | null {
  const record = toRecord(value);
  if (!record) return null;

  const answer = asText(record.answer).slice(0, answerLimit);
  const sources = parseStringList(record.sources)
    .filter((source) => allowedSources.includes(source))
    .slice(0, 8);
  const limitations = parseStringList(record.limitations).slice(0, 5);

  if (
    !answer ||
    record.requiresHumanVerification !== true ||
    sources.length === 0 ||
    hasUnsafeAssistantLanguage(answer) ||
    sources.some(hasUnsafeAssistantLanguage) ||
    limitations.some(hasUnsafeAssistantLanguage)
  ) {
    return null;
  }

  return {
    answer,
    sources,
    limitations:
      limitations.length > 0
        ? limitations
        : ["All observations require verification against the case record."],
    requiresHumanVerification: true,
  };
}

function buildAllowedSources(input: FictionalCaseInput, report: CaseIntelligenceReport) {
  const sources = [
    "Case identification",
    "Occurrence details",
    "Case narrative",
    "Incident summary",
    "Detailed case contents",
    input.caseNarrative.delayReason ? "Delay reason" : "",
    "Complainant or informant summary",
    "Known or unknown person details",
    ...input.people.witnesses.map((_, index) => `Witness ${index + 1} statement`),
    "Physical evidence",
    "Digital evidence",
    "Property involved",
    "Investigation updates",
    "Chain-of-custody notes",
    "Forensic request details",
    ...input.evidence.electronicEvidenceRecords.map((_, index) =>
      index === 0 ? "Electronic evidence record" : `Electronic evidence record ${index + 1}`,
    ),
    report.neutralSummary ? "Neutral summary" : "",
    report.timeline.length ? "Structured timeline" : "",
    report.contradictions.length ? "Statement differences" : "",
    report.missingInformation.length ? "Missing information" : "",
    report.evidenceGaps.length ? "Evidence gaps" : "",
    report.forensicRequestReview.length ? "Forensic request review" : "",
    report.recommendedReviewPoints.length ? "Recommended review points" : "",
    report.preparationStatus.reasons.length ? "Preparation-status reasons" : "",
    report.advisoryLayerNotice ? "Advisory layer notice" : "",
  ];

  return Array.from(new Set(sources.filter(Boolean)));
}

function extractGeminiText(data: GeminiResponse) {
  return (
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim() || ""
  );
}

function parseReportJson(text: string) {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function parseStringList(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => asText(item))
    .filter(Boolean)
    .slice(0, 12);
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hasUnsafeAssistantLanguage(value: string) {
  const text = value.toLowerCase();
  const unsafePatterns = [
    /\bguilty\b/,
    /\binnocent\b/,
    /\barrest\b/,
    /\bbail\b/,
    /\bpunishment\b/,
    /\bconviction\b/,
    /\bsentencing\b/,
    /\bcoercive action\b/,
    /\blying\b/,
    /\blied\b/,
    /\bcorrupt\b/,
    /\bsuspicious\b/,
    /\bguilt score\b/,
    /\brisk score\b/,
    /\bcrime prediction\b/,
    /\bdanger score\b/,
  ];

  return unsafePatterns.some((pattern) => pattern.test(text));
}
