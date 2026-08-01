import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon, PageContainer } from "../../components/app-shell";
import {
  ActivityTimeline,
  CaseProgressChart,
  type CaseProgressPoint,
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
  type StatusDistributionItem,
  StatusDistributionChart,
} from "../../components/dashboard-components";
import {
  type DataRow,
  asText,
  attentionReasons,
  belongsToOfficer,
  caseIdFromRow,
  casePriorityFromCase,
  caseReferenceFromCase,
  caseStatusFromCase,
  caseTitleFromCase,
  comparePriorityRanks,
  evidencePercentFromCase,
  forensicDisciplineLabel,
  formatRelativeTime,
  formatWaitTime,
  isActiveAssignment,
  isClosedStatus,
  isOverdueAction,
  isPendingForensicStatus,
  isSupervisoryRoleCode,
  normaliseText,
  postingRoleCode,
  preparationStatusFromCaseContext,
  priorityRank,
  rowEpoch,
  selectActivePosting,
  toRows,
  toTitleCase,
} from "@/app/lib/officer-workspace";
import { getWorkspaceContext } from "@/app/lib/workspace-server";
import { DEMO_STATION_DATA } from "@/lib/demo-dashboard-data";
import { DEMO_CITIZEN_REQUESTS } from "@/lib/demo-citizen-requests";
import { createServerComponentClient } from "@/lib/supabase/server";

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
  caseProgressSeries: CaseProgressPoint[];
  statusDistribution: StatusDistributionItem[];
  resolvedCount: number;
  totalAssignedCount: number;
  awaitingForensicCount: number;
  loadFailed: boolean;
};

type CaseContext = {
  activities: DataRow[];
  actions: DataRow[];
  attention: string[];
  caseId: string;
  evidencePercent: number | null;
  forensics: DataRow[];
  hasBlockedActions: boolean;
  hasOverdueActions: boolean;
  preparationStatus: string;
  rank: readonly [number, number, number, number, number, number];
  recentActivityEpoch: number;
  row: DataRow;
};

export default async function DashboardPage() {
  const supabase = await createServerComponentClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    redirect("/login");
  }

  const workspace = await getWorkspaceContext(supabase);

  if (!workspace) {
    redirect("/login");
  }

  if (workspace.workspaceRole === "citizen") {
    redirect("/citizen");
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const { data: postingRows } = await supabase
    .schema("public")
    .from("user_postings")
    .select("role_code, role, posting_role, valid_from, valid_until, is_primary, is_active, active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("is_primary", { ascending: false })
    .order("valid_from", { ascending: false })
    .limit(20);

  const activePosting = selectActivePosting(toRows(postingRows));
  const roleCode = postingRoleCode(activePosting);

  if (activePosting && isSupervisoryRoleCode(roleCode)) {
    redirect("/oversight");
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

      <section className="dashboard-card citizen-dashboard-card">
        <div className="dashboard-card-header compact-header">
          <div>
            <p>Citizen Requests</p>
            <h3>{DEMO_CITIZEN_REQUESTS.length} total requests</h3>
          </div>
          <Icon name="clipboard" />
        </div>

        <div className="citizen-dashboard-stats">
          <span>1 under review</span>
          <span>1 awaiting information</span>
          <span>1 referred for action</span>
        </div>

        <p className="citizen-dashboard-note">Demonstration citizen request data</p>

        <Link className="button button-secondary" href="/citizen-requests">
          View Citizen Requests
        </Link>
      </section>

      <section className="dashboard-analytics-grid">
        <CaseProgressChart data={dashboardData.caseProgressSeries} />
        <StatusDistributionChart items={dashboardData.statusDistribution} />
        <ResolutionRateCard
          resolvedCount={dashboardData.resolvedCount}
          totalCount={dashboardData.totalAssignedCount}
        />
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
    supabase.schema("public").from("case_activity").select("*").limit(800),
    supabase.schema("public").from("case_analyses").select("*").limit(500),
  ]);

  const loadFailed = Boolean(casesResult.error);
  const now = Date.now();
  const cases = toRows(casesResult.data);
  const assignments = toRows(assignmentsResult.data);
  const actions = toRows(actionsResult.data);
  const forensicRequests = toRows(forensicResult.data);
  const activityRows = toRows(activityResult.data);
  const analyses = toRows(analysesResult.data);

  const assignmentCaseIds = new Set(
    assignments
      .filter((row) => belongsToOfficer(row, userId) && isActiveAssignment(row, now))
      .map((row) => caseIdFromRow(row))
      .filter(Boolean),
  );

  const authorizedCases = cases.filter((row) => assignmentCaseIds.has(caseIdFromRow(row)));
  const caseIds = new Set(authorizedCases.map((row) => caseIdFromRow(row)).filter(Boolean));

  const actionsByCase = groupByCase(actions, caseIds);
  const forensicByCase = groupByCase(forensicRequests, caseIds);
  const activityByCase = groupByCase(activityRows, caseIds);
  const analysesByCase = groupByCase(analyses, caseIds);

  const contexts: CaseContext[] = [];

  authorizedCases.forEach((row) => {
      const caseId = caseIdFromRow(row);
      if (!caseId) return;

      const caseActions = actionsByCase.get(caseId) ?? [];
      const caseForensics = (forensicByCase.get(caseId) ?? []).filter(isPendingForensicStatus);
      const caseActivities = activityByCase.get(caseId) ?? [];
      const caseAnalyses = analysesByCase.get(caseId) ?? [];

      const hasOverdueActions = caseActions.some((action) => isOverdueAction(action, now));
      const hasBlockedActions = caseActions.some((action) =>
        normaliseText(asText(action.status ?? action.action_status)).includes("blocked"),
      );
      const evidencePercent = evidencePercentFromCase(row);
      const recentActivityEpoch = latestActivityEpoch(row, caseActivities);
      const preparation = preparationStatusFromCaseContext({
        analyses: caseAnalyses,
        caseRow: row,
        evidencePercent,
        hasBlockedActions,
        hasOverdueActions,
        hasPendingForensics: caseForensics.length > 0,
        now,
        recentActivityEpoch,
      });

      const noRecentActivity = !recentActivityWithin(caseActivities, 7, now);
      const attention = attentionReasons({
        evidencePercent,
        hasBlockedActions,
        hasOverdueActions,
        hasPendingForensics: caseForensics.length > 0,
        noRecentActivity,
        preparationStatus: preparation.status,
      });

      contexts.push({
        activities: caseActivities,
        actions: caseActions,
        attention,
        caseId,
        evidencePercent,
        forensics: caseForensics,
        hasBlockedActions,
        hasOverdueActions,
        preparationStatus: preparation.status,
        rank: priorityRank(row, {
          blockedActionCount: hasBlockedActions ? 1 : 0,
          evidencePercent,
          hasMissingCriticalInformation: preparation.status === "Missing critical information",
          overdueActionCount: hasOverdueActions ? 1 : 0,
          recentActivityEpoch,
        }),
        recentActivityEpoch,
        row,
      });
  });

  const activeContexts = contexts.filter((context) => !isClosedStatus(caseStatusFromCase(context.row)));

  const metrics: DashboardMetric[] = [
    {
      label: "Assigned Cases",
      value: DEMO_STATION_DATA.totals.assignedCases,
      trend: `${DEMO_STATION_DATA.totals.assignedCases} station total`,
      comparison: "Demonstration station data",
      tone: "purple",
      icon: "briefcase",
      sparkline: sparklineFromValue(DEMO_STATION_DATA.totals.assignedCases),
      direction: "up",
    },
    {
      label: "Cases Requiring Attention",
      value: DEMO_STATION_DATA.totals.casesRequiringAttention,
      trend: `${DEMO_STATION_DATA.totals.casesRequiringAttention} flagged`,
      comparison: "Demonstration station data",
      tone: "danger",
      icon: "alert",
      sparkline: sparklineFromValue(DEMO_STATION_DATA.totals.casesRequiringAttention),
      direction: "up",
    },
    {
      label: "Forensic requests awaiting response",
      value: DEMO_STATION_DATA.totals.awaitingForensicResponse,
      trend: `${DEMO_STATION_DATA.totals.awaitingForensicResponse} pending`,
      comparison: "Demonstration station data",
      tone: "warning",
      icon: "activity",
      sparkline: sparklineFromValue(DEMO_STATION_DATA.totals.awaitingForensicResponse),
      direction: "up",
    },
    {
      label: "Cases Ready for Review",
      value: DEMO_STATION_DATA.totals.readyForReview,
      trend: `${DEMO_STATION_DATA.totals.readyForReview} ready`,
      comparison: "Demonstration station data",
      tone: "success",
      icon: "check",
      sparkline: sparklineFromValue(DEMO_STATION_DATA.totals.readyForReview),
      direction: "up",
    },
  ];

  const priorityCases: PriorityCase[] = activeContexts
    .slice()
    .sort((a, b) => comparePriorityRanks(a.rank, b.rank))
    .slice(0, 5)
    .map((context) => ({
      id: context.caseId,
      caseReference: caseReferenceFromCase(context.row) || context.caseId,
      title: caseTitleFromCase(context.row) || "Untitled case",
      status: caseStatusFromCase(context.row),
      statusTone: context.attention.length > 0 ? "attention" : statusTone(caseStatusFromCase(context.row)),
      priority: casePriorityFromCase(context.row),
      lastActivity: `${formatRelativeTime(context.recentActivityEpoch, now)}${context.hasOverdueActions ? " - overdue actions" : ""}`,
      forensicStatus: summariseForensicStatus(context.forensics),
      readiness: context.evidencePercent ?? 0,
    }));

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
        detail:
          asText(row.summary ?? row.detail ?? row.description ?? row.event_note) ||
          "System-generated case activity entry.",
        time: formatRelativeTime(rowEpoch(row), now),
        tone: activityTone(asText(row.status ?? row.type ?? row.category)),
      };
    });

  const forensicQueue = forensicRequests
    .filter((row) => {
      const caseId = caseIdFromRow(row);
      return caseId ? caseIds.has(caseId) : false;
    })
    .filter(isPendingForensicStatus)
    .sort((a, b) => rowEpoch(a) - rowEpoch(b))
    .slice(0, 6)
    .map((row) => {
      const caseId = caseIdFromRow(row);
      const relatedCase = authorizedCases.find((item) => caseIdFromRow(item) === caseId);

      return {
        department: forensicDisciplineLabel(row.discipline ?? row.forensic_discipline ?? row.department ?? row.request_type),
        caseReference: caseReferenceFromCase(relatedCase) || caseId || "Unavailable",
        status: toTitleCase(asText(row.status ?? row.request_status) || "Pending"),
        wait: formatWaitTime(rowEpoch(row, ["submitted_at", "created_at", "requested_at"]), now),
        tone: statusTone(asText(row.status ?? row.request_status)),
      } satisfies ForensicQueueItem;
    });

  const preparationCompleteness: EvidenceProgressItem[] = [
    {
      label: "Case information indexed",
      value: DEMO_STATION_DATA.preparation.caseInformationIndexed,
      tone: "purple",
    },
    {
      label: "Witness statements linked",
      value: DEMO_STATION_DATA.preparation.witnessStatementsLinked,
      tone: "success",
    },
    {
      label: "Forensic request completeness",
      value: DEMO_STATION_DATA.preparation.forensicRequestCompleteness,
      tone: "warning",
    },
    {
      label: "Chain-of-custody completeness",
      value: DEMO_STATION_DATA.preparation.chainOfCustodyCompleteness,
      tone: "success",
    },
  ];

  const startAnalysisHref = priorityCases[0]?.id
    ? `/analysis/${encodeURIComponent(priorityCases[0].id)}`
    : "/cases";

  const caseProgressSeries = buildCaseProgressSeries();
  const statusDistribution = buildStatusDistribution();

  return {
    activityItems,
    caseProgressSeries,
    forensicQueue,
    metrics,
    preparationCompleteness,
    priorityCases,
    resolvedCount: DEMO_STATION_DATA.totals.resolvedCases,
    startAnalysisHref,
    statusDistribution,
    totalAssignedCount: DEMO_STATION_DATA.totals.assignedCases,
    awaitingForensicCount: DEMO_STATION_DATA.totals.awaitingForensicResponse,
    loadFailed,
  };
}

function buildCaseProgressSeries(): CaseProgressPoint[] {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return labels.map((label, index) => ({
    label,
    opened: distributeAcrossWeek(DEMO_STATION_DATA.totals.assignedCases, index),
    moved: distributeAcrossWeek(DEMO_STATION_DATA.totals.casesRequiringAttention, index),
    resolved: distributeAcrossWeek(DEMO_STATION_DATA.totals.resolvedCases, index),
  }));
}

function buildStatusDistribution(): StatusDistributionItem[] {
  const total = DEMO_STATION_DATA.totals.assignedCases || 1;
  const colorByLabel: Record<string, string> = {
    Open: "#5b55f6",
    "Needs Attention": "#ef4444",
    "Awaiting Forensics": "#f59e0b",
    "Officer Review": "#8b5cf6",
    "Ready for Review": "#14b8a6",
    Resolved: "#22c55e",
  };

  const counts: Array<[string, number]> = [
    ["Open", DEMO_STATION_DATA.statusCounts.open],
    ["Needs Attention", DEMO_STATION_DATA.statusCounts.needsAttention],
    ["Awaiting Forensics", DEMO_STATION_DATA.statusCounts.awaitingForensics],
    ["Officer Review", DEMO_STATION_DATA.statusCounts.officerReview],
    ["Ready for Review", DEMO_STATION_DATA.statusCounts.readyForReview],
    ["Resolved", DEMO_STATION_DATA.statusCounts.resolved],
  ];

  return counts.map(([label, count]) => ({
      label,
      value: (count / total) * 100,
      color: colorByLabel[label] ?? "#5b55f6",
      count,
      total,
    }));
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

function sparklineFromValue(value: number) {
  const baseline = Math.max(value - 4, 0);
  return [baseline, baseline + 1, baseline + 1, baseline + 2, baseline + 2, baseline + 3, value];
}

function distributeAcrossWeek(total: number, dayIndex: number) {
  const days = 7;
  const base = Math.floor(total / days);
  const remainder = total % days;
  return base + (dayIndex < remainder ? 1 : 0);
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

function summariseForensicStatus(rows: DataRow[]) {
  if (!rows.length) return "No forensic request";
  const open = rows.find(isPendingForensicStatus);
  if (!open) return "No pending dependency";
  return toTitleCase(asText(open.status ?? open.request_status) || "Pending response");
}

function latestActivityEpoch(caseRow: DataRow, activities: DataRow[]) {
  const activityValues = activities.map((row) => rowEpoch(row)).filter((value) => value > 0);
  const caseValue = rowEpoch(caseRow, ["last_activity_at", "last_activity", "updated_at", "created_at"]);

  return Math.max(caseValue, ...activityValues, 0);
}

function recentActivityWithin(rows: DataRow[], days: number, now: number) {
  if (!rows.length) return false;
  const latest = Math.max(...rows.map((row) => rowEpoch(row)).filter((value) => value > 0));
  if (!latest) return false;
  return now - latest <= days * 24 * 60 * 60 * 1000;
}
