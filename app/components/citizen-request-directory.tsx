"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DemoCitizenRequest } from "@/lib/demo-citizen-requests";
import { citizenPriorityLabel, citizenPublicStatusLabel, formatPublicDate } from "@/app/lib/citizen-request-domain";

export function CitizenRequestDirectory({ requests }: { requests: DemoCitizenRequest[] }) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [actionMessage, setActionMessage] = useState("");

  const typeOptions = useMemo(() => uniqueValues(requests.map((request) => request.requestType)), [requests]);
  const statusOptions = useMemo(() => uniqueValues(requests.map((request) => request.publicStatus)), [requests]);
  const priorityOptions = useMemo(() => uniqueValues(requests.map((request) => request.priority)), [requests]);

  const filteredRequests = useMemo(() => {
    const search = query.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesSearch =
        !search ||
        request.reference.toLowerCase().includes(search) ||
        request.title.toLowerCase().includes(search);
      const matchesType = typeFilter === "all" || request.requestType === typeFilter;
      const matchesStatus = statusFilter === "all" || request.publicStatus === statusFilter;
      const matchesPriority = priorityFilter === "all" || request.priority === priorityFilter;

      return matchesSearch && matchesType && matchesStatus && matchesPriority;
    });
  }, [priorityFilter, query, requests, statusFilter, typeFilter]);

  const summary = useMemo(() => {
    const total = requests.length;
    const underReview = requests.filter((request) => request.publicStatus === "Under Review").length;
    const awaitingInformation = requests.filter((request) => request.publicStatus === "Additional Information Requested").length;
    const referredForAction = requests.filter((request) => request.publicStatus === "Referred for Action").length;

    return [
      { label: "Total Requests", value: total },
      { label: "Under Review", value: underReview },
      { label: "Awaiting Information", value: awaitingInformation },
      { label: "Referred for Action", value: referredForAction },
    ];
  }, [requests]);

  return (
    <section className="citizen-stack citizen-request-directory">
      <p className="citizen-demo-label">Demonstration citizen request data</p>

      <section className="citizen-request-summary-grid">
        {summary.map((item) => (
          <article className="citizen-card citizen-summary-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="citizen-card citizen-filter-card">
        <div className="citizen-filter-grid">
          <label className="citizen-field">
            <span>Search by reference or title</span>
            <input onChange={(event) => setQuery(event.target.value)} value={query} />
          </label>

          <label className="citizen-field">
            <span>Request type</span>
            <select onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}>
              <option value="all">All</option>
              {typeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="citizen-field">
            <span>Status</span>
            <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="all">All</option>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="citizen-field">
            <span>Priority</span>
            <select onChange={(event) => setPriorityFilter(event.target.value)} value={priorityFilter}>
              <option value="all">All</option>
              {priorityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {actionMessage ? <div className="citizen-notice citizen-notice-info">{actionMessage}</div> : null}

      <section className="citizen-card citizen-directory-card">
        {filteredRequests.length ? (
          <div className="priority-table-wrap citizen-request-table-wrap">
            <table className="priority-case-table citizen-request-table">
              <caption>Citizen requests available in the hardcoded demonstration dataset.</caption>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Assigned Officer</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((request) => (
                  <tr key={request.id}>
                    <td data-label="Reference">
                      <strong>{request.reference}</strong>
                    </td>
                    <td data-label="Type">{request.requestType}</td>
                    <td data-label="Title">{request.title}</td>
                    <td data-label="Submitted">{formatPublicDate(request.submittedAt)}</td>
                    <td data-label="Status">{citizenPublicStatusLabel(request.publicStatus)}</td>
                    <td data-label="Priority">{citizenPriorityLabel(request.priority)}</td>
                    <td data-label="Assigned Officer">{request.assignedOfficer}</td>
                    <td data-label="Action">
                      <div className="citizen-table-actions">
                        <Link className="app-link-button" href={`/citizen-requests/${request.id}`}>
                          View Request
                        </Link>
                        <button className="app-link-button subtle" onClick={() => setActionMessage(`Marked ${request.reference} as reviewed in the demo view.`)} type="button">
                          Mark as Reviewed
                        </button>
                        <button className="app-link-button subtle" onClick={() => setActionMessage(`Requested more information for ${request.reference} in the demo view.`)} type="button">
                          Request Information
                        </button>
                        <button className="app-link-button subtle" onClick={() => setActionMessage(`Internal note added for ${request.reference} in the demo view.`)} type="button">
                          Add Internal Note
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="citizen-empty-state">
            No citizen requests match the current filters.
          </div>
        )}
      </section>
    </section>
  );
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}
