"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  createCitizenDemoReport,
  type CitizenDemoCategory,
  type CitizenDemoContactPreference,
} from "@/app/lib/citizen-demo-storage";
import { CitizenEmergencyWarning, CitizenPortalDisclosure } from "./citizen-notices";

const categories: CitizenDemoCategory[] = [
  "Suspicious activity",
  "Traffic concern",
  "Public nuisance",
  "Property concern",
  "Women and child safety",
  "Cyber concern",
  "Other",
];

const contactPreferences: CitizenDemoContactPreference[] = ["No contact", "Email follow-up", "Phone follow-up"];

export function CitizenReportForm() {
  const [category, setCategory] = useState<CitizenDemoCategory>("Suspicious activity");
  const [approximateArea, setApproximateArea] = useState("");
  const [description, setDescription] = useState("");
  const [contactPreference, setContactPreference] = useState<CitizenDemoContactPreference>("No contact");
  const [error, setError] = useState("");
  const [submittedReference, setSubmittedReference] = useState("");

  const canSubmit = useMemo(
    () => approximateArea.trim().length >= 3 && description.trim().length >= 15,
    [approximateArea, description],
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!canSubmit) {
      setError("Please add an approximate area and a clear non-emergency description.");
      return;
    }

    const report = createCitizenDemoReport({
      category,
      approximateArea,
      description,
      contactPreference,
    });

    setSubmittedReference(report.reference);
    setApproximateArea("");
    setDescription("");
    setContactPreference("No contact");
    setCategory("Suspicious activity");
  };

  return (
    <section className="citizen-stack">
      <CitizenPortalDisclosure />
      <CitizenEmergencyWarning />

      <section className="dashboard-card case-form-card">
        <div className="dashboard-card-header chart-card-header">
          <div>
            <p>Non-emergency submission</p>
            <h3>Submit a public safety report (demo)</h3>
          </div>
        </div>

        <form className="citizen-form" onSubmit={handleSubmit}>
          <label className="case-field">
            <span>Category</span>
            <select value={category} onChange={(event) => setCategory(event.target.value as CitizenDemoCategory)}>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="case-field">
            <span>Approximate area</span>
            <input
              type="text"
              value={approximateArea}
              onChange={(event) => setApproximateArea(event.target.value)}
              placeholder="Example: Sector 19 market area"
            />
          </label>

          <label className="case-field case-field-wide">
            <span>Description</span>
            <textarea
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe what you observed. Avoid personal identifiers and do not report active emergencies here."
            />
          </label>

          <label className="case-field">
            <span>Contact preference (optional)</span>
            <select
              value={contactPreference}
              onChange={(event) => setContactPreference(event.target.value as CitizenDemoContactPreference)}
            >
              {contactPreferences.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          {error ? <p className="case-form-error">{error}</p> : null}

          <div className="citizen-form-actions">
            <button className="button button-primary" type="submit">
              Save demonstration report
            </button>
            <Link className="button button-secondary" href="/citizen/reports">
              View my device reports
            </Link>
          </div>
        </form>
      </section>

      {submittedReference ? (
        <section className="dashboard-card citizen-reference-card" role="status">
          <h3>Saved locally</h3>
          <p>
            Reference: <strong>{submittedReference}</strong>
          </p>
          <p>This reference is for this demonstration portal only. It is not an FIR, complaint number, emergency dispatch number, or official police record.</p>
        </section>
      ) : null}
    </section>
  );
}
