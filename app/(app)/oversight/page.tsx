import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon, PageContainer } from "../../components/app-shell";
import { FICTIONAL_DATA_NOTICE } from "../../lib/caseflow-analysis";
import { DEMO_CITIZEN_REQUESTS } from "@/lib/demo-citizen-requests";
import {
  type DataRow,
  asText,
  attentionReasons,
  caseIdFromRow,
  casePriorityFromCase,
  caseReferenceFromCase,
  caseStatusFromCase,
  caseTitleFromCase,
  comparePriorityRanks,
  evidencePercentFromCase,
  forensicDisciplineLabel,
  formatDateOrText,
  formatWaitTime,
  isActionCompleted,
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
import { createServerComponentClient } from "@/lib/supabase/server";

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
  overdue: boolean;
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
  rank: readonly [number, number, number, number, number, number];
  reason: string;
};

const noRecentActivityDays = 14;

export default async function OversightPage() {
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

  const { data: postingData, error: postingError } = await supabase
    .schema("public")
    .from("user_postings")
    .select("user_id, organisational_unit_id, role_code, posting_title, valid_from, valid_until, is_primary, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("is_primary", { ascending: false })
    .order("valid_from", { ascending: false })
    .limit(20);

  const activePosting = selectActivePosting(toRows(postingData));
  const roleCode = postingRoleCode(activePosting);

  if (postingError || !activePosting) {
    return (
      <PageContainer
        eyebrow="SUPERVISORY WORKSPACE"
        title="Supervisory Oversight"
        description="No active posting was found for this account."
      >
        <OversightState
          title="No active posting available"
          body="Authorised supervisory records are unavailable for this session."
          icon="briefcase"
        />
      </PageContainer>
    );
  }

  if (!isSupervisoryRoleCode(roleCode)) {
    redirect("/dashboard");
  }

  const stationUnitId = asText(activePosting.organisational_unit_id);

  if (!stationUnitId) {
    return (
      <PageContainer
        eyebrow="SUPERVISORY WORKSPACE"
        title="Supervisory Oversight"
        description="Posting scope could not be resolved."
      >
        <OversightState
          title="Missing posting scope"
          body="Authorised supervisory records are unavailable for this session."
          icon="alert"
        />
      </PageContainer>
    );
  }

  const stationResult = await supabase
    .schema("public")
    .from("organisational_units")
    .select("id, parent_unit_id")
    .eq("id", stationUnitId)
    .maybeSingle();
  const subdivisionUnitId = asText(stationResult.data?.parent_unit_id);
  const subdivisionResult = subdivisionUnitId
    ? await supabase
        .schema("public")
        .from("organisational_units")
        .select("id, parent_unit_id")
        .eq("id", subdivisionUnitId)
        .maybeSingle()
    : { data: null, error: null };
  const districtUnitId = asText(subdivisionResult.data?.parent_unit_id);

  if (stationResult.error || !stationResult.data || !districtUnitId) {
    return (
      <PageContainer
        eyebrow="SUPERVISORY WORKSPACE"
        title="Supervisory Oversight"
        description="Posting hierarchy could not be resolved."
      >
        <OversightState
          title="Missing district or station scope"
          body="Authorised supervisory records are unavailable for this session."
          icon="alert"
        />
      </PageContainer>
    );
  }

  const caseData = await supabase
    .schema("public")
    .from("cases")
    .select("*")
    .or(`station_unit_id.eq.${stationUnitId},district_unit_id.eq.${districtUnitId}`)
    .limit(500);

  const caseRows = toRows(caseData.data);
  const cases = caseRows.map(normaliseCase).filter(isPresent);
  const caseIds = new Set(cases.map((item) => item.id));
  const caseIdList = Array.from(caseIds);

  const [actionRows, forensicRows, activityRows, analysisRows] = caseIdList.length
    ? await Promise.all([
        supabase.schema("public").from("case_actions").select("*").in("case_id", caseIdList).limit(700),
        supabase.schema("public").from("forensic_requests").select("*").in("case_id", caseIdList).limit(700),
        supabase.schema("public").from("case_activity").select("*").in("case_id", caseIdList).limit(900),
        supabase.schema("public").from("case_analyses").select("*").in("case_id", caseIdList).limit(400),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];

  const forensicRequestRows = toRows(forensicRows.data);
  const forensicRequestIds = forensicRequestRows
    .map((row) => asText(row.id ?? row.request_id))
    .filter(Boolean);
  const forensicResponses = forensicRequestIds.length
    ? await supabase
        .schema("public")
        .from("forensic_responses")
        .select("forensic_request_id")
        .in("forensic_request_id", forensicRequestIds)
        .limit(1200)
    : { data: [], error: null };

  const hasLoadError = Boolean(
    caseData.error ||
      actionRows.error ||
      forensicRows.error ||
      forensicResponses.error ||
      activityRows.error ||
      analysisRows.error,
  );

  const respondedRequestIds = new Set(
    toRows(forensicResponses.data)
      .map((row) => asText(row.forensic_request_id))
      .filter(Boolean),
  );

  const actions = toRows(actionRows.data)
    .map((row) => normaliseAction(row, cases))
    .filter(isPresent);

  const renderNow = currentEpoch();

  const requests = forensicRequestRows
    .filter(isPendingForensicStatus)
    .filter((row) => {
      const requestId = asText(row.id ?? row.request_id);
      return requestId ? !respondedRequestIds.has(requestId) : true;
    })
    .map((row) => normaliseForensicDependency(row, cases, renderNow))
    .filter(isPresent);

  const activity = toRows(activityRows.data)
    .map((row) => normaliseActivity(row, cases))
    .filter(isPresent)
    .sort(sortByNewestActivity)
    .slice(0, 8);

  const analysesByCase = groupByCase(toRows(analysisRows.data), caseIds);
  const actionsByCase = groupByCase(toRows(actionRows.data), caseIds);
  const requestsByCase = groupByCase(forensicRequestRows, caseIds);
  const activityByCase = groupByCase(toRows(activityRows.data), caseIds);

  const attentionQueue = buildAttentionQueue(cases, {
    actionsByCase,
    activityByCase,
    analysesByCase,
    now: renderNow,
    requestsByCase,
  }).slice(0, 8);
  return (
    <PageContainer
      eyebrow="SUPERVISORY WORKSPACE"
      title="Supervisory Oversight"
      description="Monitor station-level investigations, overdue actions, forensic dependencies, preparation risks, and recent officer activity."
    >
      <SupervisoryScopePanel />

      <section className="case-ai-warning dashboard-card" role="note">
        <Icon name="alert" />
        <span>{FICTIONAL_DATA_NOTICE}</span>
      </section>

      <section className="dashboard-card citizen-oversight-card">
        <div className="dashboard-card-header compact-header">
          <div>
            <p>Citizen Request Oversight</p>
            <h3>Hardcoded demonstration citizen requests</h3>
          </div>
          <Icon name="clipboard" />
        </div>

        <section className="citizen-request-summary-grid citizen-oversight-summary-grid" aria-label="Citizen request oversight summary">
          <article className="citizen-card citizen-summary-card">
            <span>Open Citizen Requests</span>
            <strong>3</strong>
          </article>
          <article className="citizen-card citizen-summary-card">
            <span>Unreviewed Requests</span>
            <strong>0</strong>
          </article>
          <article className="citizen-card citizen-summary-card">
            <span>Awaiting Citizen Information</span>
            <strong>1</strong>
          </article>
          <article className="citizen-card citizen-summary-card">
            <span>Referred for Action</span>
            <strong>1</strong>
          </article>
          <article className="citizen-card citizen-summary-card">
            <span>Closed Requests</span>
            <strong>1</strong>
          </article>
        </section>

        <div className="priority-table-wrap citizen-request-table-wrap">
          <table className="priority-case-table citizen-request-table">
            <caption>Citizen request oversight table for the supervisory officer.</caption>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Request Type</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Assigned Officer</th>
                <th>Submitted Date</th>
                <th>Last Activity</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_CITIZEN_REQUESTS.map((request) => (
                <tr key={request.id}>
                  <td data-label="Reference"><strong>{request.reference}</strong></td>
                  <td data-label="Request Type">{request.requestType}</td>
                  <td data-label="Status">{request.publicStatus}</td>
                  <td data-label="Priority">{request.priority}</td>
                  <td data-label="Assigned Officer">{request.assignedOfficer}</td>
                  <td data-label="Submitted Date">{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(request.submittedAt))}</td>
                  <td data-label="Last Activity">{request.lastActivity}</td>
                  <td data-label="Action">
                    <Link className="app-link-button" href={`/citizen-requests/${request.id}?mode=supervisory`}>
                      Open Request
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {hasLoadError ? (
        <OversightState
          title="Unable to load supervisory oversight data."
          body="Please try again after confirming the signed-in account still has access."
          icon="alert"
        />
      ) : (
        <>
          <section className="oversight-summary-grid" aria-label="Supervisory oversight summary">
            <OversightMetric label="Active assigned cases" value={DEMO_STATION_DATA.totals.assignedCases} tone="purple" />
            <OversightMetric label="Cases requiring attention" value={DEMO_STATION_DATA.totals.casesRequiringAttention} tone="danger" />
            <OversightMetric label="Awaiting forensic response" value={DEMO_STATION_DATA.totals.awaitingForensicResponse} tone="warning" />
            <OversightMetric label="Cases ready for review" value={DEMO_STATION_DATA.totals.readyForReview} tone="success" />
            <OversightMetric label="Overdue actions" value={DEMO_STATION_DATA.totals.overdueActions} tone="danger" />
            <OversightMetric label="Cases with no recent activity" value={DEMO_STATION_DATA.totals.casesWithNoRecentActivity} tone="warning" />
          </section>

          <section className="oversight-layout">
            <AttentionQueue items={attentionQueue} />
            <div className="oversight-stack">
              <DeadlinePanel actions={actions.filter((item) => !isActionCompleted(item.status)).slice(0, 10)} />
              <ForensicDependenciesPanel requests={requests.slice(0, 8)} />
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
        <span>Demonstration station data</span>
      </div>
      <p>{label}</p>
      <strong>{value}</strong>
      <em>Demonstration station summary.</em>
    </article>
  );
}

function AttentionQueue({ items }: { items: AttentionItem[] }) {
  return (
    <section className="dashboard-card oversight-card oversight-span-2">
      <CardHeader eyebrow="Attention queue" title="Cases requiring supervisory action" icon="alert" />
      {items.length ? (
        <div className="priority-table-wrap oversight-table-wrap">
          <table className="priority-case-table oversight-table">
            <caption>Cases requiring attention for the signed-in supervisory officer.</caption>
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
        <OversightEmpty>No authorised cases are currently available for this station scope.</OversightEmpty>
      )}
    </section>
  );
}

function DeadlinePanel({ actions }: { actions: OversightAction[] }) {
  return (
    <section className="dashboard-card oversight-card">
      <CardHeader eyebrow="Deadlines" title="Assigned actions and deadlines" icon="check" />
      {actions.length ? (
        <div className="oversight-action-list">
          {actions.map((action) => {
            const overdue = action.overdue;
            return (
              <article key={action.id}>
                <div>
                  <strong>{action.title}</strong>
                  <p>{action.caseReference}</p>
                </div>
                <span className={overdue ? "overdue" : undefined}>
                  {overdue ? "Overdue" : action.dueDate}
                </span>
                <span className={`status-badge status-${statusTone(action.status)}`}>{action.status}</span>
                <Link className="app-link-button subtle" href={`/cases/${encodeURIComponent(action.caseId)}`}>
                  Open action
                </Link>
              </article>
            );
          })}
        </div>
      ) : (
        <OversightEmpty>No overdue actions are available.</OversightEmpty>
      )}
    </section>
  );
}

function EvidenceReadinessPanel({ cases }: { cases: OversightCase[] }) {
  if (!cases.length) {
    return (
      <section className="dashboard-card oversight-card">
        <CardHeader eyebrow="Case preparation" title="Preparation status distribution" icon="layers" />
        <OversightEmpty>Preparation distribution will appear when authorised cases are available.</OversightEmpty>
      </section>
    );
  }

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
      <CardHeader eyebrow="Forensic dependencies" title="Forensic dependencies" icon="file" />
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
        <OversightEmpty>No pending forensic dependencies are available.</OversightEmpty>
      )}
    </section>
  );
}

function RecentOfficerActivity({ items }: { items: ActivityItem[] }) {
  return (
    <section className="dashboard-card oversight-card oversight-span-2">
      <CardHeader eyebrow="Recent activity" title="Recent supervisory activity" icon="activity" />
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
        <OversightEmpty>No recent supervisory activity is available.</OversightEmpty>
      )}
    </section>
  );
}

function SupervisoryScopePanel() {
  const scope = DEMO_STATION_DATA.scope;

  return (
    <section className="dashboard-card oversight-card oversight-scope-card" aria-label="Supervisory station scope">
      <div className="dashboard-card-header compact-header">
        <div>
          <p>Demonstration station summary</p>
          <h3>{scope.stationViewLabel}</h3>
        </div>
        <Icon name="layers" />
      </div>
      <div className="oversight-scope-grid">
        <div>
          <span>Police station</span>
          <strong>{scope.policeStation}</strong>
        </div>
        <div>
          <span>Subdivision</span>
          <strong>{scope.subdivision}</strong>
        </div>
        <div>
          <span>District</span>
          <strong>{scope.district}</strong>
        </div>
        <div>
          <span>State</span>
          <strong>{scope.state}</strong>
        </div>
      </div>
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

function normaliseCase(row: DataRow): OversightCase | null {
  const id = caseIdFromRow(row);
  if (!id) return null;

  return {
    evidenceCompleteness: evidencePercentFromCase(row),
    forensicStatus: toTitleCase(asText(row.forensic_status ?? row.forensicStatus ?? row.forensics_status) || "No forensic request"),
    id,
    lastActivity: formatDateOrText(row.last_activity ?? row.lastActivity ?? row.last_activity_at ?? row.updated_at ?? row.created_at),
    lastActivityDate: rowEpoch(row, ["last_activity_at", "updated_at", "created_at"])
      ? new Date(rowEpoch(row, ["last_activity_at", "updated_at", "created_at"]))
      : null,
    preparationStatus: toTitleCase(asText(row.case_preparation_status ?? row.preparation_status ?? row.preparationStatus) || "Information incomplete"),
    priority: casePriorityFromCase(row),
    reference: caseReferenceFromCase(row) || id,
    status: caseStatusFromCase(row),
    title: caseTitleFromCase(row) || "Untitled case",
    verificationStatus: toTitleCase(asText(row.officer_verification_status ?? row.verification_status ?? row.review_status) || "Not reviewed"),
  };
}

function normaliseAction(row: DataRow, cases: OversightCase[]): OversightAction | null {
  const caseId = caseIdFromRow(row);
  const caseRecord = cases.find((item) => item.id === caseId);
  const title = asText(row.title ?? row.action_title ?? row.task ?? row.description);
  if (!caseRecord || !title) return null;

  const dueDateEpoch = rowEpoch(row, ["due_at", "due_date", "deadline"]);

  return {
    assignedOfficer: asText(row.assigned_officer ?? row.assigned_officer_name ?? row.owner ?? row.officer_name) || "Unassigned",
    caseId,
    caseReference: caseRecord.reference,
    dueDate: dueDateEpoch ? formatDateOrText(new Date(dueDateEpoch).toISOString()) : "No due date",
    dueDateValue: dueDateEpoch ? new Date(dueDateEpoch) : null,
    id: asText(row.id) || `${caseId}-${title}`,
    overdue: isOverdueAction(row),
    status: toTitleCase(asText(row.status ?? row.action_status) || "Open"),
    title,
  };
}

function normaliseForensicDependency(row: DataRow, cases: OversightCase[], now: number): ForensicDependency | null {
  const caseId = caseIdFromRow(row);
  const caseRecord = cases.find((item) => item.id === caseId);
  if (!caseRecord) return null;

  const waitEpoch = rowEpoch(row, ["submitted_at", "created_at", "requested_at"]);

  return {
    caseId,
    caseReference: caseRecord.reference,
    discipline: forensicDisciplineLabel(row.discipline ?? row.forensic_discipline ?? row.department ?? row.request_type),
    id: asText(row.id ?? row.request_id) || `${caseId}-forensic`,
    missingRequirements: asText(row.missing_requirements ?? row.requirements_missing ?? row.notes) || "No missing requirements noted.",
    status: toTitleCase(asText(row.status ?? row.request_status) || "Pending"),
    timeWaiting: waitEpoch ? `${formatWaitTime(waitEpoch, now)} waiting` : "Waiting time not available",
  };
}

function normaliseActivity(row: DataRow, cases: OversightCase[]): ActivityItem | null {
  const caseId = caseIdFromRow(row);
  const caseRecord = cases.find((item) => item.id === caseId);
  if (!caseRecord) return null;

  const timestampEpoch = rowEpoch(row, ["created_at", "timestamp", "event_at", "occurred_at"]);

  return {
    action: asText(row.action ?? row.event ?? row.activity ?? row.summary) || "Case activity recorded",
    actor: asText(row.actor ?? row.actor_name ?? row.created_by ?? row.officer_name) || "System",
    caseId,
    caseReference: caseRecord.reference,
    timestamp: timestampEpoch ? formatDateOrText(new Date(timestampEpoch).toISOString()) : "Not available",
    timestampDate: timestampEpoch ? new Date(timestampEpoch) : null,
  };
}

function buildAttentionQueue(
  cases: OversightCase[],
  context: {
    actionsByCase: Map<string, DataRow[]>;
    activityByCase: Map<string, DataRow[]>;
    analysesByCase: Map<string, DataRow[]>;
    now: number;
    requestsByCase: Map<string, DataRow[]>;
  },
): AttentionItem[] {
  return cases
    .map((caseRecord) => {
      const caseActions = context.actionsByCase.get(caseRecord.id) ?? [];
      const caseRequests = (context.requestsByCase.get(caseRecord.id) ?? []).filter(isPendingForensicStatus);
      const caseActivities = context.activityByCase.get(caseRecord.id) ?? [];
      const evidencePercent = caseRecord.evidenceCompleteness;
      const hasOverdue = caseActions.some((row) => isOverdueAction(row, context.now));
      const hasBlocked = caseActions.some((row) => normaliseText(asText(row.status ?? row.action_status)).includes("blocked"));
      const recentActivityEpoch = Math.max(
        caseRecord.lastActivityDate?.valueOf() ?? 0,
        ...caseActivities.map((row) => rowEpoch(row)),
      );
      const preparation = preparationStatusFromCaseContext({
        analyses: context.analysesByCase.get(caseRecord.id) ?? [],
        caseRow: {
          case_preparation_status: caseRecord.preparationStatus,
          evidence_completeness: evidencePercent,
        },
        evidencePercent,
        hasBlockedActions: hasBlocked,
        hasOverdueActions: hasOverdue,
        hasPendingForensics: caseRequests.length > 0,
        now: context.now,
        recentActivityEpoch,
      });

      const noRecentActivity = hasNoRecentActivity(caseRecord);
      const reasons = attentionReasons({
        evidencePercent,
        hasBlockedActions: hasBlocked,
        hasOverdueActions: hasOverdue,
        hasPendingForensics: caseRequests.length > 0,
        noRecentActivity,
        preparationStatus: preparation.status,
      });

      const rank = priorityRank({ priority: caseRecord.priority }, {
        blockedActionCount: hasBlocked ? 1 : 0,
        evidencePercent,
        hasMissingCriticalInformation: preparation.status === "Missing critical information",
        overdueActionCount: hasOverdue ? 1 : 0,
        recentActivityEpoch,
      });

      if (!reasons.length) {
        return {
          caseRecord: { ...caseRecord, preparationStatus: preparation.status },
          rank,
          reason: "No active risks",
        };
      }

      return {
        caseRecord: { ...caseRecord, preparationStatus: preparation.status },
        rank,
        reason: reasons[0].replace(/(^\w|\s\w)/g, (letter) => letter.toUpperCase()),
      };
    })
    .sort((a, b) => comparePriorityRanks(a.rank, b.rank));
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
    const count = cases.filter((caseRecord) => normaliseText(caseRecord.preparationStatus) === normaliseText(label)).length;

    return {
      count,
      label,
      percent: Math.round((count / total) * 100),
    };
  });
}

function EvidenceCompleteness({ value }: { value: number | null }) {
  if (value === null) return <span className="cases-muted-value">Not available</span>;

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

function sortByNewestActivity(a: ActivityItem, b: ActivityItem) {
  return (b.timestampDate?.valueOf() ?? 0) - (a.timestampDate?.valueOf() ?? 0);
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

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function currentEpoch() {
  return Date.now();
}
