"use client";

import Link from "next/link";
import { CitizenEmergencyWarning, CitizenPortalDisclosure, CitizenFIRWarning } from "@/app/components/citizen-notices";
import { Icon } from "@/app/components/app-shell";
import { useLanguage } from "@/app/components/language-provider";

export default function CitizenSafetyPage() {
  const { t } = useLanguage();

  return (
    <section className="citizen-page-shell">
      <div className="citizen-card">
        <p className="citizen-eyebrow">{t("citizen.safetyHeading")}</p>
        <h1>{t("citizen.safetyTitle")}</h1>
        <p>{t("citizen.safetyDescription")}</p>
        <div className="citizen-hero-actions">
          <Link className="button button-primary" href="/citizen/report">
            <Icon name="plus" />
            {t("citizen.submitRequest")}
          </Link>
          <Link className="button button-secondary" href="/">
            <Icon name="arrow" />
            {t("citizen.returnToMainSite")}
          </Link>
        </div>
      </div>

      <div className="citizen-grid">
        <CitizenPortalDisclosure />
        <CitizenEmergencyWarning />
        <CitizenFIRWarning />
      </div>
    </section>
  );
}
