import { casePreparationStatuses, type CasePreparationStatus } from "./caseflow-analysis";
import { isSupervisoryPostingRoleCode } from "./supervisory-scope";

export type DataRow = Record<string, unknown>;

export type PreparationStatusResult = {
  reasons: string[];
  status: CasePreparationStatus;
};

export function isActivePosting(row: DataRow, now = Date.now()): boolean {
  const isActiveFlag = row.is_active === true || row.active === true;
  if (!isActiveFlag) return false;

  const validFrom = parseDate(row.valid_from ?? row.starts_at ?? row.created_at);
  const validUntil = parseDate(row.valid_until ?? row.ends_at ?? row.expires_at);

  if (!validFrom) return false;
  if (validFrom.valueOf() > now) return false;
  if (validUntil && validUntil.valueOf() <= now) return false;

  return true;
}

export function selectActivePosting(rows: DataRow[], now = Date.now()): DataRow | null {
  const candidates = rows
    .filter((row) => isActivePosting(row, now))
    .slice()
    .sort((a, b) => {
      const aPrimary = a.is_primary === true ? 1 : 0;
      const bPrimary = b.is_primary === true ? 1 : 0;
      if (aPrimary !== bPrimary) return bPrimary - aPrimary;

      const aValidFrom = rowEpoch(a, ["valid_from"]);
      const bValidFrom = rowEpoch(b, ["valid_from"]);
      return bValidFrom - aValidFrom;
    });

  return candidates[0] ?? null;
}

export function postingRoleCode(row: DataRow | null | undefined): string {
  return normaliseText(
    asText(row?.role_code ?? row?.role ?? row?.posting_role ?? row?.designation),
  );
}

export function isSupervisoryRoleCode(roleCode: string): boolean {
  return isSupervisoryPostingRoleCode(normaliseText(roleCode));
}

export function toRows(value: unknown): DataRow[] {
  return Array.isArray(value) ? (value as DataRow[]) : [];
}

export function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const text = asText(value).replace("%", "");
  if (!text) return null;

  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normaliseText(value: string): string {
  return value.trim().toLowerCase();
}

export function toTitleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function parseDate(value: unknown): Date | null {
  const text = asText(value);
  if (!text) return null;

  const date = new Date(text);
  const looksLikeDate = Number.isFinite(date.valueOf()) && /\d{4}-\d{2}-\d{2}|T\d{2}:/.test(text);

  return looksLikeDate ? date : null;
}

export function rowEpoch(row: DataRow, fields?: string[]): number {
  const candidateFields =
    fields ??
    [
      "created_at",
      "updated_at",
      "submitted_at",
      "requested_at",
      "occurred_at",
      "event_at",
      "timestamp",
    ];

  for (const field of candidateFields) {
    const date = parseDate(row[field]);
    if (date) return date.valueOf();
  }

  return 0;
}

export function formatDateOrText(value: unknown): string {
  const text = asText(value);
  if (!text) return "Not available";

  const date = parseDate(text);
  if (!date) return text;

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatRelativeTime(epoch: number, now = Date.now()): string {
  if (!epoch) return "Not available";

  const deltaMs = Math.max(0, now - epoch);
  const minutes = Math.floor(deltaMs / (60 * 1000));

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return formatDateOrText(new Date(epoch).toISOString());
}

export function formatWaitTime(epoch: number, now = Date.now()): string {
  if (!epoch) return "Waiting time not available";

  const ageMs = Math.max(0, now - epoch);
  const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ageMs / (60 * 60 * 1000)) % 24);

  if (days > 0) return `${days}d ${hours}h`;

  const minutes = Math.floor((ageMs / (60 * 1000)) % 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function caseIdFromRow(row: DataRow | undefined): string {
  return asText(row?.case_id ?? row?.id ?? row?.caseId);
}

export function caseReferenceFromCase(row: DataRow | undefined): string {
  return asText(
    row?.case_reference ?? row?.caseReference ?? row?.reference ?? row?.fictional_case_number,
  );
}

export function caseTitleFromCase(row: DataRow | undefined): string {
  return asText(row?.title ?? row?.case_title ?? row?.caseTitle);
}

export function caseStatusFromCase(row: DataRow | undefined): string {
  return toTitleCase(asText(row?.status ?? row?.case_status) || "Open");
}

export function casePriorityFromCase(row: DataRow | undefined): "High" | "Medium" | "Low" {
  const value = normaliseText(asText(row?.priority ?? row?.priority_level));
  if (value.includes("high") || value.includes("urgent") || value.includes("critical")) return "High";
  if (value.includes("medium")) return "Medium";
  return "Low";
}

export function evidencePercentFromCase(row: DataRow | undefined): number | null {
  const value = asNumber(
    row?.evidence_completeness ??
      row?.evidenceCompleteness ??
      row?.evidence_readiness ??
      row?.preparation_progress,
  );

  if (value === null) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function isClosedStatus(value: string): boolean {
  const text = normaliseText(value);
  return text.includes("closed") || text.includes("resolved") || text.includes("complete");
}

export function isActionCompleted(value: string): boolean {
  const text = normaliseText(value);
  return text.includes("completed") || text.includes("closed") || text.includes("resolved") || text.includes("done");
}

export function dueEpochFromAction(row: DataRow): number {
  return rowEpoch(row, ["due_at", "due_date", "deadline"]);
}

export function isOverdueAction(row: DataRow, now = Date.now()): boolean {
  const status = asText(row.status ?? row.action_status);
  if (isActionCompleted(status)) return false;

  const dueEpoch = dueEpochFromAction(row);
  return dueEpoch > 0 && dueEpoch < now;
}

export function isPendingForensicStatus(row: DataRow): boolean {
  const status = normaliseText(asText(row.status ?? row.request_status));
  if (!status) return false;

  const resolved =
    status.includes("completed") ||
    status.includes("rejected") ||
    status.includes("cancelled") ||
    status.includes("canceled") ||
    status.includes("closed");

  if (resolved) return false;

  return (
    status.includes("pending") ||
    status.includes("submitted") ||
    status.includes("awaiting") ||
    status.includes("queued") ||
    status.includes("in progress") ||
    status.includes("processing") ||
    status.includes("active")
  );
}

export function forensicDisciplineLabel(value: unknown): string {
  const text = asText(value);
  if (!text) return "Forensic unit";

  const key = normaliseText(text);
  const labels: Record<string, string> = {
    ballistics: "Ballistics",
    cctv_analysis: "CCTV Analysis",
    digital_forensics: "Digital Forensics",
    document_examination: "Document Examination",
    fingerprint: "Fingerprint",
    fingerprints: "Fingerprint",
    toxicology: "Toxicology",
    serology: "Serology",
    dna: "DNA Analysis",
  };

  return labels[key] ?? toTitleCase(text);
}

export function isActiveAssignment(row: DataRow, now = Date.now()): boolean {
  const status = normaliseText(asText(row.status ?? row.assignment_status));
  const activeFlag = row.active === true || row.is_active === true || status === "active";
  if (status && (status.includes("inactive") || status.includes("ended") || status.includes("closed"))) {
    return false;
  }

  const startsAt = parseDate(row.starts_at ?? row.assigned_at ?? row.valid_from);
  const endsAt = parseDate(row.ends_at ?? row.valid_until ?? row.unassigned_at);

  if (startsAt && startsAt.valueOf() > now) return false;
  if (endsAt && endsAt.valueOf() < now) return false;

  return activeFlag || (!status && !endsAt);
}

export function belongsToOfficer(row: DataRow, userId: string): boolean {
  const ownerColumns = [
    row.user_id,
    row.auth_user_id,
    row.assigned_user_id,
    row.assigned_to_user_id,
    row.officer_id,
    row.assigned_to,
    row.owner_id,
    row.profile_id,
  ]
    .map(asText)
    .filter(Boolean);

  if (!ownerColumns.length) return true;
  return ownerColumns.includes(userId);
}

export function preparationStatusFromCaseContext({
  analyses,
  caseRow,
  evidencePercent,
  hasBlockedActions,
  hasOverdueActions,
  hasPendingForensics,
  now = Date.now(),
  recentActivityEpoch,
}: {
  analyses: DataRow[];
  caseRow: DataRow;
  evidencePercent: number | null;
  hasBlockedActions: boolean;
  hasOverdueActions: boolean;
  hasPendingForensics: boolean;
  now?: number;
  recentActivityEpoch?: number;
}): PreparationStatusResult {
  const explicit = normalisePreparationStatus(
    asText(caseRow.case_preparation_status ?? caseRow.preparation_status ?? caseRow.preparationStatus),
  );
  if (explicit) return { status: explicit, reasons: ["Derived from case preparation status field."] };

  const latestAnalysis = analyses
    .slice()
    .sort((a, b) => rowEpoch(b) - rowEpoch(a))[0];
  const analysisStatus = normalisePreparationStatus(
    asText(
      latestAnalysis?.preparation_status ??
        latestAnalysis?.case_preparation_status ??
        latestAnalysis?.status,
    ),
  );

  if (analysisStatus) {
    return { status: analysisStatus, reasons: ["Derived from latest case analysis record."] };
  }

  const reasons: string[] = [];

  if (hasBlockedActions) reasons.push("Blocked operational actions are present.");
  if (hasOverdueActions) reasons.push("One or more active actions are overdue.");
  if (hasPendingForensics) reasons.push("Forensic dependencies are awaiting response.");

  if (evidencePercent !== null && evidencePercent < 40) {
    return {
      status: "Missing critical information",
      reasons: [...reasons, "Evidence completeness is below the critical threshold."],
    };
  }

  if (hasPendingForensics) {
    return { status: "Awaiting forensic material", reasons };
  }

  if (hasBlockedActions || hasOverdueActions) {
    return { status: "Needs clarification", reasons };
  }

  const noRecentActivity = Boolean(recentActivityEpoch) && now - (recentActivityEpoch ?? 0) > 14 * 24 * 60 * 60 * 1000;
  if (evidencePercent === null || evidencePercent < 75 || noRecentActivity) {
    return {
      status: "Information incomplete",
      reasons: [...reasons, "Information coverage is incomplete for review readiness."],
    };
  }

  return {
    status: "Ready for review",
    reasons: reasons.length ? reasons : ["No blocking dependencies detected."],
  };
}

export function normalisePreparationStatus(value: string): CasePreparationStatus | null {
  const text = normaliseText(value);
  const mapped = casePreparationStatuses.find((status) => normaliseText(status) === text);
  if (mapped) return mapped;

  if (text.includes("ready")) return "Ready for review";
  if (text.includes("clarification")) return "Needs clarification";
  if (text.includes("critical")) return "Missing critical information";
  if (text.includes("forensic")) return "Awaiting forensic material";
  if (text) return "Information incomplete";
  return null;
}

export function attentionReasons({
  evidencePercent,
  hasBlockedActions,
  hasOverdueActions,
  hasPendingForensics,
  noRecentActivity,
  preparationStatus,
}: {
  evidencePercent: number | null;
  hasBlockedActions: boolean;
  hasOverdueActions: boolean;
  hasPendingForensics: boolean;
  noRecentActivity: boolean;
  preparationStatus: CasePreparationStatus;
}): string[] {
  const reasons: string[] = [];

  if (hasOverdueActions) reasons.push("overdue action");
  if (hasBlockedActions) reasons.push("blocked action");
  if (evidencePercent !== null && evidencePercent < 70) reasons.push("low completeness");
  if (preparationStatus === "Missing critical information") reasons.push("missing critical information");
  if (preparationStatus === "Needs clarification") reasons.push("awaiting information");
  if (hasPendingForensics) reasons.push("awaiting forensic response");
  if (noRecentActivity) reasons.push("no recent activity");

  return reasons;
}

export function priorityRank(caseRow: DataRow, context: {
  blockedActionCount: number;
  evidencePercent: number | null;
  hasMissingCriticalInformation: boolean;
  overdueActionCount: number;
  recentActivityEpoch: number;
}) {
  const priorityWeight = casePriorityFromCase(caseRow) === "High" ? 3 : casePriorityFromCase(caseRow) === "Medium" ? 2 : 1;

  return [
    priorityWeight,
    context.overdueActionCount,
    context.blockedActionCount,
    Number(context.hasMissingCriticalInformation),
    Number(context.evidencePercent !== null && context.evidencePercent < 70),
    context.recentActivityEpoch,
  ] as const;
}

export function comparePriorityRanks(
  a: readonly [number, number, number, number, number, number],
  b: readonly [number, number, number, number, number, number],
): number {
  if (a[0] !== b[0]) return b[0] - a[0];
  if (a[1] !== b[1]) return b[1] - a[1];
  if (a[2] !== b[2]) return b[2] - a[2];
  if (a[3] !== b[3]) return b[3] - a[3];
  if (a[4] !== b[4]) return b[4] - a[4];
  return a[5] - b[5];
}
