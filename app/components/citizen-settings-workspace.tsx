"use client";

import { useState } from "react";
import { clearCitizenDemoReports, loadCitizenDemoReports } from "@/app/lib/citizen-demo-storage";
import { CitizenEmergencyWarning, CitizenPortalDisclosure } from "./citizen-notices";

export function CitizenSettingsWorkspace() {
  const [reportCount, setReportCount] = useState(() => loadCitizenDemoReports().length);
  const lastUpdated = new Date().toLocaleString();

  const handleClear = () => {
    const confirmed = window.confirm("Clear all demonstration reports saved on this device?");
    if (!confirmed) return;
    clearCitizenDemoReports();
    setReportCount(0);
  };

  return (
    <section className="citizen-stack">
      <CitizenPortalDisclosure />
      <CitizenEmergencyWarning />

      <section className="dashboard-card citizen-reference-card">
        <h3>Citizen demonstration settings</h3>
        <p>Device-stored reports: {reportCount}</p>
        <p>Last refreshed: {lastUpdated}</p>
        <div className="citizen-form-actions">
          <button className="button button-secondary" type="button" onClick={handleClear}>
            Clear demonstration reports
          </button>
        </div>
      </section>
    </section>
  );
}
