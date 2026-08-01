"use client";

import Link from "next/link";
import { useMemo } from "react";
import { findCitizenDemoReportById } from "@/app/lib/citizen-demo-storage";
import { CitizenEmergencyWarning, CitizenPortalDisclosure } from "./citizen-notices";

export function CitizenReportDetail({ reportId }: { reportId: string }) {
  const report = useMemo(() => findCitizenDemoReportById(reportId), [reportId]);

  if (!report) {
    return (
      <section className="citizen-stack">
        <CitizenPortalDisclosure />
        <CitizenEmergencyWarning />
        <section className="dashboard-card cases-state" role="status">
          <strong>Report not found on this device.</strong>
        </section>
      </section>
    );
  }

  return (
    <section className="citizen-stack">
      <CitizenPortalDisclosure />
      <CitizenEmergencyWarning />

      <section className="dashboard-card citizen-reference-card">
        <h3>{report.reference}</h3>
        <p>{report.status}</p>
        <p>Submitted: {new Date(report.submittedAtIso).toLocaleString()}</p>
        <p>This reference is for demonstration use only and is not an official police record.</p>
      </section>

      <section className="dashboard-card">
        <div className="settings-field-grid">
          <div>
            <span>Category</span>
            <strong>{report.category}</strong>
          </div>
          <div>
            <span>Approximate area</span>
            <strong>{report.approximateArea}</strong>
          </div>
          <div>
            <span>Contact preference</span>
            <strong>{report.contactPreference}</strong>
          </div>
          <div>
            <span>Description</span>
            <strong>{report.description}</strong>
          </div>
        </div>
      </section>

      <Link className="button button-secondary" href="/citizen/reports">
        Back to my reports
      </Link>
    </section>
  );
}
