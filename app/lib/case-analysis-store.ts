import {
  ADVISORY_OUTPUT_LABEL,
  FICTIONAL_DATA_NOTICE,
  REPORT_WARNING,
  sampleFictionalCase,
  validateAnalysisReport,
  validateCaseInput,
  type AnalyzeCaseResponse,
  type FictionalCaseInput,
} from "./caseflow-analysis";

export type DataRow = Record<string, unknown>;

export type SavedAnalysisVersion = {
  id: string;
  generatedAt: string;
  verificationStatus: string;
  version: number;
};

export type SavedAnalysisSelection = {
  response: AnalyzeCaseResponse;
  versions: SavedAnalysisVersion[];
};

export function readText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function readInteger(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function parseCaseInputFromCaseRow(
  caseRow: DataRow,
  caseId: string,
  caseReference?: string,
): FictionalCaseInput {
  const candidate =
    caseRow.case_input ??
    caseRow.caseInput ??
    caseRow.input_json ??
    caseRow.intake_json ??
    caseRow.case_packet;

  const parsedCandidate = parseRecordValue(candidate);
  const validated = validateCaseInput(parsedCandidate);

  if (validated) {
    return validated.caseId === caseId ? validated : { ...validated, caseId };
  }

  return {
    ...sampleFictionalCase,
    caseId,
    caseIdentification: {
      ...sampleFictionalCase.caseIdentification,
      fictionalCaseNumber: caseReference || caseId,
    },
    createdAt: new Date().toISOString(),
  };
}

export function selectSavedAnalysis(
  rows: DataRow[],
  caseId: string,
): SavedAnalysisSelection | null {
  const parsedRows = rows
    .map((row) => {
      const report = validateAnalysisReport(parseAnalysisPayload(row));
      if (!report) return null;

      const id = readText(row.id) || createSyntheticId(row);
      const version = readInteger(row.version);
      const generatedAt =
        readText(row.generated_at) ||
        readText(row.created_at) ||
        readText(row.updated_at) ||
        new Date().toISOString();
      const verificationStatus =
        readText(row.verification_status ?? row.review_status ?? row.status) || "Not reviewed";
      const source = readText(row.source).toLowerCase() === "gemini" ? "gemini" : "mock-fallback";
      const model = readText(row.model || row.model_used) || undefined;

      return {
        id,
        response: {
          caseId,
          report,
          source,
          generatedAt,
          notice: FICTIONAL_DATA_NOTICE,
          warning: REPORT_WARNING,
          advisoryOutputLabel: ADVISORY_OUTPUT_LABEL,
          model,
          modelUsed: model,
        } satisfies AnalyzeCaseResponse,
        version,
        verificationStatus,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (!parsedRows.length) {
    return null;
  }

  parsedRows.sort(compareSavedRows);

  return {
    response: parsedRows[0].response,
    versions: parsedRows.map((row) => ({
      id: row.id,
      version: row.version,
      generatedAt: row.response.generatedAt,
      verificationStatus: row.verificationStatus,
    })),
  };
}

function compareSavedRows(
  a: { response: AnalyzeCaseResponse; version: number },
  b: { response: AnalyzeCaseResponse; version: number },
) {
  if (a.version !== b.version) {
    return b.version - a.version;
  }

  const aTime = Date.parse(a.response.generatedAt);
  const bTime = Date.parse(b.response.generatedAt);

  if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
    return bTime - aTime;
  }

  return b.response.generatedAt.localeCompare(a.response.generatedAt);
}

function parseAnalysisPayload(row: DataRow) {
  const value =
    row.analysis_json ??
    row.structured_json ??
    row.structured_output ??
    row.analysis ??
    row.result ??
    row.report_json ??
    row.output ??
    row.response;

  return parseRecordValue(value);
}

function parseRecordValue(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function createSyntheticId(row: DataRow) {
  const version = readInteger(row.version);
  const generatedAt = readText(row.generated_at || row.created_at || row.updated_at);
  return `analysis-${version}-${generatedAt || "unknown"}`;
}
