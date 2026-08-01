import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon, PageContainer } from "../../components/app-shell";
import { FICTIONAL_DATA_NOTICE } from "../../lib/caseflow-analysis";
import { createServerComponentClient } from "@/lib/supabase/server";

type DataRow = Record<string, unknown>;

type OversightCase = {
  id: string;
  reference: string;
  title: string;
  status: string;
  priority: string;
  lastActivity: string;
  lastActivityDate: Date | null;
  evidenceCompleteness: number | null;
  forensicStatus: string;
  preparationStatus: string;
  verificationStatus: string;
};

type OversightAction = {
  id: string;
  caseId: string;
  caseReference: string;
  title: string;
  assignedOfficer: string;
  dueDate: string;
  dueDateValue: Date | null;
  status: string;
};

type ForensicDependency = {
  id: string;
  caseId: string;
  caseReference: string;
  discipline: string;
  missingRequirements: string;
  status: string;
  timeWaiting: string;
};

type ActivityItem = {
  action: string;
  actor: string;
  caseId: string;
  caseReference: string;
  timestamp: string;
  timestampDate: Date | null;
};

type AttentionItem = {
  caseRecord: OversightCase;
  reason: string;
};

const noRecentActivityDays = 14;

export default async function OversightPage() {
  const supabase = await createServerComponentClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    redirect("/login");
  }

  const { data: caseData, error: casesError } = await supabase
    .schema("public")
    .from("cases")
    .select("*")
    .limit(200);

  const caseRows = Array.isArray(caseData) ? (caseData as DataRow[]) : [];
  const cases = caseRows.map(normaliseCase).filter(isPresent);
  const caseIds = cases.map((caseRecord) => caseRecord.id).filter(Boolean);
  const [actionRows, forensicRows, activityRows] = await Promise.all([
    fetchCaseRelatedRows(supabase, "case_actions", caseIds, 120),
    fetchCaseRelatedRows(supabase, "forensic_requests", caseIds, 120),
    fetchCaseRelatedRows(supabase, "case_activity", caseIds, 120),
  ]);

  const actions = actionRows.map((row) => normaliseAction(row, cases)).filter(isPresent);
  const forensicDependencies = forensicRows
    .map((row) => normaliseForensicDependency(row, cases))
    .filter(isPresent);
  const activity = activityRows
    .map((row) => normaliseActivity(row, cases))
    .filter(isPresent)
    .sort(sortByNewestActivity)
    .slice(0, 8);
  const attentionQueue = buildAttentionQueue(cases, actions, forensicDependencies).slice(0, 8);
  const overdueActions = actions.filter(isOverdueAction);
  const noRecentActivityCases = cases.filter(hasNoRecentActivity);
  const awaitingForensics = cases.filter((caseRecord) =>
    isForensicPending(caseRecord.forensicStatus),
  ).length;
  const readyForReview = cases.filter((caseRecord) =>
    normaliseText(caseRecord.preparationStatus).includes("ready"),
  ).length;
  const activeCases = cases.filter((caseRecord) => !isClosedStatus(caseRecord.status)).length;

  return (
    <PageContainer
      eyebrow="OFFICER OVERSIGHT"
      title="My Investigation Oversight"
      description="Monitor assigned cases, pending actions, forensic dependencies, and preparation risks from one workspace."
    >
      <section className="case-ai-warning dashboard-card" role="note">
        <Icon name="alert" />
        <span>{FICTIONAL_DATA_NOTICE}</span>
      </section>

      {casesError ? (
        <OversightState
          title="Unable to load officer oversight data."
          body="Please try again after confirming the signed-in account still has access."
          icon="alert"
        />
      ) : (
        <>
          <section className="oversight-summary-grid" aria-label="Officer oversight summary">
            <OversightMetric label="Active assigned cases" value={activeCases} tone="purple" />
            <OversightMetric label="Cases requiring attention" value={attentionQueue.length} tone="danger" />
            <OversightMetric label="Awaiting forensic response" value={awaitingForensics} tone="warning" />
            <OversightMetric label="Cases ready for review" value={readyForReview} tone="success" />
            <OversightMetric label="Overdue actions" value={overdueActions.length} tone="danger" />
            <OversightMetric label="Cases with no recent activity" value={noRecentActivityCases.length} tone="warning" />
          </section>

          <section className="oversight-layout">
            <AttentionQueue items={attentionQueue} />
            <div className="oversight-stack">
              <DeadlinePanel actions={actions.slice(0, 10)} />
              <ForensicDependenciesPanel requests={forensicDependencies.slice(0, 8)} />
            </div>
            <EvidenceReadinessPanel cases={cases} />
            <RecentOfficerActivity items={activity} />
          </section>
        </>
      )}
    </PageContainer>
  );
}

function OversightMetric({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "danger" | "purple" | "success" | "warning";
  value: number;
}) {
  const icon = tone === "danger" ? "alert" : tone === "warning" ? "activity" : tone === "success" ? "check" : "briefcase";

  return (
    <article className={`stat-card stat-${tone}`}>
      <div className="stat-card-top">
        <span className="stat-icon">
          <Icon name={icon} />
        </span>
        <span>RLS scoped</span>
      </div>
      <p>{label}</p>
      <strong>{value}</strong>
      <em>Visible through the signed-in officer session.</em>
    </article>
  );
}

function AttentionQueue({ items }: { items: AttentionItem[] }) {
  return (
    <section className="dashboard-card oversight-card oversight-span-2">
      <CardHeader eyebrow="Attention queue" title="Cases requiring officer action" icon="alert" />
      {items.length ? (
        <div className="priority-table-wrap oversight-table-wrap">
          <table className="priority-case-table oversight-table">
            <caption>Cases requiring attention for the signed-in investigating officer.</caption>
            <thead>
              <tr>
                <th>Case</th>
                <th>Reason</th>
                <th>Priority</th>
                <th>Last activity</th>
                <th>Evidence</th>
                <th>Forensics</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ caseRecord, reason }) => (
                <tr key={`${caseRecord.id}-${reason}`}>
                  <td data-label="Case">
                    <Link href={`/cases/${encodeURIComponent(caseRecord.id)}`}>
                      <span>{caseRecord.reference}</span>
                      <strong>{caseRecord.title}</strong>
                    </Link>
                  </td>
                  <td data-label="Reason">{reason}</td>
                  <td data-label="Priority">
                    <span className={`priority-chip priority-${priorityTone(caseRecord.priority)}`}>
                      {caseRecord.priority}
                    </span>
                  </td>
                  <td data-label="Last activity">{caseRecord.lastActivity}</td>
                  <td data-label="Evidence">
                    <EvidenceCompleteness value={caseRecord.evidenceCompleteness} />
                  </td>
                  <td data-label="Forensics">{caseRecord.forensicStatus}</td>
                  <td data-label="Action">
                    <Link className="app-link-button subtle cases-open-button" href={`/cases/${encodeURIComponent(caseRecord.id)}`}>
                      Open Case
                      <Icon name="arrow" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <OversightEmpty>No oversight items require attention.</OversightEmpty>
      )}
    </section>
  );
}

function DeadlinePanel({ actions }: { actions: OversightAction[] }) {
  return (
    <section className="dashboard-card oversight-card">
      <CardHeader eyebrow="Deadlines" title="Assigned actions" icon="check" />
      {actions.length ? (
        <div className="oversight-action-list">
          {actions.map((action) => (
            <article key={action.id}>
              <div>
                <strong>{action.title}</strong>
                <p>{action.caseReference}</p>
              </div>
              <span className={isOverdueAction(action) ? "overdue" : undefined}>
                {isOverdueAction(action) ? "Overdue" : action.dueDate}
              </span>
              <span className={`status-badge status-${statusTone(action.status)}`}>{action.status}</span>
              <Link className="app-link-button subtle" href={`/cases/${encodeURIComponent(action.caseId)}`}>
                Open action
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <OversightEmpty>No assigned actions found.</OversightEmpty>
      )}
    </section>
  );
}

function EvidenceReadinessPanel({ cases }: { cases: OversightCase[] }) {
  const distribution = buildPreparationDistribution(cases);

  return (
    <section className="dashboard-card oversight-card">
      <CardHeader eyebrow="Case preparation" title="Preparation status distribution" icon="layers" />
      <div className="oversight-readiness-list">
        {distribution.map((item) => (
          <div key={item.label}>
            <span>
              <strong>{item.label}</strong>
              <em>{item.count} cases</em>
            </span>
            <i>
              <b style={{ width: `${item.percent}%` }} />
            </i>
          </div>
        ))}
      </div>
    </section>
  );
}

function ForensicDependenciesPanel({ requests }: { requests: ForensicDependency[] }) {
  return (
    <section className="dashboard-card oversight-card">
      <CardHeader eyebrow="Forensic dependencies" title="Pending requests" icon="file" />
      {requests.length ? (
        <div className="oversight-forensic-list">
          {requests.map((request) => (
            <article key={request.id}>
              <div>
                <strong>{request.caseReference}</strong>
                <p>{request.discipline}</p>
              </div>
              <span className={`status-badge status-${statusTone(request.status)}`}>
                {request.status}
              </span>
              <p>{request.timeWaiting}</p>
              <em>{request.missingRequirements}</em>
              <Link className="app-link-button subtle" href={`/cases/${encodeURIComponent(request.caseId)}#forensic-requests`}>
                Open request
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <OversightEmpty>No forensic dependencies recorded.</OversightEmpty>
      )}
    </section>
  );
}

function RecentOfficerActivity({ items }: { items: ActivityItem[] }) {
  return (
    <section className="dashboard-card oversight-card oversight-span-2">
      <CardHeader eyebrow="Recent activity" title="Latest officer activity" icon="activity" />
      {items.length ? (
        <div className="case-activity-log">
          {items.map((item, index) => (
            <article key={`${item.caseId}-${item.timestamp}-${index}`}>
              <div>
                <strong>{item.action}</strong>
                <p>
                  {item.caseReference} · {item.actor}
                </p>
              </div>
              <time>{item.timestamp}</time>
            </article>
          ))}
        </div>
      ) : (
        <OversightEmpty>No recent officer activity found.</OversightEmpty>
      )}
    </section>
  );
}

function CardHeader({
  eyebrow,
  icon,
  title,
}: {
  eyebrow: string;
  icon: "activity" | "alert" | "briefcase" | "check" | "file" | "layers";
  title: string;
}) {
  return (
    <div className="dashboard-card-header compact-header">
      <div>
        <p>{eyebrow}</p>
        <h3>{title}</h3>
      </div>
      <Icon name={icon} />
    </div>
  );
}

function OversightState({
  body,
  icon,
  title,
}: {
  body: string;
  icon: "alert" | "briefcase";
  title: string;
}) {
  return (
    <section className="dashboard-card cases-state">
      <Icon name={icon} />
      <strong>{title}</strong>
      <p>{body}</p>
    </section>
  );
}

function OversightEmpty({ children }: { children: string }) {
  return <p className="case-detail-empty">{children}</p>;
}

async function fetchCaseRelatedRows(
  supabase: Awaited<ReturnType<typeof createServerComponentClient>>,
  table: string,
  caseIds: string[],
  limit: number,
) {
  if (!caseIds.length) return [];

  const orderedResult = await supabase
    .schema("public")
    .from(table)
    .select("*")
    .in("case_id", caseIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!orderedResult.error && Array.isArray(orderedResult.data)) {
    return orderedResult.data as DataRow[];
  }

  const fallbackResult = await supabase
    .schema("public")
    .from(table)
    .select("*")
    .in("case_id", caseIds)
    .limit(limit);

  if (fallbackResult.error || !Array.isArray(fallbackResult.data)) return [];

  return fallbackResult.data as DataRow[];
}

function normaliseCase(row: DataRow): OversightCase | null {
  const id = asText(row.id ?? row.case_id ?? row.caseId);
  const reference = asText(
    row.case_reference ??
      row.caseReference ??
      row.reference ??
      row.fictional_case_number ??
      row.fir_number ??
      row.case_number,
  );
  const title = asText(row.title ?? row.case_title ?? row.caseTitle);

  if (!id && !reference && !title) return null;

  return {
    evidenceCompleteness: asPercentage(
      row.evidence_completeness ??
        row.evidenceCompleteness ??
        row.evidence_readiness ??
        row.preparation_progress,
    ),
    forensicStatus:
      asText(row.forensic_status ?? row.forensicStatus ?? row.forensics_status) || "Not recorded",
    id: id || reference || title,
    lastActivity: formatDateOrText(
      row.last_activity ?? row.lastActivity ?? row.last_activity_at ?? row.updated_at ?? row.created_at,
    ),
    lastActivityDate: parseDate(row.last_activity_at ?? row.updated_at ?? row.created_at),
    preparationStatus:
      asText(row.case_preparation_status ?? row.preparation_status ?? row.preparationStatus) ||
      "Information incomplete",
    priority: toTitleCase(asText(row.priority) || "Unassigned"),
    reference: reference || id || "Unreferenced",
    status: toTitleCase(asText(row.status) || "Open"),
    title: title || "Untitled case",
    verificationStatus:
      asText(row.officer_verification_status ?? row.verification_status ?? row.review_status) ||
      "Not reviewed",
  };
}

function normaliseAction(row: DataRow, cases: OversightCase[]): OversightAction | null {
  const caseId = asText(row.case_id ?? row.caseId);
  const caseRecord = cases.find((item) => item.id === caseId);
  const title = asText(row.title ?? row.action_title ?? row.task ?? row.description);

  if (!caseId || !caseRecord || !title) return null;

  const dueDateValue = parseDate(row.due_date ?? row.due_at ?? row.deadline);

  return {
    assignedOfficer:
      asText(row.assigned_officer ?? row.assigned_officer_name ?? row.owner ?? row.officer_name) ||
      "Not recorded",
    caseId,
    caseReference: caseRecord.reference,
    dueDate: formatDateOrText(row.due_date ?? row.due_at ?? row.deadline),
    dueDateValue,
    id: asText(row.id) || `${caseId}-${title}`,
    status: toTitleCase(asText(row.status) || "Open"),
    title,
  };
}

function normaliseForensicDependency(
  row: DataRow,
  cases: OversightCase[],
): ForensicDependency | null {
  const caseId = asText(row.case_id ?? row.caseId);
  const caseRecord = cases.find((item) => item.id === caseId);
  const status = toTitleCase(asText(row.status ?? row.request_status) || "Not recorded");

  if (!caseId || !caseRecord) return null;

  return {
    caseId,
    caseReference: caseRecord.reference,
    discipline:
      asText(row.discipline ?? row.forensic_discipline ?? row.department ?? row.request_type) ||
      "Forensic request",
    id: asText(row.id ?? row.request_id) || `${caseId}-forensic`,
    missingRequirements:
      asText(row.missing_requirements ?? row.requirements_missing ?? row.notes) ||
      "No missing requirements recorded.",
    status,
    timeWaiting: timeSince(row.requested_at ?? row.created_at ?? row.submitted_at),
  };
}

function normaliseActivity(row: DataRow, cases: OversightCase[]): ActivityItem | null {
  const caseId = asText(row.case_id ?? row.caseId);
  const caseRecord = cases.find((item) => item.id === caseId);

  if (!caseId || !caseRecord) return null;

  return {
    action: asText(row.action ?? row.event ?? row.activity ?? row.summary) || "Case activity recorded",
    actor: asText(row.actor ?? row.actor_name ?? row.created_by ?? row.officer_name) || "Not recorded",
    caseId,
    caseReference: caseRecord.reference,
    timestamp: formatDateOrText(row.created_at ?? row.timestamp ?? row.event_at ?? row.occurred_at),
    timestampDate: parseDate(row.created_at ?? row.timestamp ?? row.event_at ?? row.occurred_at),
  };
}

function buildAttentionQueue(
  cases: OversightCase[],
  actions: OversightAction[],
  requests: ForensicDependency[],
): AttentionItem[] {
  return cases
    .map((caseRecord) => {
      const reason = attentionReason(caseRecord, actions, requests);
      return reason ? { caseRecord, reason } : null;
    })
    .filter(isPresent)
    .sort((a, b) => priorityRank(a.caseRecord.priority) - priorityRank(b.caseRecord.priority));
}

function attentionReason(
  caseRecord: OversightCase,
  actions: OversightAction[],
  requests: ForensicDependency[],
) {
  const caseActions = actions.filter((action) => action.caseId === caseRecord.id);
  const caseRequests = requests.filter((request) => request.caseId === caseRecord.id);
  const preparation = normaliseText(caseRecord.preparationStatus);

  if (hasNoRecentActivity(caseRecord)) return "No recent activity";
  if (caseRecord.evidenceCompleteness !== null && caseRecord.evidenceCompleteness < 60) {
    return "Missing evidence";
  }
  if (preparation.includes("chain") || preparation.includes("custody")) {
    return "Incomplete chain of custody";
  }
  if (caseActions.some(isOverdueAction)) return "Overdue action";
  if (caseRequests.some((request) => isForensicPending(request.status))) {
    return "Pending forensic request";
  }
  if (!normaliseText(caseRecord.verificationStatus).includes("review")) {
    return "Missing officer verification";
  }

  return "";
}

function buildPreparationDistribution(cases: OversightCase[]) {
  const labels = [
    "Ready for review",
    "Needs clarification",
    "Missing critical information",
    "Awaiting forensic material",
    "Information incomplete",
  ];
  const total = Math.max(cases.length, 1);

  return labels.map((label) => {
    const count = cases.filter((caseRecord) =>
      normalisePreparationStatus(caseRecord.preparationStatus) === label
    ).length;

    return {
      count,
      label,
      percent: Math.round((count / total) * 100),
    };
  });
}

function normalisePreparationStatus(value: string) {
  const text = normaliseText(value);

  if (text.includes("ready")) return "Ready for review";
  if (text.includes("clarification")) return "Needs clarification";
  if (text.includes("critical")) return "Missing critical information";
  if (text.includes("forensic")) return "Awaiting forensic material";
  return "Information incomplete";
}

function EvidenceCompleteness({ value }: { value: number | null }) {
  if (value === null) return <span className="cases-muted-value">Not recorded</span>;

  return (
    <div className="readiness-cell compact-readiness">
      <span>
        <i style={{ width: `${value}%` }} />
      </span>
      <strong>{value}%</strong>
    </div>
  );
}

function hasNoRecentActivity(caseRecord: OversightCase) {
  if (!caseRecord.lastActivityDate) return true;

  const ageMs = Date.now() - caseRecord.lastActivityDate.valueOf();
  return ageMs > noRecentActivityDays * 24 * 60 * 60 * 1000;
}

function isOverdueAction(action: OversightAction) {
  return Boolean(
    action.dueDateValue &&
      action.dueDateValue.valueOf() < Date.now() &&
      !isClosedStatus(action.status),
  );
}

function isForensicPending(value: string) {
  const text = normaliseText(value);
  return text.includes("pending") || text.includes("awaiting") || text.includes("requested");
}

function isClosedStatus(value: string) {
  const text = normaliseText(value);
  return text.includes("closed") || text.includes("resolved") || text.includes("complete");
}

function sortByNewestActivity(a: ActivityItem, b: ActivityItem) {
  return (b.timestampDate?.valueOf() ?? 0) - (a.timestampDate?.valueOf() ?? 0);
}

function priorityRank(value: string) {
  const text = normaliseText(value);
  if (text.includes("high") || text.includes("urgent")) return 0;
  if (text.includes("medium")) return 1;
  return 2;
}

function statusTone(status: string) {
  const value = normaliseText(status);
  if (value.includes("attention") || value.includes("clarification") || value.includes("overdue")) {
    return "attention";
  }
  if (value.includes("forensic") || value.includes("lab") || value.includes("pending")) {
    return "forensics";
  }
  if (value.includes("ready") || value.includes("reviewed") || value.includes("complete")) return "ready";
  if (value.includes("review")) return "review";
  if (value.includes("resolved") || value.includes("closed")) return "resolved";
  return "open";
}

function priorityTone(priority: string) {
  const value = normaliseText(priority);
  if (value.includes("high") || value.includes("urgent")) return "high";
  if (value.includes("medium")) return "medium";
  return "low";
}

function asPercentage(value: unknown) {
  const numericValue =
    typeof value === "number" ? value : Number.parseFloat(asText(value).replace("%", ""));

  if (!Number.isFinite(numericValue)) return null;

  return Math.min(100, Math.max(0, Math.round(numericValue)));
}

function timeSince(value: unknown) {
  const date = parseDate(value);
  if (!date) return "Waiting time not recorded";

  const ageMs = Math.max(0, Date.now() - date.valueOf());
  const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ageMs / (60 * 60 * 1000)) % 24);

  if (days > 0) return `${days}d ${hours}h waiting`;
  return `${hours}h waiting`;
}

function formatDateOrText(value: unknown) {
  const text = asText(value);
  if (!text) return "Not recorded";

  const date = parseDate(text);
  if (!date) return text;

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function parseDate(value: unknown) {
  const text = asText(value);
  if (!text) return null;

  const date = new Date(text);
  const looksLikeDate = Number.isFinite(date.valueOf()) && /\d{4}-\d{2}-\d{2}|T\d{2}:/.test(text);

  return looksLikeDate ? date : null;
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

function asText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
