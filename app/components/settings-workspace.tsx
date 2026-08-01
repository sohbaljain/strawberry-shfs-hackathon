"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupportedLanguageCode, supportedLanguageCodes } from "@/lib/i18n/config";
import { Icon } from "./app-shell";
import { languageName, readStoredLanguage, useLanguage, type LanguageCode } from "./language-provider";

export type SettingsField = {
  label: string;
  value: string;
};

export type SettingsWorkspaceProps = {
  accountFields: SettingsField[];
  postingFields: SettingsField[];
  sessionFields: SettingsField[];
};

type Preferences = {
  appearance: "light" | "dark" | "system";
  compactDensity: boolean;
  language: LanguageCode;
  reducedMotion: boolean;
};

const preferencesStorageKey = "caseflow:interface-preferences";
const chatSessionStoragePrefix = "caseflow:case-chat-sessions:";
const activeChatStoragePrefix = "caseflow:active-case-chat:";
const legacyChatStoragePrefix = "caseflow:case-chat:";

const defaultPreferences: Preferences = {
  appearance: "system",
  compactDensity: false,
  language: "en",
  reducedMotion: false,
};

export function SettingsWorkspace({
  accountFields,
  postingFields,
  sessionFields,
}: SettingsWorkspaceProps) {
  const { setLanguage, t } = useLanguage();
  const router = useRouter();
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [chatCount, setChatCount] = useState(0);
  const [sessionStatus, setSessionStatus] = useState<"idle" | "signing-out">("idle");
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const storedPreferences = readPreferences();
      setPreferences(storedPreferences);
      setLanguage(storedPreferences.language || readStoredLanguage());
      applyAppearance(storedPreferences.appearance);
      setChatCount(countLocalChats());
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [setLanguage]);

  const updatePreferences = (nextPreferences: Preferences) => {
    setPreferences(nextPreferences);
    writePreferences(nextPreferences);
    setLanguage(nextPreferences.language);
    applyAppearance(nextPreferences.appearance);
  };

  const clearLocalChats = () => {
    const confirmed = window.confirm(t("settings.clearLocalChatConfirm"));

    if (!confirmed) return;

    clearChatStorage();
    setChatCount(0);
  };

  const signOut = async () => {
    setSessionError("");
    setSessionStatus("signing-out");

    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      setSessionError(t("settings.signOutError"));
      setSessionStatus("idle");
      return;
    }

    router.push("/login");
    router.refresh();
  };

  const preferenceSummary = useMemo(
    () => [
      t("settings.languageSummary", { name: languageName(preferences.language) }),
      t("settings.appearanceSummary", { value: preferences.appearance }),
      preferences.reducedMotion ? t("settings.reducedMotionEnabled") : t("settings.standardMotion"),
      preferences.compactDensity
        ? t("settings.compactDensityEnabled")
        : t("settings.comfortableDensity"),
    ],
    [preferences, t],
  );

  return (
    <section className="settings-layout">
      <SettingsCard eyebrow={t("settings.accountProfile")} title={t("settings.readOnlyAccountDetails")} icon="user">
        <SettingsFieldGrid fields={accountFields} />
      </SettingsCard>

      <SettingsCard eyebrow={t("settings.currentPosting")} title={t("settings.postingAndJurisdiction")} icon="briefcase">
        <SettingsFieldGrid fields={postingFields} />
        <p className="settings-note">{t("settings.postingApprovalNote")}</p>
      </SettingsCard>

      <SettingsCard eyebrow={t("settings.interfacePreferences")} title={t("settings.localDisplayControls")} icon="settings">
        <div className="settings-preferences">
          <label>
            <span>{t("common.language")}</span>
            <select
              value={preferences.language}
              onChange={(event) =>
                updatePreferences({
                  ...preferences,
                  language: event.target.value as LanguageCode,
                })
              }
            >
              {supportedLanguageCodes.map((code) => (
                <option key={code} value={code}>
                  {languageName(code)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>{t("settings.appearanceSummary", { value: "" }).replace(": ", "")}</span>
            <select
              value={preferences.appearance}
              onChange={(event) =>
                updatePreferences({
                  ...preferences,
                  appearance: event.target.value as Preferences["appearance"],
                })
              }
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>

          <ToggleControl
            checked={preferences.reducedMotion}
            label={t("settings.reducedMotionEnabled")}
            onChange={(checked) =>
              updatePreferences({
                ...preferences,
                reducedMotion: checked,
              })
            }
          />
          <ToggleControl
            checked={preferences.compactDensity}
            label={t("settings.compactDensityEnabled")}
            onChange={(checked) =>
              updatePreferences({
                ...preferences,
                compactDensity: checked,
              })
            }
          />
        </div>
        <ul className="settings-mini-list">
          {preferenceSummary.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SettingsCard>

      <SettingsCard eyebrow={t("settings.privacyAndDataHandling")} title={t("settings.demonstrationStorage")} icon="shield">
        <div className="settings-privacy-grid">
          <div>
            <span>{t("settings.fieldFictionalDataOnly")}</span>
            <strong>{t("settings.fieldEnabled")}</strong>
          </div>
          <div>
            <span>{t("settings.fieldLocalChatStorage")}</span>
            <strong>{t("common.deviceOnly")}</strong>
          </div>
          <div>
            <span>{t("settings.fieldCurrentDeviceChats")}</span>
            <strong>{chatCount}</strong>
          </div>
        </div>
        <button className="app-link-button settings-clear-button" type="button" onClick={clearLocalChats}>
          {t("settings.fieldClearChats")}
        </button>
        <p className="settings-note">{t("settings.storageNote")}</p>
      </SettingsCard>

      <SettingsCard eyebrow={t("settings.securityAndSession")} title={t("settings.currentAccessSession")} icon="shield">
        <SettingsFieldGrid fields={sessionFields} />
        {sessionError ? <p className="settings-error">{sessionError}</p> : null}
        <button
          className="button button-primary settings-signout-button"
          disabled={sessionStatus === "signing-out"}
          onClick={signOut}
          type="button"
        >
          {sessionStatus === "signing-out" ? t("settings.signingOut") : t("common.signOut")}
        </button>
      </SettingsCard>

      <SettingsCard eyebrow={t("settings.accessExplanation")} title={t("settings.howAccessIsDetermined")} icon="layers">
        <p className="settings-body-text">{t("settings.accessExplanationNote")}</p>
      </SettingsCard>

      <SettingsCard eyebrow={t("settings.prototypeLimitations")} title={t("settings.securityLimitations")} icon="alert">
        <ul className="settings-mini-list">
          <li>{t("settings.prototypeLimitationsNote")}</li>
        </ul>
      </SettingsCard>
    </section>
  );
}

function SettingsCard({
  children,
  eyebrow,
  icon,
  title,
}: {
  children: React.ReactNode;
  eyebrow: string;
  icon: "alert" | "briefcase" | "layers" | "settings" | "shield" | "user";
  title: string;
}) {
  return (
    <section className="dashboard-card settings-card">
      <div className="dashboard-card-header compact-header">
        <div>
          <p>{eyebrow}</p>
          <h3>{title}</h3>
        </div>
        <Icon name={icon} />
      </div>
      <div className="settings-card-body">{children}</div>
    </section>
  );
}

function SettingsFieldGrid({ fields }: { fields: SettingsField[] }) {
  return (
    <div className="settings-field-grid">
      {fields.map((field) => (
        <div key={field.label}>
          <span>{field.label}</span>
          <strong>{field.value || "Not recorded"}</strong>
        </div>
      ))}
    </div>
  );
}

function ToggleControl({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="settings-toggle">
      <span>{label}</span>
      <input
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  );
}

function readPreferences(): Preferences {
  const persistedLanguage = readStoredLanguage();

  try {
    const raw = window.localStorage.getItem(preferencesStorageKey);
    if (!raw) return { ...defaultPreferences, language: persistedLanguage };

    const parsed = JSON.parse(raw) as Partial<Preferences>;

    const nextLanguage = isSupportedLanguageCode(parsed.language) ? parsed.language : persistedLanguage;

    return {
      appearance:
        parsed.appearance === "light" || parsed.appearance === "dark" || parsed.appearance === "system"
          ? parsed.appearance
          : defaultPreferences.appearance,
      compactDensity: Boolean(parsed.compactDensity),
      language: nextLanguage,
      reducedMotion: Boolean(parsed.reducedMotion),
    };
  } catch {
    return { ...defaultPreferences, language: persistedLanguage };
  }
}

function writePreferences(preferences: Preferences) {
  try {
    window.localStorage.setItem(preferencesStorageKey, JSON.stringify(preferences));
  } catch {
    // UI preference storage can fail in private browsing or quota-limited contexts.
  }
}

function applyAppearance(appearance: Preferences["appearance"]) {
  const resolvedAppearance =
    appearance === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : appearance;

  window.localStorage.setItem("caseflow-theme", resolvedAppearance);
  document.documentElement.dataset.theme = resolvedAppearance;
}

function countLocalChats() {
  let count = 0;

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index) ?? "";

    if (key.startsWith(chatSessionStoragePrefix)) {
      count += countSessionsForKey(key);
    } else if (key.startsWith(legacyChatStoragePrefix)) {
      count += 1;
    }
  }

  return count;
}

function countSessionsForKey(key: string) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function clearChatStorage() {
  const keysToRemove: string[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index) ?? "";

    if (
      key.startsWith(chatSessionStoragePrefix) ||
      key.startsWith(activeChatStoragePrefix) ||
      key.startsWith(legacyChatStoragePrefix)
    ) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => window.localStorage.removeItem(key));
}
