"use client";

import { useLanguage } from "./language-provider";

export function CitizenPortalDisclosure() {
  const { t } = useLanguage();

  return (
    <div className="citizen-notice citizen-notice-info" role="status">
      <strong>{t("citizen.portalDisclosure")}</strong>
    </div>
  );
}

export function CitizenEmergencyWarning() {
  const { t } = useLanguage();

  return (
    <div className="citizen-notice citizen-notice-warn" role="alert">
      <strong>{t("citizen.emergencyWarning")}</strong>
    </div>
  );
}

export function CitizenFIRWarning() {
  const { t } = useLanguage();

  return (
    <div className="citizen-notice citizen-notice-info" role="note">
      <strong>{t("citizen.noFIRNotice")}</strong>
    </div>
  );
}
