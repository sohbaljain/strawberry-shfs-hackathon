export type CitizenDemoStatus = "Submitted (demo)" | "Under review (demo)";

export type CitizenDemoContactPreference = "No contact" | "Email follow-up" | "Phone follow-up";

export type CitizenDemoCategory =
  | "Suspicious activity"
  | "Traffic concern"
  | "Public nuisance"
  | "Property concern"
  | "Women and child safety"
  | "Cyber concern"
  | "Other";

export type CitizenDemoReport = {
  id: string;
  reference: string;
  submittedAtIso: string;
  category: CitizenDemoCategory;
  approximateArea: string;
  description: string;
  contactPreference: CitizenDemoContactPreference;
  status: CitizenDemoStatus;
};

export type CreateCitizenDemoReportInput = {
  category: CitizenDemoCategory;
  approximateArea: string;
  description: string;
  contactPreference?: CitizenDemoContactPreference;
};

const storageKey = "caseflow:citizen-demo-reports:v1";

export function loadCitizenDemoReports(): CitizenDemoReport[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => parseReport(item))
      .filter((item): item is CitizenDemoReport => Boolean(item))
      .sort((a, b) => Date.parse(b.submittedAtIso) - Date.parse(a.submittedAtIso));
  } catch {
    return [];
  }
}

export function createCitizenDemoReport(input: CreateCitizenDemoReportInput): CitizenDemoReport {
  const reports = loadCitizenDemoReports();

  const report: CitizenDemoReport = {
    id: globalThis.crypto?.randomUUID?.() ?? `citizen-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
    reference: createUniqueReference(reports),
    submittedAtIso: new Date().toISOString(),
    category: input.category,
    approximateArea: input.approximateArea.trim(),
    description: input.description.trim(),
    contactPreference: input.contactPreference ?? "No contact",
    status: "Submitted (demo)",
  };

  saveCitizenDemoReports([report, ...reports]);
  return report;
}

export function findCitizenDemoReportById(reportId: string): CitizenDemoReport | null {
  return loadCitizenDemoReports().find((report) => report.id === reportId) ?? null;
}

export function clearCitizenDemoReports() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey);
}

function saveCitizenDemoReports(reports: CitizenDemoReport[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(reports));
}

function createUniqueReference(reports: CitizenDemoReport[]) {
  const used = new Set(reports.map((report) => report.reference));

  for (let attempts = 0; attempts < 100; attempts += 1) {
    const candidate = `CIT-DEMO-${randomDigits(6)}`;
    if (!used.has(candidate)) return candidate;
  }

  return `CIT-DEMO-${Date.now().toString().slice(-6)}`;
}

function randomDigits(length: number) {
  let result = "";
  for (let index = 0; index < length; index += 1) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
}

function parseReport(value: unknown): CitizenDemoReport | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;

  const id = text(row.id);
  const reference = text(row.reference);
  const submittedAtIso = text(row.submittedAtIso);
  const category = text(row.category) as CitizenDemoCategory;
  const approximateArea = text(row.approximateArea);
  const description = text(row.description);
  const contactPreference = text(row.contactPreference) as CitizenDemoContactPreference;
  const status = text(row.status) as CitizenDemoStatus;

  if (!id || !reference || !submittedAtIso || !category || !approximateArea || !description) {
    return null;
  }

  return {
    id,
    reference,
    submittedAtIso,
    category,
    approximateArea,
    description,
    contactPreference: contactPreference || "No contact",
    status: status || "Submitted (demo)",
  };
}

function text(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}
