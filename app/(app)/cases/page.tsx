import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon, PageContainer } from "../../components/app-shell";
import { createServerComponentClient } from "@/lib/supabase/server";

type CasesPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    status?: string | string[];
    sort?: string | string[];
  }>;
};

type CaseRow = Record<string, unknown>;

type CaseRecord = {
  evidenceCompleteness: number | null;
  forensicStatus: string;
  forensicStatusRaw: string;
  id: string;
  lastActivity: string;
  lastActivityEpoch: number;
  priority: string;
  reference: string;
  status: string;
  statusRaw: string;
  title: string;
};

const statusFilters = [
  { label: "All", value: "" },
  { label: "Open", value: "open" },
  { label: "Needs Attention", value: "needs attention" },
  { label: "Awaiting Forensics", value: "awaiting forensics" },
  { label: "Ready for Review", value: "ready for review" },
  { label: "Resolved", value: "resolved" },
];

export default async function CasesPage({ searchParams }: CasesPageProps) {
  const params = await searchParams;
  const searchQuery = asSingleValue(params.q).trim();
  const selectedStatus = normaliseText(asSingleValue(params.status));
  const selectedSort = normaliseText(asSingleValue(params.sort));
  const supabase = await createServerComponentClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    redirect("/login");
  }

  const { data, error } = await supabase.schema("public").from("cases").select("*").limit(100);
  const cases = Array.isArray(data) ? data.map(normaliseCaseRow).filter(isPresent) : [];
  const visibleCases = sortCases(filterCases(cases, searchQuery, selectedStatus), selectedSort);

  return (
    <PageContainer
      eyebrow="Assigned case worklist"
      title="My Cases"
      description="Browse cases available to the signed-in officer through Supabase row-level security. Case visibility is determined by the database policy, not by client-side role assumptions."
      actions={
        <Link className="button button-primary app-primary-action" href="/cases/new">
          <Icon name="plus" />
          Create Case
        </Link>
      }
    >
      <section className="cases-worklist dashboard-card" aria-labelledby="cases-worklist-heading">
        <div className="dashboard-card-header cases-worklist-header">
          <div>
            <p>Authorized records</p>
            <h3 id="cases-worklist-heading">Assigned case list</h3>
          </div>
          <span className="cases-result-count">
            {error ? "Unavailable" : `${visibleCases.length} shown`}
          </span>
        </div>

        <div className="cases-filter-panel">
          <form action="/cases" className="cases-search-form">
            <label className="cases-search-field">
              <span>Search cases</span>
              <input
                defaultValue={searchQuery}
                name="q"
                placeholder="Search by case reference or title"
                type="search"
              />
            </label>
            {selectedStatus ? <input name="status" type="hidden" value={selectedStatus} /> : null}
            {selectedSort ? <input name="sort" type="hidden" value={selectedSort} /> : null}
            <button className="app-link-button" type="submit">
              Search
              <Icon name="filter" />
            </button>
            {searchQuery || selectedStatus ? (
              <Link className="app-link-button subtle" href="/cases">
                Clear
              </Link>
            ) : null}
          </form>

          <nav className="cases-status-filter" aria-label="Filter cases by status">
            {statusFilters.map((item) => {
              const isActive = selectedStatus === item.value || (!selectedStatus && !item.value);

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={isActive ? "active" : undefined}
                  href={buildCasesHref(searchQuery, item.value, selectedSort || "last-activity")}
                  key={item.label}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <nav className="cases-status-filter" aria-label="Sort case results">
            {[
              ["Priority", "priority"],
              ["Last activity", "last-activity"],
              ["Evidence completeness", "evidence"],
              ["Forensic status", "forensic"],
              ["Case reference", "reference"],
            ].map(([label, value]) => {
              const isActive = selectedSort === value || (!selectedSort && value === "last-activity");

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={isActive ? "active" : undefined}
                  href={buildCasesHref(searchQuery, selectedStatus, value)}
                  key={label}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        {error ? (
          <CasesState
            icon="alert"
            title="Unable to load assigned cases."
            body="Please try again after confirming the signed-in account still has access."
          />
        ) : visibleCases.length ? (
          <div className="priority-table-wrap cases-table-wrap">
            <table className="priority-case-table cases-table">
              <caption>Supabase case records visible to the signed-in officer through RLS.</caption>
              <thead>
                <tr>
                  <th>Case reference</th>
                  <th>Title</th>
                  <th>Case status</th>
                  <th>Priority</th>
                  <th>Last activity</th>
                  <th>Evidence</th>
                  <th>Forensic request status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleCases.map((record) => (
                  <tr key={record.id}>
                    <td data-label="Case reference">
                      <Link href={`/cases/${encodeURIComponent(record.id)}`}>
                        <span>{record.reference}</span>
                      </Link>
                    </td>
                    <td data-label="Title">
                      <strong className="cases-title-cell" title={record.title}>{record.title}</strong>
                    </td>
                    <td data-label="Status">
                      <span className={`status-badge status-${statusTone(record.statusRaw)}`}>
                        {record.status}
                      </span>
                    </td>
                    <td data-label="Priority">
                      <span className={`priority-chip priority-${priorityTone(record.priority)}`}>
                        {record.priority}
                      </span>
                    </td>
                    <td data-label="Last activity">{record.lastActivity}</td>
                    <td data-label="Evidence">
                      <EvidenceCompleteness value={record.evidenceCompleteness} />
                    </td>
                    <td data-label="Forensics">{record.forensicStatus}</td>
                    <td data-label="Action">
                      <Link className="app-link-button subtle cases-open-button" href={`/cases/${encodeURIComponent(record.id)}`}>
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
          <CasesState
            icon="briefcase"
            title="No assigned cases found."
            body="Cases appear when the signed-in officer has active authorised assignments through RLS."
          />
        )}
      </section>
    </PageContainer>
  );
}

function CasesState({
  body,
  icon,
  title,
}: {
  body: string;
  icon: "alert" | "briefcase";
  title: string;
}) {
  return (
    <div className="cases-state">
      <Icon name={icon} />
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function EvidenceCompleteness({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="cases-muted-value">Not recorded</span>;
  }

  return (
    <div className="readiness-cell compact-readiness">
      <span>
        <i style={{ width: `${value}%` }} />
      </span>
      <strong>{value}%</strong>
    </div>
  );
}

function normaliseCaseRow(row: CaseRow): CaseRecord | null {
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

  if (!id) return null;

  return {
    evidenceCompleteness: asPercentage(
      row.evidence_completeness ??
        row.evidenceCompleteness ??
        row.evidence_readiness ??
        row.preparation_progress,
    ),
    forensicStatusRaw: asText(row.forensic_status ?? row.forensicStatus ?? row.forensics_status) || "not_available",
    forensicStatus: toTitleCase(
      asText(row.forensic_status ?? row.forensicStatus ?? row.forensics_status) || "Not available",
    ),
    id,
    lastActivity: formatLastActivity(
      row.last_activity ?? row.lastActivity ?? row.last_activity_at ?? row.updated_at ?? row.created_at,
    ),
    lastActivityEpoch: parseEpoch(
      row.last_activity ?? row.lastActivity ?? row.last_activity_at ?? row.updated_at ?? row.created_at,
    ),
    priority: toTitleCase(asText(row.priority) || "Unassigned"),
    reference: reference || id || "Unreferenced",
    statusRaw: asText(row.status ?? row.case_status) || "open",
    status: toTitleCase(asText(row.status ?? row.case_status) || "Open"),
    title: title || "Untitled case",
  };
}

function filterCases(cases: CaseRecord[], searchQuery: string, selectedStatus: string) {
  const normalisedSearch = normaliseText(searchQuery);

  return cases.filter((record) => {
    const matchesSearch =
      !normalisedSearch ||
      normaliseText(record.reference).includes(normalisedSearch) ||
      normaliseText(record.title).includes(normalisedSearch);
    const matchesStatus = !selectedStatus || normaliseText(record.status) === selectedStatus;

    return matchesSearch && matchesStatus;
  });
}

function sortCases(cases: CaseRecord[], sort: string) {
  const result = [...cases];

  if (sort === "priority") {
    const rank = { high: 3, medium: 2, low: 1 };
    return result.sort((a, b) => {
      const aRank = rank[normaliseText(a.priority) as keyof typeof rank] ?? 0;
      const bRank = rank[normaliseText(b.priority) as keyof typeof rank] ?? 0;
      return bRank - aRank;
    });
  }

  if (sort === "evidence") {
    return result.sort((a, b) => (b.evidenceCompleteness ?? -1) - (a.evidenceCompleteness ?? -1));
  }

  if (sort === "forensic") {
    return result.sort((a, b) => a.forensicStatus.localeCompare(b.forensicStatus));
  }

  if (sort === "reference") {
    return result.sort((a, b) => a.reference.localeCompare(b.reference));
  }

  return result.sort((a, b) => b.lastActivityEpoch - a.lastActivityEpoch);
}

function buildCasesHref(searchQuery: string, status: string, sort?: string) {
  const params = new URLSearchParams();

  if (searchQuery) params.set("q", searchQuery);
  if (status) params.set("status", status);
  if (sort) params.set("sort", sort);

  const query = params.toString();
  return query ? `/cases?${query}` : "/cases";
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

function formatLastActivity(value: unknown) {
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

function parseEpoch(value: unknown) {
  const text = asText(value);
  if (!text) return 0;
  const epoch = Date.parse(text);
  return Number.isFinite(epoch) ? epoch : 0;
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
  if (value.includes("attention") || value.includes("incomplete") || value.includes("urgent")) return "attention";
  if (value.includes("forensic") || value.includes("lab")) return "forensics";
  if (value.includes("ready")) return "ready";
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
