import {
  ADVISORY_OUTPUT_LABEL,
  type AnalyzeCaseResponse,
  type FictionalCaseInput,
} from "./caseflow-analysis";

export type AdvisoryPdfMode = "advisory" | "summary";

const pageWidth = 612;
const pageHeight = 792;
const marginLeft = 54;
const firstBaseline = 748;
const lineHeight = 14;
const maxLineChars = 86;
const maxLinesPerPage = 48;

export function buildCaseFlowPdf(
  response: AnalyzeCaseResponse,
  mode: AdvisoryPdfMode,
  caseInput?: FictionalCaseInput | null,
) {
  const lines =
    mode === "summary"
      ? buildOnePageSummaryLines(response, caseInput)
      : buildAdvisoryReportLines(response, caseInput);

  return createSimplePdf(lines);
}

export function caseFlowPdfFileName(caseId: string, mode: AdvisoryPdfMode) {
  const suffix = mode === "summary" ? "one-page-summary" : "advisory-report";
  return `caseflow-${suffix}-${safeFilePart(caseId)}.pdf`;
}

function buildAdvisoryReportLines(
  response: AnalyzeCaseResponse,
  caseInput?: FictionalCaseInput | null,
) {
  const { report } = response;
  const caseLabel = caseInput ? caseInput.caseIdentification.fictionalCaseNumber : response.caseId;

  return compactLines([
    "CaseFlow AI Advisory Report",
    ADVISORY_OUTPUT_LABEL,
    `Case: ${caseLabel} (${response.caseId})`,
    `Generated: ${response.generatedAt}`,
    `Analysis source: ${response.source}`,
    "",
    "Safety warning",
    response.warning,
    "",
    "Neutral summary",
    report.neutralSummary,
    "",
    "Structured timeline",
    ...report.timeline.map((item, index) =>
      `${index + 1}. ${item.stage}: ${item.observation} Source: ${item.source}`,
    ),
    "",
    "Statement differences requiring human verification",
    ...report.contradictions.map((item, index) =>
      `${index + 1}. ${item.topic}: ${item.accountA} / ${item.accountB}. ${item.observation}`,
    ),
    "",
    "Missing information",
    ...report.missingInformation.map((item, index) => `${index + 1}. ${item}`),
    "",
    "Evidence gaps",
    ...report.evidenceGaps.map((item, index) => `${index + 1}. ${item.item}: ${item.reason}`),
    "",
    "Forensic request review",
    ...report.forensicRequestReview.map((item, index) =>
      `${index + 1}. ${item.item} (${item.status}): ${item.note}`,
    ),
    "",
    "AI-detected gaps and suggested review points requiring officer confirmation",
    ...report.recommendedReviewPoints.map((item, index) =>
      `${index + 1}. ${item.reviewPoint}: ${item.rationale}`,
    ),
    "",
    `Case Preparation Status: ${report.preparationStatus.status}`,
    ...report.preparationStatus.reasons.map((item, index) => `${index + 1}. ${item}`),
    "",
    "Advisory layer separation",
    report.advisoryLayerNotice,
    "",
    "This generated file is not an FIR, charge sheet, final report, or official police document.",
  ]);
}

function buildOnePageSummaryLines(
  response: AnalyzeCaseResponse,
  caseInput?: FictionalCaseInput | null,
) {
  const { report } = response;
  const caseLabel = caseInput ? caseInput.caseIdentification.fictionalCaseNumber : response.caseId;

  return compactLines([
    "CaseFlow AI One-Page Advisory Summary",
    ADVISORY_OUTPUT_LABEL,
    `Case: ${caseLabel} (${response.caseId})`,
    `Generated: ${response.generatedAt}`,
    "",
    "Safety warning",
    response.warning,
    "",
    "Neutral summary",
    report.neutralSummary,
    "",
    `Case Preparation Status: ${report.preparationStatus.status}`,
    ...report.preparationStatus.reasons.slice(0, 3).map((item, index) => `${index + 1}. ${item}`),
    "",
    "Priority review points",
    ...report.recommendedReviewPoints
      .slice(0, 4)
      .map((item, index) => `${index + 1}. ${item.reviewPoint}: ${item.rationale}`),
    "",
    "Statement differences",
    ...report.contradictions
      .slice(0, 3)
      .map((item, index) => `${index + 1}. ${item.topic}: ${item.observation}`),
    "",
    "This summary is advisory only and is not an official police document.",
  ]);
}

function createSimplePdf(lines: string[]) {
  const wrappedLines = lines.flatMap((line) => wrapLine(line, maxLineChars));
  const pages = chunkLines(wrappedLines, maxLinesPerPage);

  const objects: string[] = [];
  const pageObjectIds = pages.map((_, index) => 3 + index * 2);
  const kids = pageObjectIds.map((id) => `${id} 0 R`).join(" ");

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [ ${kids} ] >>`;

  pages.forEach((pageLines, index) => {
    const pageObjectId = 3 + index * 2;
    const contentObjectId = pageObjectId + 1;
    const content = buildPageContent(pageLines);

    objects[pageObjectId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
      `/Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> ` +
      `/Contents ${contentObjectId} 0 R >>`;
    objects[contentObjectId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;

  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

function buildPageContent(lines: string[]) {
  const textLines = lines.map((line, index) => {
    const fontSize = index === 0 ? 15 : 10;
    const leading = index === 0 ? 18 : lineHeight;
    return `/F1 ${fontSize} Tf ${leading} TL (${escapePdfText(line)}) Tj T*`;
  });

  return `BT\n${marginLeft} ${firstBaseline} Td\n${textLines.join("\n")}\nET`;
}

function wrapLine(line: string, maxChars: number) {
  const clean = sanitizePdfText(line);
  if (!clean) return [""];

  const words = clean.split(/\s+/);
  const output: string[] = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      return;
    }

    if (current) output.push(current);
    current = word.length > maxChars ? word.slice(0, maxChars) : word;
  });

  if (current) output.push(current);
  return output;
}

function chunkLines(lines: string[], size: number) {
  const chunks: string[][] = [];
  for (let index = 0; index < lines.length; index += size) {
    chunks.push(lines.slice(index, index + size));
  }
  return chunks.length ? chunks : [[""]];
}

function compactLines(lines: string[]) {
  return lines.map((line) => line.trim());
}

function sanitizePdfText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfText(value: string) {
  return sanitizePdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function safeFilePart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/(^-|-$)/g, "") || "case";
}
