"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
    const confirmed = window.confirm(
      "Clear local case chat history stored on this device for the demonstration prototype?",
    );

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
      setSessionError("Unable to sign out.");
      setSessionStatus("idle");
      return;
    }

    router.push("/login");
    router.refresh();
  };

  const preferenceSummary = useMemo(
    () => [
      `Language: ${languageName(preferences.language)}`,
      `Appearance: ${preferences.appearance}`,
      preferences.reducedMotion ? "Reduced motion enabled" : "Standard motion",
      preferences.compactDensity ? "Compact density enabled" : "Comfortable density",
    ],
    [preferences],
  );

  return (
    <section className="settings-layout">
      <SettingsCard eyebrow="Account profile" title="Read-only account details" icon="user">
        <SettingsFieldGrid fields={accountFields} />
      </SettingsCard>

      <SettingsCard eyebrow="Current posting" title="Posting and jurisdiction" icon="briefcase">
        <SettingsFieldGrid fields={postingFields} />
        <p className="settings-note">
          Posting and jurisdiction changes require authorised administrative approval.
        </p>
      </SettingsCard>

      <SettingsCard eyebrow="Interface preferences" title="Local display controls" icon="settings">
        <div className="settings-preferences">
          <label>
            <span>Language</span>
            <select
              value={preferences.language}
              onChange={(event) =>
                updatePreferences({
                  ...preferences,
                  language: event.target.value as LanguageCode,
                })
              }
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="pa">Punjabi</option>
            </select>
          </label>

          <label>
            <span>Appearance</span>
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
            label="Reduced motion"
            onChange={(checked) =>
              updatePreferences({
                ...preferences,
                reducedMotion: checked,
              })
            }
          />
          <ToggleControl
            checked={preferences.compactDensity}
            label="Compact density"
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

      <SettingsCard eyebrow="Privacy and data handling" title="Demonstration storage" icon="shield">
        <div className="settings-privacy-grid">
          <div>
            <span>Fictional-data-only status</span>
            <strong>Enabled</strong>
          </div>
          <div>
            <span>Local chat-storage status</span>
            <strong>Device only</strong>
          </div>
          <div>
            <span>Current device chat count</span>
            <strong>{chatCount}</strong>
          </div>
        </div>
        <button className="app-link-button settings-clear-button" type="button" onClick={clearLocalChats}>
          Clear local case chats
        </button>
        <p className="settings-note">
          Case chat history is stored only on this device for the demonstration prototype.
        </p>
      </SettingsCard>

      <SettingsCard eyebrow="Security and session" title="Current access session" icon="shield">
        <SettingsFieldGrid fields={sessionFields} />
        {sessionError ? <p className="settings-error">{sessionError}</p> : null}
        <button
          className="button button-primary settings-signout-button"
          disabled={sessionStatus === "signing-out"}
          onClick={signOut}
          type="button"
        >
          {sessionStatus === "signing-out" ? "Signing out" : t("signOut")}
        </button>
      </SettingsCard>

      <SettingsCard eyebrow="Access explanation" title="How access is determined" icon="layers">
        <p className="settings-body-text">
          Access is determined by active role, current posting, territorial jurisdiction,
          assigned case, supervisory authority, purpose of access, and temporary authorisation.
        </p>
      </SettingsCard>

      <SettingsCard eyebrow="Prototype limitations" title="Security limitations" icon="alert">
        <ul className="settings-mini-list">
          <li>Authentication is demonstration-grade.</li>
          <li>Real police deployment would require MFA.</li>
          <li>Government-controlled infrastructure would be required.</li>
          <li>Encryption controls would need formal review.</li>
          <li>Audit review and approved identity provisioning would be required.</li>
          <li>Production security testing would be mandatory.</li>
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

    return {
      appearance:
        parsed.appearance === "light" || parsed.appearance === "dark" || parsed.appearance === "system"
          ? parsed.appearance
          : defaultPreferences.appearance,
      compactDensity: Boolean(parsed.compactDensity),
      language:
        parsed.language === "en" || parsed.language === "hi" || parsed.language === "pa"
          ? parsed.language
          : persistedLanguage,
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
