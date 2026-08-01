"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import {
  CITIZEN_REQUEST_TYPES,
  citizenRequestValidationMessage,
} from "@/app/lib/citizen-request-domain";
import { useLanguage } from "./language-provider";
import { createDemoCitizenReference, saveStoredDemoCitizenRequest } from "@/lib/demo-citizen-requests";

const defaultForm = {
  contactDetail: "",
  contactMethod: "",
  description: "",
  incidentDate: "",
  location: "",
  name: "",
  requestType: CITIZEN_REQUEST_TYPES[0],
  title: "",
  confirmEmergency: false,
  confirmAccuracy: false,
  confirmNoFIR: false,
};

type CitizenRequestFormState = typeof defaultForm;

const FORM_STORAGE_KEY = "caseflow:demo-citizen-form:v1";

export function CitizenRequestForm() {
  const { t } = useLanguage();
  const [form, setForm] = useState<CitizenRequestFormState>(() => readStoredForm());
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedReference, setSubmittedReference] = useState("");
  const [submittedTitle, setSubmittedTitle] = useState("");

  const canSubmit = useMemo(
    () =>
      form.requestType.length > 0 &&
      form.title.trim().length >= 3 &&
      form.description.trim().length >= 10 &&
      form.confirmEmergency &&
      form.confirmAccuracy &&
      form.confirmNoFIR,
    [form],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!canSubmit) {
      setError(citizenRequestValidationMessage());
      return;
    }

    setIsSubmitting(true);

    try {
      const reference = createDemoCitizenReference();
      const submittedAt = new Date().toISOString();
      const demoRequest = {
        id: `demo-${reference.toLowerCase()}`,
        reference,
        requestType: form.requestType,
        title: form.title.trim(),
        description: form.description.trim(),
        location: form.location.trim() || "Not provided",
        submittedAt,
        publicStatus: "Submitted",
        internalStatus: "submitted",
        priority: "Unreviewed",
        assignedOfficer: "Unassigned",
        station: "Pending assignment",
        lastActivity: "Submitted through the public demo portal",
        publicMessage: "Your request has been submitted and is waiting to be reviewed.",
        convertedToCase: false,
      } as const;

      saveStoredDemoCitizenRequest(demoRequest);
      setSubmittedReference(reference);
      setSubmittedTitle(form.title.trim());
      setForm(defaultForm);
      persistForm(defaultForm);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Request submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedReference) {
    return (
      <section className="citizen-card citizen-form-success">
        <p className="citizen-eyebrow">Request submitted</p>
        <h2>Demo reference generated</h2>
        <p>{submittedTitle}</p>
        <strong>{submittedReference}</strong>
        <p>This is a demonstration reference only. No police or emergency service was contacted.</p>
        <div className="citizen-form-actions">
          <Link className="button button-primary" href={`/citizen/track?reference=${encodeURIComponent(submittedReference)}`}>
            {t("citizen.trackRequest")}
          </Link>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => {
              setSubmittedReference("");
              setSubmittedTitle("");
            }}
          >
            {t("citizen.submitAnotherRequest")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="citizen-stack">
      <div className="citizen-notice citizen-notice-warn citizen-inline-warning" role="alert">
        <strong>{t("citizen.emergencyWarning")}</strong>
        <span>Use this form only for non-emergency public safety requests.</span>
      </div>

      <div className="citizen-notice citizen-notice-info citizen-inline-note" role="note">
        <strong>{t("citizen.noFIRNotice")}</strong>
      </div>

      <form className="citizen-card citizen-form-card" onSubmit={handleSubmit}>
        <div className="citizen-card-heading">
          <div>
            <p>{t("citizen.submitRequest")}</p>
            <h3>Send a non-emergency public safety request</h3>
          </div>
        </div>

        <div className="citizen-form-grid">
          <label className="citizen-field citizen-wide">
            <span>{t("citizen.requestType")}</span>
            <select
              onChange={(event) => setForm((current) => ({ ...current, requestType: event.target.value as CitizenRequestFormState["requestType"] }))}
              value={form.requestType}
            >
              {CITIZEN_REQUEST_TYPES.map((requestType) => (
                <option key={requestType} value={requestType}>
                  {requestType}
                </option>
              ))}
            </select>
          </label>

          <label className="citizen-field citizen-wide">
            <span>{t("citizen.title")}</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder={t("citizen.requestTitlePlaceholder")}
              value={form.title}
            />
          </label>

          <label className="citizen-field citizen-wide">
            <span>{t("citizen.description")}</span>
            <textarea
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder={t("citizen.requestDescriptionPlaceholder")}
              rows={6}
              value={form.description}
            />
          </label>

          <label className="citizen-field">
            <span>{t("citizen.incidentDate")}</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, incidentDate: event.target.value }))}
              type="datetime-local"
              value={form.incidentDate}
            />
          </label>

          <label className="citizen-field">
            <span>{t("citizen.location")}</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
              placeholder={t("citizen.locationPlaceholder")}
              value={form.location}
            />
          </label>

          <label className="citizen-field">
            <span>{t("citizen.nameOptional")}</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder={t("citizen.namePlaceholder")}
              value={form.name}
            />
          </label>

          <label className="citizen-field">
            <span>{t("citizen.contactDetailOptional")}</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, contactDetail: event.target.value }))}
              placeholder={t("citizen.contactValuePlaceholder")}
              value={form.contactDetail}
            />
          </label>

          <label className="citizen-field citizen-wide">
            <span>{t("citizen.preferredContactMethod")}</span>
            <input
              onChange={(event) => setForm((current) => ({ ...current, contactMethod: event.target.value }))}
              placeholder={t("citizen.contactPreferencePlaceholder")}
              value={form.contactMethod}
            />
          </label>
        </div>

        <div className="citizen-checkbox-list">
          <label className="citizen-checkbox">
            <input
              checked={form.confirmEmergency}
              onChange={(event) => setForm((current) => ({ ...current, confirmEmergency: event.target.checked }))}
              type="checkbox"
            />
            <span>{t("citizen.confirmNotEmergency")}</span>
          </label>
          <label className="citizen-checkbox">
            <input
              checked={form.confirmAccuracy}
              onChange={(event) => setForm((current) => ({ ...current, confirmAccuracy: event.target.checked }))}
              type="checkbox"
            />
            <span>{t("citizen.confirmAccuracy")}</span>
          </label>
          <label className="citizen-checkbox">
            <input
              checked={form.confirmNoFIR}
              onChange={(event) => setForm((current) => ({ ...current, confirmNoFIR: event.target.checked }))}
              type="checkbox"
            />
            <span>{t("citizen.confirmNoFIR")}</span>
          </label>
        </div>

        {error ? <p className="citizen-error">{error}</p> : null}

        <div className="citizen-form-actions">
          <button className="button button-primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? t("common.loading") : t("citizen.submitRequest")}
          </button>
          <Link className="button button-secondary" href="/citizen/track">
            {t("citizen.trackRequest")}
          </Link>
        </div>
      </form>
    </section>
  );
}

function persistForm(form: CitizenRequestFormState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(form));
}

function readStoredForm(): CitizenRequestFormState {
  if (typeof window === "undefined") return defaultForm;

  try {
    const raw = window.localStorage.getItem(FORM_STORAGE_KEY);
    if (!raw) return defaultForm;
    const parsed = JSON.parse(raw) as Partial<CitizenRequestFormState>;
    return {
      ...defaultForm,
      ...parsed,
      requestType: CITIZEN_REQUEST_TYPES.includes(parsed.requestType as (typeof CITIZEN_REQUEST_TYPES)[number])
        ? (parsed.requestType as CitizenRequestFormState["requestType"])
        : defaultForm.requestType,
    };
  } catch {
    return defaultForm;
  }
}
