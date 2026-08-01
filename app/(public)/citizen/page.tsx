"use client";

import Link from "next/link";
import { Icon } from "@/app/components/app-shell";
import { CITIZEN_REQUEST_TYPES } from "@/app/lib/citizen-request-domain";
import { useLanguage } from "@/app/components/language-provider";

export default function CitizenHomePage() {
  const { t } = useLanguage();

  return (
    <section className="citizen-page-shell citizen-home-page">
      <section className="citizen-hero citizen-card">
        <div className="citizen-hero-copy">
          <p className="citizen-eyebrow">{t("citizen.portalTag")}</p>
          <h1>{t("citizen.homeTitle")}</h1>
          <p>{t("citizen.homeDescription")}</p>
        </div>

        <div className="citizen-hero-actions">
          <Link className="button button-primary" href="/citizen/report">
            <span className="citizen-icon-badge" aria-hidden="true">
              <Icon name="plus" />
            </span>
            {t("citizen.submitRequest")}
          </Link>
          <Link className="button button-secondary" href="/citizen/track">
            <span className="citizen-icon-badge" aria-hidden="true">
              <Icon name="briefcase" />
            </span>
            {t("citizen.trackRequest")}
          </Link>
        </div>
      </section>

      <section className="citizen-feature-grid">
        <article className="citizen-card citizen-feature-card">
          <span className="citizen-feature-icon" aria-hidden="true">
            <Icon name="alert" />
          </span>
          <h3>{t("citizen.homeCardReportTitle")}</h3>
          <p>{t("citizen.homeCardReportBody")}</p>
        </article>
        <article className="citizen-card citizen-feature-card">
          <span className="citizen-feature-icon" aria-hidden="true">
            <Icon name="briefcase" />
          </span>
          <h3>{t("citizen.homeCardTrackTitle")}</h3>
          <p>{t("citizen.homeCardTrackBody")}</p>
        </article>
        <article className="citizen-card citizen-feature-card">
          <span className="citizen-feature-icon" aria-hidden="true">
            <Icon name="shield" />
          </span>
          <h3>{t("citizen.homeCardSafetyTitle")}</h3>
          <p>{t("citizen.homeCardSafetyBody")}</p>
        </article>
        <article className="citizen-card citizen-feature-card">
          <span className="citizen-feature-icon" aria-hidden="true">
            <Icon name="check" />
          </span>
          <h3>{t("citizen.homeCardPrivacyTitle")}</h3>
          <p>{t("citizen.homeCardPrivacyBody")}</p>
        </article>
      </section>

      <section className="citizen-warning-panel citizen-notice citizen-notice-warn">
        <strong>{t("citizen.emergencyWarning")}</strong>
        <span>{t("citizen.homeWarningNote")}</span>
      </section>

      <p className="citizen-demo-note">{t("citizen.noFIRNotice")}</p>

      <section className="citizen-card citizen-request-types-card">
        <p className="citizen-eyebrow">{t("citizen.requestCategories")}</p>
        <div className="citizen-chip-grid">
          {CITIZEN_REQUEST_TYPES.map((requestType) => (
            <span className="citizen-chip" key={requestType}>
              {requestType}
            </span>
          ))}
        </div>
      </section>
    </section>
  );
}
