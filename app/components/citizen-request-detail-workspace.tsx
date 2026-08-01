"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DemoCitizenRequestRecord } from "@/lib/demo-citizen-requests";
import { citizenPriorityLabel, citizenPublicStatusLabel, formatPublicDate } from "@/app/lib/citizen-request-domain";

export function CitizenRequestDetailWorkspace({
  request,
  readOnly = false,
}: {
  readOnly?: boolean;
  request: DemoCitizenRequestRecord;
}) {
  const [publicStatus, setPublicStatus] = useState<string>(request.publicStatus);
  const [internalStatus, setInternalStatus] = useState<string>(request.internalStatus);
  const [assignedOfficer, setAssignedOfficer] = useState<string>(request.assignedOfficer);
  const [station, setStation] = useState<string>(request.station);
  const [internalNotes, setInternalNotes] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [converted, setConverted] = useState<boolean>(request.convertedToCase);

  const timeline = useMemo(
    () => [
      {
        label: "Submitted",
        value: request.lastActivity,
      },
      {
        label: "Current public status",
        value: citizenPublicStatusLabel(publicStatus),
      },
    ],
    [publicStatus, request.lastActivity],
  );

  const updateStatus = (nextStatus: string) => {
    setInternalStatus(nextStatus);
    setPublicStatus(mapPublicStatus(nextStatus));
    setStatusNote("Demonstration status updated locally.");
  };

  const convertToCase = () => {
    const confirmed = window.confirm("Convert this citizen request into a case? This is a demonstration action only.");
    if (!confirmed) return;

    setConverted(true);
    setStatusNote("Demonstration action — no official case is created.");
    setPublicStatus("Referred for Action");
    setInternalStatus("referred_for_action");
  };

  return (
    <section className="citizen-request-detail-grid">
      <section className="citizen-card citizen-public-card">
        <p className="citizen-eyebrow">Citizen-Submitted Information</p>
        <h3>{request.reference}</h3>
        <dl className="citizen-definition-list">
          <div>
            <dt>Request Type</dt>
            <dd>{request.requestType}</dd>
          </div>
          <div>
            <dt>Title</dt>
            <dd>{request.title}</dd>
          </div>
          <div>
            <dt>Description</dt>
            <dd>{request.description}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{request.location}</dd>
          </div>
          <div>
            <dt>Submitted Date</dt>
            <dd>{formatPublicDate(request.submittedAt)}</dd>
          </div>
          <div>
            <dt>Public Status</dt>
            <dd>{citizenPublicStatusLabel(publicStatus)}</dd>
          </div>
          <div>
            <dt>Public Message</dt>
            <dd>{request.publicMessage}</dd>
          </div>
        </dl>
      </section>

      <section className="citizen-card citizen-internal-card">
        <p className="citizen-eyebrow">Internal Officer Review</p>
        <dl className="citizen-definition-list">
          <div>
            <dt>Priority</dt>
            <dd>{citizenPriorityLabel(request.priority)}</dd>
          </div>
          <div>
            <dt>Assigned Officer</dt>
            <dd>
              {readOnly ? assignedOfficer : (
                <input
                  aria-label="Assigned Officer"
                  onChange={(event) => setAssignedOfficer(event.target.value)}
                  value={assignedOfficer}
                />
              )}
            </dd>
          </div>
          <div>
            <dt>Station</dt>
            <dd>
              {readOnly ? station : (
                <input aria-label="Station" onChange={(event) => setStation(event.target.value)} value={station} />
              )}
            </dd>
          </div>
          <div>
            <dt>Internal Status</dt>
            <dd>{internalStatus}</dd>
          </div>
          <div>
            <dt>Last Activity</dt>
            <dd>{request.lastActivity}</dd>
          </div>
        </dl>

        {readOnly ? null : (
          <>
            <label className="citizen-field citizen-wide">
              <span>Internal Notes</span>
              <textarea onChange={(event) => setInternalNotes(event.target.value)} rows={4} value={internalNotes} />
            </label>

            <label className="citizen-field citizen-wide">
              <span>Update Status</span>
              <select onChange={(event) => updateStatus(event.target.value)} value={internalStatus}>
                <option value="submitted">submitted</option>
                <option value="under_review">under_review</option>
                <option value="additional_information_requested">additional_information_requested</option>
                <option value="referred_for_action">referred_for_action</option>
                <option value="closed">closed</option>
              </select>
            </label>

            <div className="citizen-form-actions">
              <button className="button button-primary" onClick={convertToCase} type="button">
                Convert to Case
              </button>
            </div>
            <p className="citizen-demo-action-note">Demonstration action — no official case is created.</p>
          </>
        )}

        {statusNote ? <p className="citizen-status-note">{statusNote}</p> : null}
      </section>

      <section className="citizen-card citizen-timeline-card citizen-wide">
        <p className="citizen-eyebrow">Activity Timeline</p>
        <ul className="citizen-timeline">
          {timeline.map((item) => (
            <li key={item.label}>
              <strong>{item.label}</strong>
              <span>{item.value}</span>
            </li>
          ))}
        </ul>
      </section>

      <Link className="button button-secondary citizen-wide" href="/citizen-requests">
        Back to Citizen Requests
      </Link>
      {converted ? <p className="citizen-demo-success">Demonstration case conversion complete.</p> : null}
    </section>
  );
}

function mapPublicStatus(status: string) {
  switch (status) {
    case "received":
      return "Received";
    case "under_review":
      return "Under Review";
    case "additional_information_requested":
      return "Additional Information Requested";
    case "referred_for_action":
      return "Referred for Action";
    case "closed":
      return "Closed";
    default:
      return "Submitted";
  }
}
