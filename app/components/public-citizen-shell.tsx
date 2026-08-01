"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { supportedLanguageCodes } from "@/lib/i18n/config";
import { languageName, useLanguage } from "./language-provider";
import { Icon } from "./app-shell";

type Theme = "light" | "dark";
const portalThemeKey = "caseflow:portal-theme";

const portalNav = [
  { labelKey: "nav.citizenHome", href: "/citizen" },
  { labelKey: "nav.citizenReport", href: "/citizen/report" },
  { labelKey: "citizen.trackRequest", href: "/citizen/track" },
  { labelKey: "nav.citizenSafety", href: "/citizen/safety" },
  { labelKey: "citizen.returnToOfficerLogin", href: "/login" },
] as const;

export function PublicCitizenShell({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(portalThemeKey, theme);
  }, [theme]);

  return (
    <div className="citizen-portal-site">
      <CitizenPortalHeader theme={theme} onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")} />
      <main className="citizen-portal-main">{children}</main>
    </div>
  );
}

function CitizenPortalHeader({
  onToggleTheme,
  theme,
}: {
  onToggleTheme: () => void;
  theme: Theme;
}) {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="citizen-portal-header">
      <div className="citizen-portal-brand">
        <span className="citizen-portal-mark" aria-hidden="true">
          <Icon name="layers" />
        </span>
        <div>
          <strong>CaseFlow AI</strong>
          <span>{t("citizen.portalTag")}</span>
        </div>
      </div>

      <nav className="citizen-portal-nav" aria-label="Citizen navigation">
        {portalNav.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link className={isActive ? "active" : undefined} href={item.href} key={item.href}>
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="citizen-portal-actions">
        <label className="citizen-portal-language" aria-label={t("common.languageSelector")}>
          <Icon name="globe" />
          <select
            aria-label={t("common.languageSelector")}
            onChange={(event) => setLanguage(event.target.value as typeof language)}
            value={language}
          >
            {supportedLanguageCodes.map((code) => (
              <option key={code} value={code}>
                {languageName(code)}
              </option>
            ))}
          </select>
        </label>
        <button className="citizen-portal-theme-toggle" type="button" onClick={onToggleTheme} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>
          <Icon name={theme === "light" ? "moon" : "sun"} />
        </button>
      </div>
    </header>
  );
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(portalThemeKey) as Theme | null;
  return stored === "dark" || stored === "light" ? stored : "light";
}
