import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon, PageContainer } from "../../components/app-shell";
import {
  ActivityTimeline,
  CaseProgressChart,
  type DashboardMetric,
  EvidenceProgressCard,
  type EvidenceProgressItem,
  ForensicQueueCard,
  type ForensicQueueItem,
  MetricCard,
  type PriorityCase,
  PriorityCaseTable,
  QuickActionsPanel,
  ResolutionRateCard,
  StatusDistributionChart,
} from "../../components/dashboard-components";
import { createServerComponentClient } from "@/lib/supabase/server";

type DataRow = Record<string, unknown>;

type DashboardData = {
  activityItems: Array<{
    detail: string;
    time: string;
    title: string;
    tone: "green" | "purple" | "amber" | "red";
  }>;
  forensicQueue: ForensicQueueItem[];
  metrics: DashboardMetric[];
  preparationCompleteness: EvidenceProgressItem[];
  priorityCases: PriorityCase[];
  startAnalysisHref: string;
  awaitingForensicCount: number;
  loadFailed: boolean;
};

export default async function DashboardPage() {
  const supabase = await createServerComponentClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    redirect("/login");
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const dashboardData = await loadDashboardData(supabase, userId);

  return (
    <PageContainer
      eyebrow="Officer operations"
      title="Investigating Officer Dashboard"
      description="Track assigned investigations, forensic waits, case preparation status, and recent action movement from one workspace."
      actions={
        <Link className="button button-primary app-primary-action" href="/cases/new">
          <Icon name="plus" />
          Create Case
        </Link>
      }
    >
      {dashboardData.loadFailed ? (
        <section className="dashboard-card cases-state" role="status">
          <Icon name="alert" />
          <strong>Unable to load the authorised dashboard data.</strong>
        </section>
      ) : null}

      <section className="dashboard-metric-grid" aria-label="Dashboard metrics">
        {dashboardData.metrics.map((stat, index) => (
          <MetricCard
            comparison={stat.comparison}
            direction={stat.direction}
            icon={stat.icon}
            key={stat.label}
            label={stat.label}
            sparkline={stat.sparkline}
            trend={stat.trend}
            value={stat.value}
            tone={stat.tone}
            delay={index * 80}
          />
        ))}
      </section>

      <section className="dashboard-analytics-grid">
        <CaseProgressChart illustrativeOnly />
        <StatusDistributionChart illustrativeOnly />
        <ResolutionRateCard />
        <EvidenceProgressCard items={dashboardData.preparationCompleteness} />
        <ForensicQueueCard items={dashboardData.forensicQueue} pendingCount={dashboardData.awaitingForensicCount} />
        <PriorityCaseTable cases={dashboardData.priorityCases} />
        <ActivityTimeline items={dashboardData.activityItems} />
        <QuickActionsPanel startAnalysisHref={dashboardData.startAnalysisHref} />
      </section>
    </PageContainer>
  );
}

async function loadDashboardData(
  supabase: Awaited<ReturnType<typeof createServerComponentClient>>,
  userId: string,
): Promise<DashboardData> {
  const [casesResult, assignmentsResult, actionsResult, forensicResult, activityResult, analysesResult] = await Promise.all([
    supabase.schema("public").from("cases").select("*").limit(400),
    supabase.schema("public").from("case_assignments").select("*").limit(400),
    supabase.schema("public").from("case_actions").select("*").limit(600),
    supabase.schema("public").from("forensic_requests").select("*").limit(600),
    supabase.schema("public").from("case_activity").select("*").limit(600),
    supabase.schema("public").from("case_analyses").select("*").limit(400),
  ]);

  const loadFailed = Boolean(casesResult.error);
  const cases = toRows(casesResult.data);
  const assignments = toRows(assignmentsResult.data);
  const actions = toRows(actionsResult.data);
  const forensicRequests = toRows(forensicResult.data);
  const activityRows = toRows(activityResult.data);
  const analyses = toRows(analysesResult.data);

  const assignmentCaseIds = new Set(
    assignments
      .filter((row) => belongsToOfficer(row, userId))
      .map((row) => caseIdFromRow(row))
      .filter(Boolean),
  );

  const authorizedCases = (assignmentCaseIds.size
    ? cases.filter((row) => assignmentCaseIds.has(caseIdFromRow(row)))
    : cases
  ).filter((row) => caseIdFromRow(row));

  const caseIds = new Set(authorizedCases.map((row) => caseIdFromRow(row)).filter(Boolean));
  const activeCases = authorizedCases.filter((row) => !isClosedStatus(statusText(row)));
  const now = Date.now();
  const minEvidenceThreshold = 70;

  const actionsByCase = groupByCase(actions, caseIds);
  const forensicByCase = groupByCase(forensicRequests, caseIds);
  const activityByCase = groupByCase(activityRows, caseIds);
  const analysesByCase = groupByCase(analyses, caseIds);

  const casesNeedingAttention = activeCases.filter((row) => {
    const caseId = caseIdFromRow(row);
    if (!caseId) return false;

    const statusNeedsAttention = normaliseText(statusText(row)).includes("needs attention");
    const hasOverdueActions = (actionsByCase.get(caseId) ?? []).some(isOverdueAction);
    const evidenceCompleteness = evidencePercentFromCase(row);
    const evidenceBelowThreshold = evidenceCompleteness !== null && evidenceCompleteness < minEvidenceThreshold;
    const noRecentActivity = !recentActivityWithin(activityByCase.get(caseId) ?? [], 7, now);
    const prepNeedsClarification = normaliseText(latestPreparationStatus(row, analysesByCase.get(caseId) ?? [])).includes("clarification");
    const unresolvedForensicDependency = (forensicByCase.get(caseId) ?? []).some(isPendingForensicStatus);

    return (
      statusNeedsAttention ||
      hasOverdueActions ||
      evidenceBelowThreshold ||
      noRecentActivity ||
      prepNeedsClarification ||
      unresolvedForensicDependency
    );
  });

  const awaitingForensicCases = new Set(
    forensicRequests
      .filter((row) => {
        const caseId = caseIdFromRow(row);
        if (!caseId || !caseIds.has(caseId)) return false;
        return isPendingForensicStatus(row);
      })
      .map((row) => caseIdFromRow(row)),
  );

  const readyForReviewCases = activeCases.filter((row) =>
    normaliseText(latestPreparationStatus(row, analysesByCase.get(caseIdFromRow(row)) ?? [])).includes("ready for review"),
  );

  const metrics: DashboardMetric[] = [
    {
      label: "Assigned Cases",
      value: activeCases.length,
      trend: `${activeCases.length} active`,
      comparison: "authorised by RLS",
      tone: "purple",
      icon: "briefcase",
      sparkline: sparklineFromValue(activeCases.length),
      direction: "up",
    },
    {
      label: "Cases Requiring Attention",
      value: casesNeedingAttention.length,
      trend: `${casesNeedingAttention.length} flagged`,
      comparison: `evidence threshold ${minEvidenceThreshold}%`,
      tone: "danger",
      icon: "alert",
      sparkline: sparklineFromValue(casesNeedingAttention.length),
      direction: "up",
    },
    {
      label: "Awaiting Forensic Response",
      value: awaitingForensicCases.size,
      trend: `${awaitingForensicCases.size} pending`,
      comparison: "submitted or pending requests",
      tone: "warning",
      icon: "activity",
      sparkline: sparklineFromValue(awaitingForensicCases.size),
      direction: "up",
    },
    {
      label: "Cases Ready for Review",
      value: readyForReviewCases.length,
      trend: `${readyForReviewCases.length} ready`,
      comparison: "preparation status",
      tone: "success",
      icon: "check",
      sparkline: sparklineFromValue(readyForReviewCases.length),
      direction: "up",
    },
  ];

  const priorityCases: PriorityCase[] = activeCases
    .map((row) => toPriorityCase(row, actionsByCase, forensicByCase, activityByCase, analysesByCase))
    .filter(isPresent)
    .sort((a, b) => {
      const priorityOrder = { High: 3, Medium: 2, Low: 1 };
      const priorityDelta = priorityOrder[b.caseRecord.priority] - priorityOrder[a.caseRecord.priority];
      if (priorityDelta !== 0) return priorityDelta;

      const attentionDelta = Number(b.attention) - Number(a.attention);
      if (attentionDelta !== 0) return attentionDelta;

      const overdueDelta = Number(b.overdue) - Number(a.overdue);
      if (overdueDelta !== 0) return overdueDelta;

      return b.lastActivityEpoch - a.lastActivityEpoch;
    })
    .map((item) => item.caseRecord)
    .slice(0, 5);

  const activityItems = activityRows
    .filter((row) => {
      const caseId = caseIdFromRow(row);
      return caseId ? caseIds.has(caseId) : false;
    })
    .sort((a, b) => rowEpoch(b) - rowEpoch(a))
    .slice(0, 8)
    .map((row) => {
      const caseId = caseIdFromRow(row);
      const relatedCase = authorizedCases.find((item) => caseIdFromRow(item) === caseId);
      const reference = caseReferenceFromCase(relatedCase) || caseId || "Case";

      return {
        title: `${reference} ${asText(row.action ?? row.event ?? row.activity ?? row.summary) || "activity updated"}`,
        detail: asText(row.summary ?? row.detail ?? row.description ?? row.event_note) || "Case activity recorded.",
        time: formatRelativeTime(rowEpoch(row), now),
        tone: activityTone(asText(row.status ?? row.type ?? row.category)),
      };
    });

  const forensicQueue = forensicRequests
    .filter((row) => {
      const caseId = caseIdFromRow(row);
      return caseId ? caseIds.has(caseId) : false;
    })
    .filter((row) => isPendingForensicStatus(row))
    .sort((a, b) => rowEpoch(a) - rowEpoch(b))
    .slice(0, 6)
    .map((row) => {
      const caseId = caseIdFromRow(row);
      const relatedCase = authorizedCases.find((item) => caseIdFromRow(item) === caseId);

      return {
        department: asText(row.discipline ?? row.forensic_discipline ?? row.department ?? row.request_type) || "Forensic unit",
        caseReference: caseReferenceFromCase(relatedCase) || caseId || "Not recorded",
        status: toTitleCase(asText(row.status ?? row.request_status) || "Pending"),
        wait: formatWaitTime(rowEpoch(row), now),
        tone: statusTone(asText(row.status ?? row.request_status)),
      };
    });

  const preparationCompleteness: EvidenceProgressItem[] = [
    {
      label: "Case information indexed",
      value: percentFromCases(authorizedCases, (row) => {
        const reference = caseReferenceFromCase(row);
        const title = asText(row?.title ?? row?.case_title ?? row?.caseTitle);
        return Boolean(reference && title);
      }),
      tone: "purple",
    },
    {
      label: "Witness statements linked",
      value: percentFromCases(authorizedCases, (row) => {
        const count = asNumber(row?.witness_statement_count ?? row?.witness_count ?? row?.witnesses_count);
        if (count !== null) return count > 0;
        const notes = asText(row?.witness_statements ?? row?.witness_summary);
        return Boolean(notes);
      }),
      tone: "success",
    },
    {
      label: "Forensic request completeness",
      value: percentFromRows(forensicRequests.filter((row) => {
        const caseId = caseIdFromRow(row);
        return caseId ? caseIds.has(caseId) : false;
      }), (row) => {
        const hasDiscipline = Boolean(asText(row.discipline ?? row.forensic_discipline ?? row.department));
        const hasQuestion = Boolean(asText(row.request_note ?? row.details ?? row.examination_questions));
        return hasDiscipline && hasQuestion;
      }),
      tone: "warning",
    },
    {
      label: "Chain-of-custody completeness",
      value: percentFromCases(authorizedCases, (row) => {
        const status = normaliseText(asText(row.chain_of_custody_status ?? row.custody_status));
        if (status) return status.includes("complete") || status.includes("verified");
        return Boolean(asText(row.chain_of_custody_notes ?? row.custody_notes));
      }),
      tone: "success",
    },
  ];

  const startAnalysisHref = priorityCases[0]?.id ? `/analysis/${encodeURIComponent(priorityCases[0].id)}` : "/cases";

  return {
    activityItems,
    forensicQueue,
    metrics,
    preparationCompleteness,
    priorityCases,
    startAnalysisHref,
    awaitingForensicCount: awaitingForensicCases.size,
    loadFailed,
  };
}

function toPriorityCase(
  row: DataRow,
  actionsByCase: Map<string, DataRow[]>,
  forensicByCase: Map<string, DataRow[]>,
  activityByCase: Map<string, DataRow[]>,
  analysesByCase: Map<string, DataRow[]>,
): { caseRecord: PriorityCase; attention: boolean; overdue: boolean; lastActivityEpoch: number } | null {
  const id = caseIdFromRow(row);
  if (!id) return null;

  const status = toTitleCase(statusText(row) || "Open");
  const preparationStatus = latestPreparationStatus(row, analysesByCase.get(id) ?? []);
  const isAttention = normaliseText(status).includes("attention") || normaliseText(preparationStatus).includes("clarification");
  const forensicStatus = summariseForensicStatus(forensicByCase.get(id) ?? []);
  const lastActivityAt = latestActivityEpoch(row, activityByCase.get(id) ?? []);
  const hasOverdue = (actionsByCase.get(id) ?? []).some(isOverdueAction);

  return {
    caseRecord: {
      id,
      caseReference: caseReferenceFromCase(row) || id,
      title: asText(row.title ?? row.case_title ?? row.caseTitle) || "Untitled case",
      status,
      statusTone: isAttention ? "attention" : statusTone(status),
      priority: priorityText(row),
      lastActivity: `${formatRelativeTime(lastActivityAt, Date.now())}${hasOverdue ? " - overdue actions" : ""}`,
      forensicStatus,
      readiness: evidencePercentFromCase(row) ?? 0,
    },
    attention: isAttention,
    overdue: hasOverdue,
    lastActivityEpoch: lastActivityAt,
  };
}

function groupByCase(rows: DataRow[], caseIds: Set<string>) {
  const grouped = new Map<string, DataRow[]>();

  rows.forEach((row) => {
    const caseId = caseIdFromRow(row);
    if (!caseId || !caseIds.has(caseId)) return;

    const current = grouped.get(caseId) ?? [];
    current.push(row);
    grouped.set(caseId, current);
  });

  return grouped;
}

function toRows(value: unknown): DataRow[] {
  return Array.isArray(value) ? (value as DataRow[]) : [];
}

function caseIdFromRow(row: DataRow | undefined) {
  return asText(row?.case_id ?? row?.id ?? row?.caseId);
}

function caseReferenceFromCase(row: DataRow | undefined) {
  return asText(
    row?.case_reference ??
      row?.caseReference ??
      row?.reference ??
      row?.fictional_case_number,
  );
}

function evidencePercentFromCase(row: DataRow) {
  return asNumber(
    row.evidence_completeness ?? row.evidenceCompleteness ?? row.evidence_readiness ?? row.preparation_progress,
  );
}

function statusText(row: DataRow) {
  return asText(row.status ?? row.case_status);
}

function latestPreparationStatus(caseRow: DataRow, analyses: DataRow[]) {
  const caseStatus = asText(caseRow.case_preparation_status ?? caseRow.preparation_status ?? caseRow.preparationStatus);
  if (caseStatus) return toTitleCase(caseStatus);

  const latestAnalysis = analyses.sort((a, b) => rowEpoch(b) - rowEpoch(a))[0];
  const analysisStatus = asText(
    latestAnalysis?.preparation_status ??
      latestAnalysis?.case_preparation_status ??
      latestAnalysis?.status,
  );

  return toTitleCase(analysisStatus || "Not recorded");
}

function belongsToOfficer(row: DataRow, userId: string) {
  const ownerColumns = [
    row.user_id,
    row.auth_user_id,
    row.assigned_user_id,
    row.assigned_to_user_id,
    row.officer_id,
    row.assigned_to,
    row.owner_id,
  ]
    .map(asText)
    .filter(Boolean);

  if (!ownerColumns.length) return true;
  return ownerColumns.includes(userId);
}

function isOverdueAction(row: DataRow) {
  const status = normaliseText(asText(row.status ?? row.action_status));
  if (!status || isClosedStatus(status)) return false;

  const dueAt = rowEpoch(row, ["due_date", "due_at", "deadline"]);
  return dueAt > 0 && dueAt < Date.now();
}

function isPendingForensicStatus(row: DataRow) {
  const status = normaliseText(asText(row.status ?? row.request_status));
  if (!status) return false;

  const isExcluded =
    status.includes("completed") ||
    status.includes("rejected") ||
    status.includes("cancelled") ||
    status.includes("canceled");

  if (isExcluded) return false;

  return (
    status.includes("pending") ||
    status.includes("submitted") ||
    status.includes("queued") ||
    status.includes("in progress") ||
    status.includes("processing")
  );
}

function recentActivityWithin(rows: DataRow[], days: number, now: number) {
  if (!rows.length) return false;
  const latest = Math.max(...rows.map((row) => rowEpoch(row)).filter((value) => value > 0));
  if (!latest) return false;
  return now - latest <= days * 24 * 60 * 60 * 1000;
}

function latestActivityEpoch(caseRow: DataRow, activities: DataRow[]) {
  const activityValues = activities.map((row) => rowEpoch(row)).filter((value) => value > 0);
  const caseValue = rowEpoch(caseRow, ["last_activity_at", "last_activity", "updated_at", "created_at"]);

  return Math.max(caseValue, ...activityValues, 0);
}

function summariseForensicStatus(rows: DataRow[]) {
  if (!rows.length) return "No forensic request";
  const open = rows.find(isPendingForensicStatus);
  if (!open) return "No pending dependency";
  return toTitleCase(asText(open.status ?? open.request_status) || "Pending response");
}

function priorityText(row: DataRow): "High" | "Medium" | "Low" {
  const value = normaliseText(asText(row.priority ?? row.priority_level));
  if (value.includes("high") || value.includes("urgent")) return "High";
  if (value.includes("medium")) return "Medium";
  return "Low";
}

function sparklineFromValue(value: number) {
  const baseline = Math.max(value - 4, 0);
  return [baseline, baseline + 1, baseline + 1, baseline + 2, baseline + 2, baseline + 3, value];
}

function percentFromCases(rows: DataRow[], isComplete: (row: DataRow) => boolean) {
  if (!rows.length) return null;
  const completed = rows.filter(isComplete).length;
  return Math.round((completed / rows.length) * 100);
}

function percentFromRows(rows: DataRow[], isComplete: (row: DataRow) => boolean) {
  if (!rows.length) return null;
  const completed = rows.filter(isComplete).length;
  return Math.round((completed / rows.length) * 100);
}

function statusTone(value: string): "attention" | "forensics" | "ready" | "review" | "open" | "resolved" | "calm" {
  const status = normaliseText(value);
  if (status.includes("attention") || status.includes("urgent") || status.includes("clarification")) return "attention";
  if (status.includes("forensic") || status.includes("lab") || status.includes("pending")) return "forensics";
  if (status.includes("ready") || status.includes("verified")) return "ready";
  if (status.includes("review")) return "review";
  if (status.includes("resolved") || status.includes("closed")) return "resolved";
  return "open";
}

function activityTone(status: string): "green" | "purple" | "amber" | "red" {
  const value = normaliseText(status);
  if (value.includes("alert") || value.includes("risk") || value.includes("overdue")) return "red";
  if (value.includes("forensic") || value.includes("pending")) return "amber";
  if (value.includes("resolved") || value.includes("completed") || value.includes("reviewed")) return "green";
  return "purple";
}

function isClosedStatus(value: string) {
  return value.includes("resolved") || value.includes("closed") || value.includes("cancelled") || value.includes("canceled") || value.includes("complete");
}

function rowEpoch(row: DataRow, keys?: string[]) {
  const fields = keys ?? ["event_at", "occurred_at", "created_at", "updated_at", "requested_at", "submitted_at"];

  for (const key of fields) {
    const candidate = asText(row[key]);
    if (!candidate) continue;
    const date = Date.parse(candidate);
    if (Number.isFinite(date)) return date;
  }

  return 0;
}

function formatRelativeTime(epoch: number, now: number) {
  if (!epoch) return "Not recorded";

  const diff = Math.max(0, now - epoch);
  const minutes = Math.floor(diff / (60 * 1000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatWaitTime(epoch: number, now: number) {
  if (!epoch) return "Not recorded";

  const diff = Math.max(0, now - epoch);
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days > 0) return `${days}d ${remainingHours}h`;
  return `${hours}h`;
}

function asText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.min(100, Math.round(value)));
  const text = asText(value).replace("%", "");
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : null;
}

function normaliseText(value: string) {
  return value.trim().toLowerCase();
}

function toTitleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
