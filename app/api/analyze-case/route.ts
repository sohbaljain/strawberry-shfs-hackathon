import {
  ADVISORY_OUTPUT_LABEL,
  FICTIONAL_DATA_NOTICE,
  REPORT_WARNING,
  casePreparationStatuses,
  type AnalyzeCaseResponse,
  type CaseIntelligenceReport,
  type FictionalCaseInput,
  validateAnalysisReport,
  validateCaseInput,
} from "../../lib/caseflow-analysis";
import { createServerComponentClient } from "@/lib/supabase/server";
import { requestGeminiWithFallback, type GeminiResponse } from "@/lib/gemini-request";

type ValidationIssues = {
  invalidTopLevelFields: string[];
  missingTopLevelFields: string[];
  diagnostics?: GeminiResponseDiagnostics;
};

const analysisResponseSchema = {
  type: "object",
  properties: {
    neutralSummary: { type: "string" },
    timeline: {
      type: "array",
      items: {
        type: "object",
        properties: {
          stage: { type: "string" },
          observation: { type: "string" },
          source: { type: "string" },
        },
        required: ["stage", "observation", "source"],
      },
    },
    contradictions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: { type: "string" },
          accountA: { type: "string" },
          accountB: { type: "string" },
          observation: { type: "string" },
        },
        required: ["topic", "accountA", "accountB", "observation"],
      },
    },
    missingInformation: {
      type: "array",
      items: { type: "string" },
    },
    evidenceGaps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item: { type: "string" },
          reason: { type: "string" },
        },
        required: ["item", "reason"],
      },
    },
    forensicRequestReview: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item: { type: "string" },
          status: { type: "string" },
          note: { type: "string" },
        },
        required: ["item", "status", "note"],
      },
    },
    recommendedReviewPoints: {
      type: "array",
      items: {
        type: "object",
        properties: {
          reviewPoint: { type: "string" },
          rationale: { type: "string" },
        },
        required: ["reviewPoint", "rationale"],
      },
    },
    preparationStatus: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: casePreparationStatuses,
        },
        reasons: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["status", "reasons"],
    },
    advisoryLayerNotice: { type: "string" },
  },
  required: [
    "neutralSummary",
    "timeline",
    "contradictions",
    "missingInformation",
    "evidenceGaps",
    "forensicRequestReview",
    "recommendedReviewPoints",
    "preparationStatus",
    "advisoryLayerNotice",
  ],
} as const;

const requiredTopLevelFields = analysisResponseSchema.required;

type GeminiResponseDiagnostics = {
  candidateCount: number;
  finishReasons: string[];
  modelVersion?: string;
  promptBlocked: boolean;
  textLength: number;
};

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const input = validateCaseInput(payload);

  if (!input) {
    return Response.json(
      { error: "A complete fictional case intake packet is required for analysis." },
      { status: 400 },
    );
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
    .eq("id", input.caseId)
    .maybeSingle();

  if (caseError || !caseData?.id) {
    return Response.json(
      { error: "Case not found or access is not authorised." },
      { status: 404 },
    );
  }

  try {
    const { model, response: geminiResponse } = await requestGeminiWithFallback(
      buildGeminiBody(input),
    );
    const firstResult = validateGeminiAnalysisResponse(geminiResponse, model, "initial");

    if (firstResult.report) {
      const persisted = await persistCaseAnalysis(supabase, input.caseId, firstResult.report, model);

      if (!persisted.ok) {
        return Response.json(
          { error: "Analysis was generated but could not be persisted." },
          { status: 500 },
        );
      }

      return Response.json(
        buildSuccessResponse(input, firstResult.report, model, persisted.data),
      );
    }

    if (firstResult.parsed || firstResult.rawText) {
      const { model: repairModel, response: repairResponse } = await requestGeminiWithFallback(
        buildRepairGeminiBody(firstResult.parsed, firstResult.rawText, firstResult.issues),
      );
      const repairResult = validateGeminiAnalysisResponse(repairResponse, repairModel, "repair");

      if (repairResult.report) {
        const persisted = await persistCaseAnalysis(
          supabase,
          input.caseId,
          repairResult.report,
          repairModel,
        );

        if (!persisted.ok) {
          return Response.json(
            { error: "Analysis was generated but could not be persisted." },
            { status: 500 },
          );
        }

        return Response.json(
          buildSuccessResponse(input, repairResult.report, repairModel, persisted.data),
        );
      }
    }
  } catch (error) {
    console.error("Case analysis request failed:", {
      message: error instanceof Error ? error.message : "Gemini analysis failed.",
    });
  }

  return validationFailureResponse();
}

function buildSuccessResponse(
  input: FictionalCaseInput,
  report: CaseIntelligenceReport,
  model: string,
  persisted?: {
    analysisId?: string;
    verificationStatus?: string;
    version?: number;
  },
): AnalyzeCaseResponse {
  return {
    caseId: input.caseId,
    report,
    source: "gemini",
    generatedAt: new Date().toISOString(),
    notice: FICTIONAL_DATA_NOTICE,
    warning: REPORT_WARNING,
    advisoryOutputLabel: ADVISORY_OUTPUT_LABEL,
    model,
    modelUsed: model,
    analysisId: persisted?.analysisId,
    version: persisted?.version,
    verificationStatus: persisted?.verificationStatus,
  };
}

async function persistCaseAnalysis(
  supabase: Awaited<ReturnType<typeof createServerComponentClient>>,
  caseId: string,
  report: CaseIntelligenceReport,
  model: string,
) {
  const { data, error } = await supabase
    .schema("public")
    .rpc("save_case_analysis_version", {
      p_case_id: caseId,
      p_model: model,
      p_report: report,
      p_source: "gemini",
    });

  if (error) {
    console.error("Analysis persistence failed:", {
      caseId,
      code: error.code,
      details: error.details,
      message: error.message,
    });
    return { ok: false as const };
  }

  const row = toRecord(data);

  return {
    ok: true as const,
    data: {
      analysisId: asText(row?.id),
      verificationStatus: asText(row?.verification_status),
      version: toInteger(row?.version),
    },
  };
}

function toInteger(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function buildGeminiBody(input: FictionalCaseInput) {
  return {
    systemInstruction: {
      parts: [{ text: buildSystemInstruction() }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: buildPrompt(input) }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: analysisResponseSchema,
      temperature: 0.1,
      maxOutputTokens: 2400,
    },
  };
}

function buildRepairGeminiBody(
  parsed: unknown,
  rawText: string,
  issues: ValidationIssues,
) {
  const repairMaterial = parsed ? JSON.stringify(parsed) : rawText.slice(0, 6000);

  return {
    systemInstruction: {
      parts: [{ text: buildSystemInstruction() }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: buildRepairPrompt(repairMaterial, issues) }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: analysisResponseSchema,
      temperature: 0,
      maxOutputTokens: 2400,
    },
  };
}

function buildSystemInstruction() {
  return [
    "You are CaseFlow AI, an advisory assistant for a fictional demonstration case-intake workflow.",
    "Return JSON only for a Case Intelligence Report.",
    "Every required field must be present.",
    "Arrays may be empty but must exist.",
    "Do not rename keys.",
    "Use only the supplied fictional case packet. Do not invent facts, real identities, official records, or external procedure.",
    "Use neutral, careful language.",
    "Contradictions must be described as statement differences requiring human verification. Never claim that a person lied.",
    "Recommended review points may cover missing information, conflicting accounts, incomplete requests, unresolved tasks, and safe procedural review, but must not direct coercive or legal action.",
    "Do not decide guilt, innocence, arrest, bail, punishment, conviction, sentencing, prosecution readiness, or legal completeness.",
    "Do not accuse any officer of corruption.",
    "Preparation status is only an advisory Case Preparation Status, not an official legal conclusion.",
    "AI summaries, timelines, contradiction flags, and preparation assessments must remain separate from official records.",
    `Use exactly one preparationStatus.status value from this approved list: ${casePreparationStatuses.join(", ")}.`,
    "Return JSON with this exact structure: { \"neutralSummary\": \"string\", \"timeline\": [{ \"stage\": \"string\", \"observation\": \"string\", \"source\": \"string\" }], \"contradictions\": [{ \"topic\": \"string\", \"accountA\": \"string\", \"accountB\": \"string\", \"observation\": \"string\" }], \"missingInformation\": [\"string\"], \"evidenceGaps\": [{ \"item\": \"string\", \"reason\": \"string\" }], \"forensicRequestReview\": [{ \"item\": \"string\", \"status\": \"string\", \"note\": \"string\" }], \"recommendedReviewPoints\": [{ \"reviewPoint\": \"string\", \"rationale\": \"string\" }], \"preparationStatus\": { \"status\": \"string\", \"reasons\": [\"string\"] }, \"advisoryLayerNotice\": \"string\" }",
  ].join(" ");
}

function buildPrompt(input: FictionalCaseInput) {
  return `
Create a structured Case Intelligence Report for this fictional demonstration case packet.

Required output behavior:
- Return JSON only.
- Every required field must be present.
- Arrays may be empty but must exist.
- Do not rename keys.
- Use exactly one preparationStatus.status from: ${casePreparationStatuses.join(", ")}.
- Keep the report advisory and separate from submitted records.
- Clearly identify statement differences as requiring human verification.
- Use "These accounts differ and require human verification." where witness accounts conflict.
- Use "Case Preparation Status", not evidence-readiness status.
- Do not label any generated output as an FIR, charge sheet, final report, or official police document.

Fictional case packet:
${JSON.stringify(input, null, 2)}
`;
}

function buildRepairPrompt(repairMaterial: string, issues: ValidationIssues) {
  return `
Repair this already-generated advisory JSON so it matches the exact CaseFlow analysis schema.

Repair rules:
- Return JSON only.
- Every required field must be present.
- Arrays may be empty but must exist.
- Do not rename keys.
- Use exactly one preparationStatus.status from: ${casePreparationStatuses.join(", ")}.
- Keep all observations advisory and neutral.
- Do not add unsupported facts.
- Do not decide guilt, innocence, arrest, bail, punishment, conviction, or sentencing.
- Do not say a person lied.
- Use "These accounts differ and require human verification." for conflicting accounts.

Validation failure summary:
Missing top-level fields: ${issues.missingTopLevelFields.join(", ") || "none"}
Invalid top-level fields: ${issues.invalidTopLevelFields.join(", ") || "none"}

Invalid response to repair:
${repairMaterial}
`;
}

function validateGeminiAnalysisResponse(
  response: GeminiResponse,
  model: string,
  stage: "initial" | "repair",
) {
  const text = extractGeminiText(response);
  const parsed = parseReportJson(text);
  const normalized = normalizeAnalysisCandidate(parsed);
  const diagnostics = getGeminiResponseDiagnostics(response, text);

  if (!normalized) {
    const issues: ValidationIssues = {
      diagnostics,
      missingTopLevelFields: [...requiredTopLevelFields],
      invalidTopLevelFields: ["root"],
    };
    logValidationFailure(stage, model, issues);

    return {
      issues,
      parsed: null,
      rawText: text,
      report: null,
    };
  }

  const issues = getAnalysisValidationIssues(normalized, diagnostics);
  const report =
    issues.missingTopLevelFields.length === 0 && issues.invalidTopLevelFields.length === 0
      ? validateAnalysisReport(normalized)
      : null;

  if (!report) {
    const safeIssues =
      issues.missingTopLevelFields.length || issues.invalidTopLevelFields.length
        ? issues
        : {
            diagnostics,
            missingTopLevelFields: [],
            invalidTopLevelFields: ["safetyRules"],
          };

    logValidationFailure(stage, model, safeIssues);

    return {
      issues: safeIssues,
      parsed: normalized,
      rawText: text,
      report: null,
    };
  }

  return {
    issues,
    parsed: normalized,
    rawText: text,
    report,
  };
}

function getAnalysisValidationIssues(
  value: unknown,
  diagnostics?: GeminiResponseDiagnostics,
): ValidationIssues {
  const record = toRecord(value);

  if (!record) {
    return {
      diagnostics,
      missingTopLevelFields: [...requiredTopLevelFields],
      invalidTopLevelFields: ["root"],
    };
  }

  const missingTopLevelFields = requiredTopLevelFields.filter((field) => !(field in record));
  const invalidTopLevelFields = requiredTopLevelFields.filter(
    (field) => field in record && !isValidTopLevelField(field, record[field]),
  );

  return {
    diagnostics,
    invalidTopLevelFields,
    missingTopLevelFields,
  };
}

function normalizeAnalysisCandidate(value: unknown): unknown {
  if (typeof value === "string") {
    return parseReportJson(value);
  }

  if (Array.isArray(value) && value.length === 1) {
    return normalizeAnalysisCandidate(value[0]);
  }

  const record = toRecord(value);
  if (!record) return null;

  const wrappedReport =
    record.report ?? record.caseIntelligenceReport ?? record.caseIntelligence;

  if (wrappedReport) {
    return normalizeAnalysisCandidate(wrappedReport);
  }

  return record;
}

function isValidTopLevelField(field: string, value: unknown) {
  switch (field) {
    case "neutralSummary":
    case "advisoryLayerNotice":
      return Boolean(asText(value));
    case "timeline":
      return isObjectArray(value, ["stage", "observation", "source"]);
    case "contradictions":
      return isObjectArray(value, ["topic", "accountA", "accountB", "observation"]);
    case "missingInformation":
      return isStringArray(value);
    case "evidenceGaps":
      return isObjectArray(value, ["item", "reason"]);
    case "forensicRequestReview":
      return isObjectArray(value, ["item", "status", "note"]);
    case "recommendedReviewPoints":
      return isObjectArray(value, ["reviewPoint", "rationale"]);
    case "preparationStatus":
      return isValidPreparationStatus(value);
    default:
      return false;
  }
}

function isValidPreparationStatus(value: unknown) {
  const record = toRecord(value);
  if (!record) return false;

  return (
    casePreparationStatuses.includes(record.status as (typeof casePreparationStatuses)[number]) &&
    isStringArray(record.reasons)
  );
}

function isObjectArray(value: unknown, keys: string[]) {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      const record = toRecord(item);
      return Boolean(record) && keys.every((key) => Boolean(asText(record?.[key])));
    })
  );
}

function isStringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => Boolean(asText(item)));
}

function logValidationFailure(stage: string, model: string, issues: ValidationIssues) {
  console.error("[Gemini] analysis validation failed", {
    diagnostics: issues.diagnostics,
    invalidTopLevelFields: issues.invalidTopLevelFields,
    missingTopLevelFields: issues.missingTopLevelFields,
    model,
    stage,
  });
}

function validationFailureResponse() {
  return Response.json(
    {
      error: "Gemini returned a response that could not be safely validated.",
      retryable: true,
    },
    { status: 503 },
  );
}

function extractGeminiText(data: GeminiResponse) {
  for (const candidate of data.candidates || []) {
    const text = candidate.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (text) return text;
  }

  return "";
}

function parseReportJson(text: string) {
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);

    if (typeof parsed === "string") {
      return parseReportJson(parsed);
    }

    return parsed;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      const parsed = JSON.parse(match[0]);

      if (typeof parsed === "string") {
        return parseReportJson(parsed);
      }

      return parsed;
    } catch {
      return null;
    }
  }
}

function getGeminiResponseDiagnostics(
  response: GeminiResponse,
  text: string,
): GeminiResponseDiagnostics {
  return {
    candidateCount: response.candidates?.length ?? 0,
    finishReasons: Array.from(
      new Set(
        response.candidates
          ?.map((candidate) => candidate.finishReason)
          .filter((reason): reason is string => Boolean(reason)) ?? [],
      ),
    ),
    modelVersion: response.modelVersion,
    promptBlocked: Boolean(response.promptFeedback),
    textLength: text.length,
  };
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
