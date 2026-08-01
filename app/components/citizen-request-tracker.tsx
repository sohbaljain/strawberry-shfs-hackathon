"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  citizenPublicStatusLabel,
  citizenPublicUpdateText,
  formatTrackDate,
} from "@/app/lib/citizen-request-domain";
import { useLanguage } from "./language-provider";

import type { DemoCitizenRequest } from "@/lib/demo-citizen-requests";
import { findDemoCitizenRequestByReference } from "@/lib/demo-citizen-requests";

type TrackResult = Pick<
  DemoCitizenRequest,
  "lastActivity" | "publicMessage" | "publicStatus" | "reference" | "requestType" | "submittedAt" | "title"
> | null;

export function CitizenRequestTracker({ initialReference = "" }: { initialReference?: string }) {
  const { t } = useLanguage();
  const [reference, setReference] = useState(initialReference.toUpperCase());
  const [result, setResult] = useState<TrackResult>(null);
  const [error, setError] = useState("");
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    if (initialReference) {
      void trackReference(initialReference);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialReference]);

  const resultLabel = useMemo(() => {
    if (!result?.publicStatus) return "";
    return citizenPublicStatusLabel(result.publicStatus);
  }, [result]);

  async function trackReference(nextReference?: string) {
    const targetReference = (nextReference ?? reference).trim();
    setError("");
    setIsTracking(true);

    if (!targetReference) {
      setError(t("citizen.referenceRequired"));
      setIsTracking(false);
      return;
    }

    try {
      const row = findDemoCitizenRequestByReference(targetReference);
      if (!row) {
        setResult(null);
        setError(t("citizen.referenceNotFound"));
        return;
      }

      setResult({
        lastActivity: row.lastActivity,
        publicMessage: row.publicMessage,
        publicStatus: row.publicStatus,
        reference: row.reference,
        requestType: row.requestType,
        submittedAt: row.submittedAt,
        title: row.title,
      });
    } catch {
      setResult(null);
      setError(t("citizen.referenceNotFound"));
    } finally {
      setIsTracking(false);
    }
  }

  return (
    <section className="citizen-stack">
      <div className="citizen-notice citizen-notice-warn citizen-inline-warning" role="alert">
        <strong>{t("citizen.emergencyWarning")}</strong>
        <span>Use this tracker only for non-emergency public safety requests.</span>
      </div>

      <section className="citizen-card">
        <div className="citizen-card-heading">
          <div>
            <p>{t("citizen.trackRequest")}</p>
            <h3>Look up a request using the public reference</h3>
          </div>
        </div>

        <div className="citizen-track-form">
          <input
            autoCapitalize="characters"
            autoCorrect="off"
            onChange={(event) => setReference(event.target.value.toUpperCase())}
            placeholder={t("citizen.referencePlaceholder")}
            value={reference}
          />
          <button className="button button-primary" onClick={() => void trackReference()} type="button">
            {isTracking ? t("citizen.trackingRequest") : t("citizen.trackRequest")}
          </button>
        </div>

        {error ? <p className="citizen-error">{error}</p> : null}
      </section>

      {result ? (
        <section className="citizen-card citizen-track-result" role="status">
          <p>{t("citizen.trackedRequest")}</p>
          <strong>{result.reference}</strong>
          <span>{resultLabel}</span>
          <dl className="citizen-definition-list citizen-track-summary">
            <div>
              <dt>{t("citizen.requestType")}</dt>
              <dd>{result.requestType}</dd>
            </div>
            <div>
              <dt>{t("citizen.submittedDate")}</dt>
              <dd>{formatTrackDate(result.submittedAt)}</dd>
            </div>
            <div>
              <dt>{t("citizen.publicStatus")}</dt>
              <dd>{resultLabel}</dd>
            </div>
            <div>
              <dt>{t("citizen.lastUpdate")}</dt>
              <dd>{result.lastActivity}</dd>
            </div>
          </dl>
          <div className="citizen-track-update">{citizenPublicUpdateText(result.publicStatus || "Submitted", result.publicMessage || null)}</div>
          <Link className="button button-secondary" href="/citizen/report">
            {t("citizen.submitAnotherRequest")}
          </Link>
        </section>
      ) : null}
    </section>
  );
}
