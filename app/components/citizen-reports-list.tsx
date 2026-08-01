"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { clearCitizenDemoReports, loadCitizenDemoReports } from "@/app/lib/citizen-demo-storage";
import { CitizenEmergencyWarning, CitizenPortalDisclosure } from "./citizen-notices";

export function CitizenReportsList() {
  const [reports, setReports] = useState(() => loadCitizenDemoReports());
  const reportCount = reports.length;

  const hasReports = useMemo(() => reportCount > 0, [reportCount]);

  const clearReports = () => {
    const confirmed = window.confirm("Clear all demonstration reports saved on this device?");
    if (!confirmed) return;
    clearCitizenDemoReports();
    setReports([]);
  };

  return (
    <section className="citizen-stack">
      <CitizenPortalDisclosure />
      <CitizenEmergencyWarning />

      <section className="dashboard-card citizen-reference-card">
        <h3>My device reports</h3>
        <p>{reportCount} report(s) stored on this device.</p>
        <div className="citizen-form-actions">
          <Link className="button button-secondary" href="/citizen/report">
            New report
          </Link>
          <button className="button button-secondary" type="button" onClick={clearReports}>
            Clear demonstration reports
          </button>
        </div>
      </section>

      {hasReports ? (
        <section className="dashboard-card">
          <div className="citizen-list">
            {reports.map((report) => (
              <article key={report.id} className="citizen-list-item">
                <div>
                  <p>{report.category}</p>
                  <h4>{report.reference}</h4>
                  <p>{report.approximateArea}</p>
                </div>
                <div>
                  <p>{new Date(report.submittedAtIso).toLocaleString()}</p>
                  <p>{report.status}</p>
                  <Link className="app-link-button" href={`/citizen/reports/${report.id}`}>
                    Open details
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="dashboard-card cases-state" role="status">
          <strong>No demonstration reports found on this device.</strong>
        </section>
      )}
    </section>
  );
}
