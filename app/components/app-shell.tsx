"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { LanguageProvider, languageName, useLanguage } from "./language-provider";

type Theme = "light" | "dark";

type IconName =
  | "activity"
  | "alert"
  | "arrow"
  | "bell"
  | "briefcase"
  | "chart"
  | "check"
  | "chevron"
  | "clipboard"
  | "dashboard"
  | "file"
  | "filter"
  | "globe"
  | "layers"
  | "moon"
  | "plus"
  | "settings"
  | "shield"
  | "sun"
  | "user";

const navItems = [
  { key: "dashboard", href: "/dashboard", icon: "dashboard", match: "/dashboard" },
  { key: "myCases", href: "/cases", icon: "briefcase", match: "/cases" },
  { key: "createCase", href: "/cases/new", icon: "plus", match: "/cases/new" },
  { key: "analysis", href: "/cases", icon: "activity", match: "/analysis" },
  { key: "oversight", href: "/oversight", icon: "shield", match: "/oversight" },
  { key: "settings", href: "/settings", icon: "settings", match: "/settings" },
] satisfies Array<{ key: "analysis" | "createCase" | "dashboard" | "myCases" | "oversight" | "settings"; href: string; icon: IconName; match: string }>;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <AppShellContent>{children}</AppShellContent>
    </LanguageProvider>
  );
}

function AppShellContent({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("caseflow-theme", theme);
  }, [theme]);

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-main">
        <AppHeader
          theme={theme}
          onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
        />
        <FictionalDataBanner />
        {children}
      </div>
    </div>
  );
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";

  const stored = window.localStorage.getItem("caseflow-theme") as Theme | null;
  return stored === "light" || stored === "dark" ? stored : "light";
}

export function AppSidebar() {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <aside className="app-sidebar" aria-label="CaseFlow AI workspace navigation">
      <Link className="app-sidebar-brand" href="/dashboard" aria-label="CaseFlow AI dashboard">
        <span className="app-brand-mark" aria-hidden="true">
          <Icon name="layers" />
        </span>
        <span>
          <strong>CaseFlow AI</strong>
          <em>Officer workspace</em>
        </span>
      </Link>

      <nav className="app-sidebar-nav" aria-label="Primary app navigation">
        {navItems.map((item) => {
          const isActive =
            item.href === "/cases"
              ? pathname === "/cases" || (pathname.startsWith("/cases/") && pathname !== "/cases/new")
              : pathname === item.href || pathname.startsWith(item.match);

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={isActive ? "active" : undefined}
              href={item.href}
              key={item.key}
            >
              <Icon name={item.icon} />
              <span>{t(item.key)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="app-sidebar-card">
        <span className="sidebar-card-icon" aria-hidden="true">
          <Icon name="shield" />
        </span>
        <p>Investigation workspace</p>
        <strong>Cases, evidence, and actions</strong>
      </div>
    </aside>
  );
}

export function AppHeader({
  theme,
  onToggleTheme,
}: {
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();

  const cycleLanguage = () => {
    if (language === "en") return setLanguage("hi");
    if (language === "hi") return setLanguage("pa");
    return setLanguage("en");
  };

  const title = useMemo(() => {
    if (pathname.startsWith("/cases/new")) return t("createCase");
    if (pathname.startsWith("/cases/")) return t("openCase");
    if (pathname === "/cases") return t("myCases");
    if (pathname.startsWith("/case-assistant")) return t("caseAssistant");
    if (pathname.startsWith("/analysis")) return t("analysis");
    if (pathname.startsWith("/oversight")) return t("oversight");
    if (pathname.startsWith("/settings")) return t("settings");
    return t("dashboard");
  }, [pathname, t]);

  return (
    <header className="app-header">
      <div>
        <p>Investigating Officer</p>
        <h1>{title}</h1>
      </div>

      <div className="app-header-actions">
        <button className="app-utility-button language-placeholder" type="button" aria-label="Language selector" onClick={cycleLanguage}>
          <Icon name="globe" />
          <span>{languageName(language)}</span>
          <Icon name="chevron" />
        </button>
        <button className="app-utility-button icon-only" type="button" aria-label="Notifications">
          <Icon name="bell" />
          <span className="notification-dot" aria-hidden="true" />
        </button>
        <button
          className="app-utility-button icon-only"
          type="button"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          <Icon name={theme === "light" ? "moon" : "sun"} />
        </button>
        <div className="officer-profile" aria-label="Officer profile">
          <span>IO</span>
          <div>
            <strong>Insp. Asha Rao</strong>
            <em>Investigation Unit</em>
          </div>
        </div>
      </div>
    </header>
  );
}

export function FictionalDataBanner() {
  const { t } = useLanguage();

  return (
    <div className="fictional-data-banner" role="status">
      <Icon name="alert" />
      <span>{t("demoBanner")}</span>
    </div>
  );
}

export function PageContainer({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="page-container">
      <section className="page-hero app-page-enter">
        <div>
          {eyebrow ? <p className="page-eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {actions ? <div className="page-actions">{actions}</div> : null}
      </section>
      <div className="page-content app-page-enter">{children}</div>
    </main>
  );
}

export function PlaceholderPanel({
  title,
  body,
  tag = "Phase 1 placeholder",
}: {
  title: string;
  body: string;
  tag?: string;
}) {
  return (
    <article className="placeholder-panel">
      <span>{tag}</span>
      <h3>{title}</h3>
      <p>{body}</p>
      <Link className="app-link-button" href="/dashboard">
        Back to Dashboard
        <Icon name="arrow" />
      </Link>
    </article>
  );
}

export function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {iconPath(name)}
    </svg>
  );
}

function iconPath(name: IconName) {
  switch (name) {
    case "activity":
      return <path d="M3 12h4l2.2-6 4 12 2.3-6H21" />;
    case "alert":
      return (
        <>
          <path d="M12 8v5" />
          <path d="M12 17h.01" />
          <path d="m10.2 3.8-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.8-3.2l-8-14a2.1 2.1 0 0 0-3.6 0Z" />
        </>
      );
    case "arrow":
      return <path d="M5 12h14m-6-6 6 6-6 6" />;
    case "bell":
      return (
        <>
          <path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 6 2.5 6.5 2.5 6.5h-16s2.5-.5 2.5-6.5Z" />
          <path d="M10 20a2.2 2.2 0 0 0 4 0" />
        </>
      );
    case "briefcase":
      return (
        <>
          <path d="M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7" />
          <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" />
          <path d="M4 11h16" />
        </>
      );
    case "chart":
      return (
        <>
          <path d="M5 20V10" />
          <path d="M12 20V4" />
          <path d="M19 20v-7" />
        </>
      );
    case "check":
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="m8.5 12 2.2 2.2 4.8-5" />
        </>
      );
    case "chevron":
      return <path d="m9 6 6 6-6 6" />;
    case "clipboard":
      return (
        <>
          <path d="M9 4h6l1 2h2v14H6V6h2z" />
          <path d="M9 10h6" />
          <path d="M9 14h5" />
        </>
      );
    case "dashboard":
      return (
        <>
          <path d="M4 4h7v7H4z" />
          <path d="M13 4h7v7h-7z" />
          <path d="M4 13h7v7H4z" />
          <path d="M13 13h7v7h-7z" />
        </>
      );
    case "file":
      return (
        <>
          <path d="M7 3h7l4 4v14H7z" />
          <path d="M14 3v5h4" />
          <path d="M9.5 13h5" />
          <path d="M9.5 17h5" />
        </>
      );
    case "filter":
      return <path d="M4 6h16M7 12h10M10 18h4" />;
    case "globe":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a13.5 13.5 0 0 1 0 18" />
          <path d="M12 3a13.5 13.5 0 0 0 0 18" />
        </>
      );
    case "layers":
      return (
        <>
          <path d="m12 3 8 4.2-8 4.2-8-4.2z" />
          <path d="m4 12 8 4.2 8-4.2" />
          <path d="m4 16.5 8 4.2 8-4.2" />
        </>
      );
    case "moon":
      return <path d="M20 14.5A7.4 7.4 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />;
    case "plus":
      return <path d="M12 5v14M5 12h14" />;
    case "settings":
      return (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-2 .2 1.7 1.7 0 0 0-.8 1.7V22h-4v-.2a1.7 1.7 0 0 0-.8-1.7 1.7 1.7 0 0 0-2-.2l-.2.1-2-3.4.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 4.6 13H4V9h.6a1.7 1.7 0 0 0 1.6-1.2 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3.4.2.1a1.7 1.7 0 0 0 2-.2A1.7 1.7 0 0 0 10.8.6V.4h4v.2a1.7 1.7 0 0 0 .8 1.7 1.7 1.7 0 0 0 2 .2l.2-.1 2 3.4-.1.1a1.7 1.7 0 0 0-.3 1.9A1.7 1.7 0 0 0 21 9h.6v4H21a1.7 1.7 0 0 0-1.6 1.2Z" />
        </>
      );
    case "shield":
      return <path d="M12 3 5.5 5.7v5.5c0 4.2 2.7 7.9 6.5 9.2 3.8-1.3 6.5-5 6.5-9.2V5.7z" />;
    case "sun":
      return (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
        </>
      );
    case "user":
      return (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M5 21a7 7 0 0 1 14 0" />
        </>
      );
    default:
      return <path d="M4 12h16" />;
  }
}
