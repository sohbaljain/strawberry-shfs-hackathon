import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Icon, PageContainer } from "../../../components/app-shell";
import { createServerComponentClient } from "@/lib/supabase/server";

type CaseDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ verification?: string | string[] }>;
};

type DataRow = Record<string, unknown>;

type CaseRecord = {
  assignedOfficer: string;
  district: string;
  evidenceCompleteness: number | null;
  forensicStatus: string;
  id: string;
  latestActivity: string;
  policeStation: string;
  preparationStatus: string;
  priority: string;
  reference: string;
  status: string;
  title: string;
  verificationStatus: string;
};

type TimelineItem = {
  dateTime: string;
  event: string;
  source: string;
  verificationStatus: string;
};

type ContradictionItem = {
  detail: string;
  topic: string;
};

type ForensicRequestItem = {
  discipline: string;
  exhibitIdentifiers: string;
  id: string;
  missingRequirements: string;
  status: string;
};

type CaseActionItem = {
  assignedOfficer: string;
  dueDate: string;
  status: string;
  title: string;
};

type ActivityLogItem = {
  action: string;
  actor: string;
  timestamp: string;
};

type EvidenceInventory = {
  atRisk: string[];
  available: string[];
  chainOfCustodyIssues: string[];
  requiringVerification: string[];
};

type AnalysisPreview = {
  contradictions: ContradictionItem[];
  missingInformation: string[];
  status: "available" | "no-analysis" | "not-validated";
};

const AI_WARNING =
  "AI-assisted observations may contain errors. All findings require verification by an authorised officer and do not determine guilt, innocence, arrest, bail, or sentencing.";

export default async function CaseDetailPage({ params, searchParams }: CaseDetailPageProps) {
  const { id } = await params;
  const feedback = asSingleValue((await searchParams).verification);
  const routeId = decodeURIComponent(id);
  const supabase = await createServerComponentClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    redirect("/login");
  }

  const { data: caseData, error: caseError } = await supabase
    .schema("public")
    .from("cases")
    .select("*")
    .eq("id", routeId)
    .maybeSingle();

  if (caseError || !caseData) {
    return (
      <PageContainer
        eyebrow="Case workspace"
        title="Case unavailable"
        description="The requested case could not be opened with the current signed-in session."
        actions={
          <Link className="app-link-button subtle" href="/cases">
            Back to My Cases
            <Icon name="arrow" />
          </Link>
        }
      >
        <section className="dashboard-card cases-state case-access-state">
          <Icon name="alert" />
          <strong>Case not found or access is not authorised.</strong>
          <p>CaseFlow AI relies on Supabase row-level security for this workspace.</p>
        </section>
      </PageContainer>
    );
  }

  const caseRow = caseData as DataRow;
  const caseId = asText(caseRow.id) || routeId;
  const [assignmentRows, analysisRows, actionRows, forensicRows, activityRows] = await Promise.all([
    fetchCaseRows(supabase, "case_assignments", caseId, 8),
    fetchCaseRows(supabase, "case_analyses", caseId, 6),
    fetchCaseRows(supabase, "case_actions", caseId, 8),
    fetchCaseRows(supabase, "forensic_requests", caseId, 8),
    fetchCaseRows(supabase, "case_activity", caseId, 12),
  ]);

  const caseRecord = normaliseCase(caseRow, assignmentRows);
  const analysisPreview = normaliseLatestAnalysis(analysisRows);
  const timelineItems = normaliseTimeline(activityRows).slice(0, 5);
  const activityLog = normaliseActivityLog(activityRows).slice(0, 6);
  const evidenceInventory = normaliseEvidenceInventory(caseRow);
  const forensicRequests = forensicRows.map(normaliseForensicRequest).filter(isPresent);
  const assignedActions = actionRows.map(normaliseCaseAction).filter(isPresent);

  return (
    <PageContainer
      eyebrow="Operational case workspace"
      title={caseRecord.reference}
      description={caseRecord.title}
      actions={
        <>
          <Link className="app-link-button subtle" href="/cases">
            Back to My Cases
            <Icon name="arrow" />
          </Link>
          <Link className="button button-primary app-primary-action" href={`/analysis/${encodeURIComponent(caseId)}`}>
            <Icon name="activity" />
            View AI Analysis
          </Link>
        </>
      }
    >
      <section className="case-detail-header dashboard-card">
        <div>
          <span className="case-detail-reference">{caseRecord.reference}</span>
          <h3>{caseRecord.title}</h3>
          <p>Operational records are kept separate from advisory AI observations.</p>
        </div>
        <div className="case-detail-badges">
          <span className={`status-badge status-${statusTone(caseRecord.status)}`}>
            {caseRecord.status}
          </span>
          <span className={`priority-chip priority-${priorityTone(caseRecord.priority)}`}>
            {caseRecord.priority}
          </span>
        </div>
      </section>

      <section className="case-ai-warning dashboard-card" role="note">
        <Icon name="alert" />
        <span>{AI_WARNING}</span>
      </section>

      {feedback ? <VerificationFeedback status={feedback} /> : null}

      <section className="case-detail-grid">
        <CaseOverviewCard caseRecord={caseRecord} />
        <TimelinePreview items={timelineItems} />
        <AnalysisPreviewCard analysis={analysisPreview} />
        <MissingInformationCard items={analysisPreview.missingInformation} />
        <EvidenceInventoryCard inventory={evidenceInventory} />
        <ForensicRequestsCard caseId={caseId} requests={forensicRequests} />
        <AssignedActionsCard actions={assignedActions} />
        <ActivityLogCard items={activityLog} />
        <OfficerVerificationCard caseId={caseId} status={caseRecord.verificationStatus} />
      </section>
    </PageContainer>
  );
}

async function updateOfficerVerification(formData: FormData) {
  "use server";

  const caseId = asText(formData.get("caseId"));
  const status = asText(formData.get("status"));

  if (!caseId || !["Reviewed", "Needs Clarification"].includes(status)) {
    redirect("/cases?verification=invalid");
  }

  const supabase = await createServerComponentClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    redirect("/login");
  }

  const { error } = await supabase
    .schema("public")
    .from("cases")
    .update({ officer_verification_status: status })
    .eq("id", caseId);

  revalidatePath(`/cases/${caseId}`);
  redirect(`/cases/${encodeURIComponent(caseId)}?verification=${error ? "blocked" : "updated"}`);
}

function CaseOverviewCard({ caseRecord }: { caseRecord: CaseRecord }) {
  const overviewItems = [
    ["Assigned officer", caseRecord.assignedOfficer],
    ["Police station", caseRecord.policeStation],
    ["District", caseRecord.district],
    ["Latest activity", caseRecord.latestActivity],
    ["Forensic status", caseRecord.forensicStatus],
    ["Case-preparation status", caseRecord.preparationStatus],
  ];

  return (
    <section className="dashboard-card case-detail-card case-overview-card">
      <CardHeader eyebrow="Case overview" title="Operational summary" icon="briefcase" />
      <div className="case-overview-grid">
        {overviewItems.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
        <div>
          <span>Evidence completeness</span>
          <EvidenceCompleteness value={caseRecord.evidenceCompleteness} />
        </div>
      </div>
    </section>
  );
}

function TimelinePreview({ items }: { items: TimelineItem[] }) {
  return (
    <section className="dashboard-card case-detail-card">
      <CardHeader eyebrow="Timeline preview" title="Latest 5 case events" icon="activity" />
      {items.length ? (
        <ol className="case-timeline-list">
          {items.map((item, index) => (
            <li key={`${item.dateTime}-${item.event}-${index}`}>
              <time>{item.dateTime}</time>
              <div>
                <strong>{item.event}</strong>
                <p>{item.source}</p>
              </div>
              <span>{item.verificationStatus}</span>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyDetailState>No timeline events recorded.</EmptyDetailState>
      )}
      <div className="case-card-footer">
        <Link className="app-link-button subtle" href="#activity-log">
          View full timeline
          <Icon name="arrow" />
        </Link>
      </div>
    </section>
  );
}

function AnalysisPreviewCard({ analysis }: { analysis: AnalysisPreview }) {
  return (
    <section className="dashboard-card case-detail-card advisory-analysis-card">
      <CardHeader
        eyebrow="Advisory layer"
        title="Key contradictions"
        icon="layers"
      />
      <div className="case-advisory-note">
        <Icon name="alert" />
        <span>These accounts differ and require human verification.</span>
      </div>
      {analysis.status === "no-analysis" ? (
        <EmptyDetailState>No AI analysis has been generated yet.</EmptyDetailState>
      ) : analysis.status === "not-validated" ? (
        <EmptyDetailState>No validated AI analysis is available yet.</EmptyDetailState>
      ) : analysis.contradictions.length ? (
        <div className="case-contradiction-list">
          {analysis.contradictions.map((item, index) => (
            <article key={`${item.topic}-${index}`}>
              <strong>{item.topic}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      ) : (
        <EmptyDetailState>No contradictions recorded in the latest validated analysis.</EmptyDetailState>
      )}
    </section>
  );
}

function MissingInformationCard({ items }: { items: string[] }) {
  return (
    <section className="dashboard-card case-detail-card">
      <CardHeader eyebrow="Advisory layer" title="Missing information" icon="clipboard" />
      {items.length ? <CompactList items={items} /> : <EmptyDetailState>No missing information recorded.</EmptyDetailState>}
    </section>
  );
}

function EvidenceInventoryCard({ inventory }: { inventory: EvidenceInventory }) {
  return (
    <section className="dashboard-card case-detail-card case-span-2">
      <CardHeader eyebrow="Evidence inventory" title="Operational evidence status" icon="layers" />
      <div className="case-evidence-grid">
        <EvidenceColumn title="Available evidence" items={inventory.available} />
        <EvidenceColumn title="Requires verification" items={inventory.requiringVerification} />
        <EvidenceColumn title="Evidence at risk" items={inventory.atRisk} />
        <EvidenceColumn title="Chain-of-custody issues" items={inventory.chainOfCustodyIssues} />
      </div>
    </section>
  );
}

function ForensicRequestsCard({
  caseId,
  requests,
}: {
  caseId: string;
  requests: ForensicRequestItem[];
}) {
  return (
    <section className="dashboard-card case-detail-card case-span-2" id="forensic-requests">
      <CardHeader eyebrow="Forensic requests" title="Request readiness" icon="file" />
      {requests.length ? (
        <div className="case-request-list">
          {requests.map((request) => (
            <article id={`forensic-request-${request.id}`} key={request.id}>
              <div>
                <strong>{request.discipline}</strong>
                <p>{request.exhibitIdentifiers}</p>
              </div>
              <span className={`status-badge status-${statusTone(request.status)}`}>
                {request.status}
              </span>
              <p>{request.missingRequirements}</p>
              <Link className="app-link-button subtle" href={`/cases/${encodeURIComponent(caseId)}#forensic-request-${request.id}`}>
                Open Forensic Request
                <Icon name="arrow" />
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <EmptyDetailState>No forensic requests recorded.</EmptyDetailState>
      )}
    </section>
  );
}

function AssignedActionsCard({ actions }: { actions: CaseActionItem[] }) {
  return (
    <section className="dashboard-card case-detail-card">
      <CardHeader eyebrow="Assigned actions" title="Open operational tasks" icon="check" />
      {actions.length ? (
        <div className="case-action-list">
          {actions.map((item, index) => (
            <article key={`${item.title}-${index}`}>
              <strong>{item.title}</strong>
              <p>{item.assignedOfficer}</p>
              <div>
                <span>{item.dueDate}</span>
                <span className={`status-badge status-${statusTone(item.status)}`}>{item.status}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyDetailState>No assigned actions recorded.</EmptyDetailState>
      )}
    </section>
  );
}

function ActivityLogCard({ items }: { items: ActivityLogItem[] }) {
  return (
    <section className="dashboard-card case-detail-card" id="activity-log">
      <CardHeader eyebrow="Activity log" title="Latest case activity" icon="activity" />
      {items.length ? (
        <div className="case-activity-log">
          {items.map((item, index) => (
            <article key={`${item.timestamp}-${item.action}-${index}`}>
              <div>
                <strong>{item.action}</strong>
                <p>{item.actor}</p>
              </div>
              <time>{item.timestamp}</time>
            </article>
          ))}
        </div>
      ) : (
        <EmptyDetailState>No activity recorded.</EmptyDetailState>
      )}
    </section>
  );
}

function OfficerVerificationCard({ caseId, status }: { caseId: string; status: string }) {
  return (
    <section className="dashboard-card case-detail-card officer-verification-card">
      <CardHeader eyebrow="Officer verification" title="Review status" icon="shield" />
      <div className="officer-verification-body">
        <span>Current verification status</span>
        <strong>{status}</strong>
        <form action={updateOfficerVerification}>
          <input name="caseId" type="hidden" value={caseId} />
          <button className="button button-primary" name="status" type="submit" value="Reviewed">
            Mark as Reviewed
          </button>
          <button className="button button-secondary" name="status" type="submit" value="Needs Clarification">
            Needs Clarification
          </button>
        </form>
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
  icon: "activity" | "briefcase" | "check" | "clipboard" | "file" | "layers" | "shield";
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

function EvidenceColumn({ items, title }: { items: string[]; title: string }) {
  return (
    <article>
      <strong>{title}</strong>
      {items.length ? <CompactList items={items} /> : <p>No records supplied.</p>}
    </article>
  );
}

function CompactList({ items }: { items: string[] }) {
  return (
    <ul className="case-compact-list">
      {items.slice(0, 6).map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

function EmptyDetailState({ children }: { children: string }) {
  return <p className="case-detail-empty">{children}</p>;
}

function VerificationFeedback({ status }: { status: string }) {
  const isUpdated = status === "updated";
  const message = isUpdated
    ? "Verification status updated."
    : "Verification update was not saved. The signed-in user may not be authorised to update this case.";

  return (
    <div className={`case-verification-feedback ${isUpdated ? "success" : "warning"}`} role="status">
      <Icon name={isUpdated ? "check" : "alert"} />
      <span>{message}</span>
    </div>
  );
}

async function fetchCaseRows(
  supabase: Awaited<ReturnType<typeof createServerComponentClient>>,
  table: string,
  caseId: string,
  limit: number,
) {
  const orderedResult = await supabase
    .schema("public")
    .from(table)
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!orderedResult.error && Array.isArray(orderedResult.data)) {
    return orderedResult.data as DataRow[];
  }

  const fallbackResult = await supabase
    .schema("public")
    .from(table)
    .select("*")
    .eq("case_id", caseId)
    .limit(limit);

  if (fallbackResult.error || !Array.isArray(fallbackResult.data)) return [];

  return fallbackResult.data as DataRow[];
}

function normaliseCase(row: DataRow, assignments: DataRow[]): CaseRecord {
  const assignmentOfficer =
    assignments.map(normaliseAssignedOfficer).find((value) => value !== "Not recorded") ?? "";
  const id = asText(row.id);
  const reference = asText(
    row.case_reference ??
      row.caseReference ??
      row.reference ??
      row.fictional_case_number ??
      row.fir_number ??
      row.case_number,
  );

  return {
    assignedOfficer:
      asText(
        row.assigned_officer ??
          row.assignedOfficer ??
          row.assigned_officer_name ??
          row.investigating_officer,
      ) ||
      assignmentOfficer ||
      "Not recorded",
    district: asText(row.district ?? row.district_name) || "Not recorded",
    evidenceCompleteness: asPercentage(
      row.evidence_completeness ??
        row.evidenceCompleteness ??
        row.evidence_readiness ??
        row.preparation_progress,
    ),
    forensicStatus:
      asText(row.forensic_status ?? row.forensicStatus ?? row.forensics_status) || "Not recorded",
    id,
    latestActivity: formatDateOrText(
      row.last_activity ?? row.lastActivity ?? row.last_activity_at ?? row.updated_at ?? row.created_at,
    ),
    policeStation:
      asText(row.police_station ?? row.policeStation ?? row.police_station_name) || "Not recorded",
    preparationStatus:
      asText(row.case_preparation_status ?? row.preparation_status ?? row.preparationStatus) ||
      "Not recorded",
    priority: toTitleCase(asText(row.priority) || "Unassigned"),
    reference: reference || id || "Unreferenced case",
    status: toTitleCase(asText(row.status) || "Open"),
    title: asText(row.title ?? row.case_title ?? row.caseTitle) || "Untitled case",
    verificationStatus:
      asText(row.officer_verification_status ?? row.verification_status ?? row.review_status) ||
      "Not reviewed",
  };
}

function normaliseAssignedOfficer(row: DataRow) {
  return (
    asText(row.officer_name ?? row.assigned_officer_name ?? row.assigned_officer ?? row.name) ||
    "Not recorded"
  );
}

function normaliseTimeline(rows: DataRow[]): TimelineItem[] {
  return rows.map((row) => ({
    dateTime: formatDateOrText(row.event_at ?? row.occurred_at ?? row.created_at ?? row.timestamp),
    event:
      asText(row.event ?? row.event_title ?? row.action ?? row.activity ?? row.summary) ||
      "Case activity recorded",
    source: asText(row.source ?? row.record_source ?? row.module) || "Case activity",
    verificationStatus:
      asText(row.verification_status ?? row.review_status ?? row.status) || "Not recorded",
  }));
}

function normaliseActivityLog(rows: DataRow[]): ActivityLogItem[] {
  return rows.map((row) => ({
    action: asText(row.action ?? row.event ?? row.activity ?? row.summary) || "Case activity recorded",
    actor: asText(row.actor ?? row.actor_name ?? row.created_by ?? row.officer_name) || "Not recorded",
    timestamp: formatDateOrText(row.created_at ?? row.timestamp ?? row.event_at ?? row.occurred_at),
  }));
}

function normaliseLatestAnalysis(rows: DataRow[]): AnalysisPreview {
  if (!rows.length) {
    return { contradictions: [], missingInformation: [], status: "no-analysis" };
  }

  const validatedRow = rows.find(isValidatedAnalysis);

  if (!validatedRow) {
    return { contradictions: [], missingInformation: [], status: "not-validated" };
  }

  const payload = parseAnalysisPayload(validatedRow);
  const contradictions = toArray(payload?.contradictions).map(normaliseContradiction).filter(isPresent);
  const missingInformation = toStringArray(payload?.missingInformation ?? payload?.missing_information);

  return {
    contradictions,
    missingInformation,
    status: "available",
  };
}

function isValidatedAnalysis(row: DataRow) {
  const validationText = normaliseText(
    asText(row.validation_status ?? row.review_status ?? row.status ?? row.analysis_status),
  );

  return (
    row.validated === true ||
    row.is_validated === true ||
    validationText.includes("validated") ||
    validationText.includes("approved") ||
    validationText.includes("verified")
  );
}

function parseAnalysisPayload(row: DataRow): DataRow | null {
  const value =
    row.analysis_json ??
    row.structured_json ??
    row.structured_output ??
    row.analysis ??
    row.result ??
    row.report_json ??
    row.output ??
    row.response;

  if (isRecord(value)) return value;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return null;
}

function normaliseContradiction(value: unknown): ContradictionItem | null {
  if (!isRecord(value)) {
    const text = asText(value);
    return text ? { detail: text, topic: "Statement difference" } : null;
  }

  const topic = asText(value.topic ?? value.title ?? value.issue) || "Statement difference";
  const detail =
    asText(value.observation ?? value.detail ?? value.summary ?? value.description) ||
    [value.accountA, value.accountB, value.account_a, value.account_b].map(asText).filter(Boolean).join(" / ");

  return detail ? { detail, topic } : null;
}

function normaliseEvidenceInventory(row: DataRow): EvidenceInventory {
  return {
    atRisk: toStringArray(row.evidence_at_risk ?? row.at_risk_evidence),
    available: toStringArray(
      row.available_evidence ??
        row.evidence_available ??
        row.physical_evidence ??
        row.digital_evidence ??
        row.evidence,
    ),
    chainOfCustodyIssues: toStringArray(
      row.chain_of_custody_issues ?? row.chain_of_custody_notes ?? row.custody_issues,
    ),
    requiringVerification: toStringArray(
      row.evidence_requiring_verification ?? row.evidence_to_verify ?? row.unverified_evidence,
    ),
  };
}

function normaliseForensicRequest(row: DataRow): ForensicRequestItem | null {
  const id = asText(row.id ?? row.request_id) || createDisplayId("forensic", row);
  const discipline = asText(row.discipline ?? row.forensic_discipline ?? row.department ?? row.request_type);

  if (!discipline && !asText(row.status)) return null;

  return {
    discipline: discipline || "Forensic request",
    exhibitIdentifiers:
      asText(row.exhibit_identifiers ?? row.exhibits ?? row.exhibit_ids ?? row.serial_numbers) ||
      "Not recorded",
    id,
    missingRequirements:
      asText(row.missing_requirements ?? row.requirements_missing ?? row.notes) || "No missing requirements recorded.",
    status: toTitleCase(asText(row.status ?? row.request_status) || "Not recorded"),
  };
}

function normaliseCaseAction(row: DataRow): CaseActionItem | null {
  const title = asText(row.title ?? row.action_title ?? row.task ?? row.description);

  if (!title) return null;

  return {
    assignedOfficer:
      asText(row.assigned_officer ?? row.assigned_officer_name ?? row.owner ?? row.officer_name) ||
      "Not recorded",
    dueDate: formatDateOrText(row.due_date ?? row.due_at ?? row.deadline),
    status: toTitleCase(asText(row.status) || "Open"),
    title,
  };
}

function asSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function asText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function asPercentage(value: unknown) {
  const numericValue =
    typeof value === "number" ? value : Number.parseFloat(asText(value).replace("%", ""));

  if (!Number.isFinite(numericValue)) return null;

  return Math.min(100, Math.max(0, Math.round(numericValue)));
}

function formatDateOrText(value: unknown) {
  const text = asText(value);
  if (!text) return "Not recorded";

  const date = new Date(text);
  const looksLikeDate = Number.isFinite(date.valueOf()) && /\d{4}-\d{2}-\d{2}|T\d{2}:/.test(text);

  if (!looksLikeDate) return text;

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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

function statusTone(status: string) {
  const value = normaliseText(status);
  if (value.includes("attention") || value.includes("clarification") || value.includes("urgent")) {
    return "attention";
  }
  if (value.includes("forensic") || value.includes("lab") || value.includes("pending")) {
    return "forensics";
  }
  if (value.includes("ready") || value.includes("reviewed")) return "ready";
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

function toArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(asText).filter(Boolean);
  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, item]) => `${toTitleCase(key)}: ${asText(item)}`)
      .filter((item) => !item.endsWith(": "));
  }

  const text = asText(value);
  if (!text) return [];

  return text
    .split(/\n|;|\|/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isRecord(value: unknown): value is DataRow {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function createDisplayId(prefix: string, row: DataRow) {
  return `${prefix}-${asText(row.created_at ?? row.discipline ?? row.status) || "item"}`.replace(/[^a-zA-Z0-9_-]/g, "-");
}
