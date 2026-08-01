"use client";

import Link from "next/link";
import { PublicCitizenShell } from "@/app/components/public-citizen-shell";
import { Icon } from "@/app/components/app-shell";
import { useLanguage } from "@/app/components/language-provider";

export default function CitizenLoginPage() {
  const { t } = useLanguage();

  return (
    <PublicCitizenShell>
      <section className="citizen-page-shell citizen-login-page">
        <section className="citizen-card citizen-login-hero">
          <p className="citizen-eyebrow">{t("citizen.portalHeading")}</p>
          <h1>{t("citizen.publicEntryTitle")}</h1>
          <p>{t("citizen.publicEntryDescription")}</p>
          <div className="citizen-hero-actions">
            <Link className="button button-primary" href="/citizen">
              <span className="citizen-icon-badge" aria-hidden="true">
                <Icon name="dashboard" />
              </span>
              {t("citizen.enterCitizenPortal")}
            </Link>
            <Link className="button button-secondary" href="/citizen/report">
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

        <section className="citizen-card citizen-login-links">
          <Link className="app-link-button" href="/login">
            {t("citizen.returnToOfficerLogin")}
          </Link>
        </section>
      </section>
    </PublicCitizenShell>
  );
}
