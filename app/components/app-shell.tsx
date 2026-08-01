"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { supportedLanguageCodes } from "@/lib/i18n/config";
import { DEMO_SUPERVISORY_SCOPE } from "@/app/lib/supervisory-scope";
import { resolveWorkspaceRole, selectActivePostingRoleCode, type WorkspaceRole } from "@/app/lib/workspace-role";
import { languageName, useLanguage } from "./language-provider";

type Theme = "light" | "dark";
const interfacePreferencesStorageKey = "caseflow:interface-preferences";
type RoleResolutionStatus = "resolving" | "resolved";

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
  | "menu"
  | "moon"
  | "plus"
  | "settings"
  | "shield"
  | "sun"
  | "user";

const navItems = [
  { key: "dashboard", href: "/dashboard", icon: "dashboard", match: "/dashboard" },
  { key: "citizenHome", href: "/citizen", icon: "dashboard", match: "/citizen" },
  { key: "citizenReport", href: "/citizen/report", icon: "plus", match: "/citizen/report" },
  { key: "citizenReports", href: "/citizen/reports", icon: "briefcase", match: "/citizen/reports" },
  { key: "citizenSafety", href: "/citizen/safety", icon: "shield", match: "/citizen/safety" },
  { key: "myCases", href: "/cases", icon: "briefcase", match: "/cases" },
  { key: "createCase", href: "/cases/new", icon: "plus", match: "/cases/new" },
  { key: "analysis", href: "/cases", icon: "activity", match: "/analysis" },
  { key: "oversight", href: "/oversight", icon: "shield", match: "/oversight" },
  { key: "citizenRequests", href: "/citizen-requests", icon: "clipboard", match: "/citizen-requests" },
  { key: "settings", href: "/settings", icon: "settings", match: "/settings" },
] satisfies Array<{ key: "analysis" | "citizenHome" | "citizenReport" | "citizenRequests" | "citizenReports" | "citizenSafety" | "createCase" | "dashboard" | "myCases" | "oversight" | "settings"; href: string; icon: IconName; match: string }>;

export function AppShell({ children }: { children: ReactNode }) {
  return <AppShellContent>{children}</AppShellContent>;
}

function AppShellContent({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(getInitialSidebarCollapsed);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>("unknown");
  const [roleResolutionStatus, setRoleResolutionStatus] = useState<RoleResolutionStatus>("resolving");
  const [profileName, setProfileName] = useState("Authenticated user");
  const [profileUnit, setProfileUnit] = useState("Active session");
  const [profileBadge, setProfileBadge] = useState("AU");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("caseflow-theme", theme);
  }, [theme]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(interfacePreferencesStorageKey);
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        compactDensity?: boolean;
        reducedMotion?: boolean;
      };
      document.documentElement.dataset.compactDensity = String(Boolean(parsed.compactDensity));
      document.documentElement.dataset.reducedMotion = String(Boolean(parsed.reducedMotion));
    } catch {
      // Ignore malformed preference payloads.
    }
  }, []);

  useEffect(() => {
    let active = true;

    const loadSessionContext = async () => {
      try {
        const supabase = createSupabaseClient();
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;

        if (!user) {
          if (!active) return;
          setWorkspaceRole("unknown");
          setProfileName("Role unavailable");
          setProfileUnit("Posting unavailable");
          setProfileBadge("AU");
          setRoleResolutionStatus("resolved");
          return;
        }

        const email = user.email || "Authenticated user";
        const { data: postingRows } = await supabase
          .schema("public")
          .from("user_postings")
          .select("role_code, posting_title, valid_from, valid_until, is_primary, is_active")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("is_primary", { ascending: false })
          .order("valid_from", { ascending: false })
          .limit(20);

        const now = Date.now();
        const activePosting = (Array.isArray(postingRows) ? postingRows : []).find((row) => {
          const validFrom = Date.parse(String(row.valid_from ?? ""));
          const validUntilRaw = String(row.valid_until ?? "").trim();
          const validUntil = validUntilRaw ? Date.parse(validUntilRaw) : Number.NaN;

          if (!Number.isFinite(validFrom) || validFrom > now) return false;
          if (Number.isFinite(validUntil) && validUntil <= now) return false;
          return true;
        });

        const postingRoleCode = selectActivePostingRoleCode(Array.isArray(postingRows) ? postingRows : []);
        const nextRole = resolveWorkspaceRole({
          postingRoleCode,
          appMetadata: user.app_metadata,
          userMetadata: user.user_metadata,
        });

        if (!active) return;

        setWorkspaceRole(nextRole);
        setProfileName(
          nextRole === "supervisory"
            ? DEMO_SUPERVISORY_SCOPE.workspaceRole
            : nextRole === "citizen"
              ? "Citizen Workspace"
              : email,
        );
        setProfileUnit(
          nextRole === "supervisory"
            ? DEMO_SUPERVISORY_SCOPE.policeStation
            : nextRole === "citizen"
              ? "Public safety reporting"
            : String(activePosting?.posting_title ?? "Posting unavailable") || "Posting unavailable",
        );
        setProfileBadge(
          nextRole === "supervisory"
            ? "SH"
            : nextRole === "investigating"
              ? "IO"
              : nextRole === "citizen"
                ? "CT"
                : "AU",
        );
        setRoleResolutionStatus("resolved");
      } catch {
        if (!active) return;
        setWorkspaceRole("unknown");
        setRoleResolutionStatus("resolved");
      }
    };

    void loadSessionContext();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    persistSidebarPreference(sidebarCollapsed);
  }, [sidebarCollapsed]);

  useEffect(() => {
    const syncThemeFromStorage = (event: StorageEvent) => {
      if (event.key !== "caseflow-theme") return;
      const value = event.newValue;
      if (value === "light" || value === "dark") {
        setTheme(value);
      }
    };

    const handleThemeEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ theme?: Theme }>).detail;
      const nextTheme = detail?.theme;
      if (nextTheme === "light" || nextTheme === "dark") {
        setTheme(nextTheme);
      }
    };

    window.addEventListener("storage", syncThemeFromStorage);
    window.addEventListener("caseflow:theme-change", handleThemeEvent as EventListener);
    return () => {
      window.removeEventListener("storage", syncThemeFromStorage);
      window.removeEventListener("caseflow:theme-change", handleThemeEvent as EventListener);
    };
  }, []);

  return (
    <div
      className={`app-shell ${sidebarCollapsed ? "app-shell--sidebar-collapsed" : ""} ${mobileNavOpen ? "app-shell--mobile-nav-open" : ""}`}
    >
      <AppSidebar
        collapsed={sidebarCollapsed}
        mobileNavOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
        roleResolutionStatus={roleResolutionStatus}
        workspaceRole={workspaceRole}
      />
      <div className="app-main">
        <AppHeader
          mobileNavOpen={mobileNavOpen}
          onToggleSidebar={() => setMobileNavOpen((current) => !current)}
          profileBadge={profileBadge}
          profileName={profileName}
          profileUnit={profileUnit}
          roleResolutionStatus={roleResolutionStatus}
          theme={theme}
          onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
          workspaceRole={workspaceRole}
        />
        <div className="app-portal-link-bar">
          <Link className="app-portal-link" href="/citizen">
            Open Citizen Portal
          </Link>
        </div>
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

function getInitialSidebarCollapsed() {
  if (typeof window === "undefined") return false;

  try {
    const raw = window.localStorage.getItem(interfacePreferencesStorageKey);
    if (!raw) return window.localStorage.getItem("caseflow-sidebar-collapsed") === "true";

    const parsed = JSON.parse(raw) as { sidebarCollapsed?: unknown };
    return parsed.sidebarCollapsed === true;
  } catch {
    return window.localStorage.getItem("caseflow-sidebar-collapsed") === "true";
  }
}

function persistSidebarPreference(sidebarCollapsed: boolean) {
  try {
    window.localStorage.setItem("caseflow-sidebar-collapsed", String(sidebarCollapsed));
    const raw = window.localStorage.getItem(interfacePreferencesStorageKey);
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    parsed.sidebarCollapsed = sidebarCollapsed;
    window.localStorage.setItem(interfacePreferencesStorageKey, JSON.stringify(parsed));
  } catch {
    // Ignore storage failures.
  }
}

export function AppSidebar({
  collapsed,
  mobileNavOpen,
  onCloseMobile,
  onToggleCollapsed,
  roleResolutionStatus,
  workspaceRole,
}: {
  collapsed: boolean;
  mobileNavOpen: boolean;
  onCloseMobile: () => void;
  onToggleCollapsed: () => void;
  roleResolutionStatus: RoleResolutionStatus;
  workspaceRole: WorkspaceRole;
}) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const sidebarRef = useRef<HTMLElement | null>(null);
  const subtitle =
    roleResolutionStatus === "resolving"
      ? t("common.loadingWorkspace")
      : workspaceRole === "supervisory"
        ? t("oversight.supervisoryWorkspace")
        : workspaceRole === "citizen"
          ? t("citizen.workspace")
        : workspaceRole === "investigating"
          ? "Investigating Officer"
          : t("common.roleUnavailable");
  const visibleNavItems =
    roleResolutionStatus === "resolving"
      ? []
      : workspaceRole === "citizen"
        ? navItems.filter(
            (item) =>
              item.key === "citizenHome" ||
              item.key === "citizenReport" ||
              item.key === "citizenReports" ||
              item.key === "citizenSafety" ||
              item.key === "settings",
          )
      : workspaceRole === "supervisory"
          ? navItems.filter((item) => item.key === "dashboard" || item.key === "oversight" || item.key === "citizenRequests" || item.key === "settings")
      : workspaceRole === "investigating"
        ? navItems
        : navItems.filter((item) => item.key === "dashboard" || item.key === "settings");

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 920px)");

    if (!mobileNavOpen || !mediaQuery.matches) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    const focusables = Array.from(
      (sidebarRef.current?.querySelectorAll(
        "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])",
      ) ?? []) as NodeListOf<HTMLElement>,
    );
    focusables[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseMobile();
        return;
      }

      if (event.key !== "Tab" || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen, onCloseMobile]);

  return (
    <>
      {mobileNavOpen ? <button className="app-sidebar-overlay" onClick={onCloseMobile} aria-label="Close navigation" /> : null}
      <aside
        className={`app-sidebar ${mobileNavOpen ? "app-sidebar--mobile-open" : ""} ${collapsed ? "app-sidebar--collapsed" : ""}`}
        aria-label="CaseFlow AI workspace navigation"
        ref={sidebarRef}
      >
      <Link className="app-sidebar-brand" href="/dashboard" aria-label="CaseFlow AI dashboard">
        <span className="app-brand-mark" aria-hidden="true">
          <Icon name="layers" />
        </span>
        <span className={collapsed ? "app-sidebar-label" : undefined}>
          <strong>CaseFlow AI</strong>
          <em>{subtitle}</em>
        </span>
      </Link>

      <button
        className="app-sidebar-collapse"
        onClick={onToggleCollapsed}
        type="button"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <Icon name={collapsed ? "arrow" : "chevron"} />
        <span>{collapsed ? "Expand" : "Collapse"}</span>
      </button>

      <button
        className="app-sidebar-mobile-close"
        onClick={onCloseMobile}
        type="button"
        aria-label="Close navigation"
      >
        <Icon name="chevron" />
      </button>

      <nav className="app-sidebar-nav" aria-label="Primary app navigation">
        {visibleNavItems.map((item) => {
          const isActive =
            item.key === "dashboard"
              ? pathname === "/dashboard"
              : item.key === "citizenHome"
                ? pathname === "/citizen"
                : item.key === "citizenReport"
                  ? pathname === "/citizen/report"
                  : item.key === "citizenReports"
                    ? pathname === "/citizen/reports" || pathname.startsWith("/citizen/reports/")
                    : item.key === "citizenSafety"
                      ? pathname === "/citizen/safety"
              : item.key === "myCases"
                ? pathname === "/cases" || (pathname.startsWith("/cases/") && pathname !== "/cases/new")
                : item.key === "createCase"
                  ? pathname === "/cases/new"
                  : item.key === "analysis"
                    ? pathname.startsWith("/analysis")
                    : item.key === "citizenRequests"
                      ? pathname === "/citizen-requests" || pathname.startsWith("/citizen-requests/")
                    : pathname === item.href || pathname.startsWith(item.match);

          const label = t(`nav.${item.key}`);

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              aria-label={label}
              className={isActive ? "active" : undefined}
              href={item.href}
              key={item.key}
              onClick={onCloseMobile}
              title={collapsed ? label : undefined}
            >
              <Icon name={item.icon} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="app-sidebar-card">
        <span className="sidebar-card-icon" aria-hidden="true">
          <Icon name="shield" />
        </span>
        <p>{subtitle}</p>
        <strong>{t("common.currentSelection")}</strong>
      </div>
      </aside>
    </>
  );
}

export function AppHeader({
  mobileNavOpen,
  onToggleSidebar,
  profileBadge,
  profileName,
  profileUnit,
  roleResolutionStatus,
  theme,
  onToggleTheme,
  workspaceRole,
}: {
  mobileNavOpen: boolean;
  onToggleSidebar: () => void;
  profileBadge: string;
  profileName: string;
  profileUnit: string;
  roleResolutionStatus: RoleResolutionStatus;
  theme: Theme;
  onToggleTheme: () => void;
  workspaceRole: WorkspaceRole;
}) {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();
  const subtitle =
    roleResolutionStatus === "resolving"
      ? t("common.loadingWorkspace")
      : workspaceRole === "supervisory"
        ? t("oversight.supervisoryWorkspace")
        : workspaceRole === "citizen"
          ? t("citizen.workspace")
        : workspaceRole === "investigating"
          ? "Investigating Officer"
          : t("common.roleUnavailable");

  const effectiveProfileBadge =
    roleResolutionStatus === "resolving"
      ? "..."
      : workspaceRole === "supervisory"
        ? "SH"
        : profileBadge;

  const effectiveProfileName =
    roleResolutionStatus === "resolving"
      ? t("common.loading")
      : workspaceRole === "supervisory"
        ? t("oversight.stationHead")
        : workspaceRole === "citizen"
          ? t("citizen.workspace")
        : profileName;

  const effectiveProfileUnit =
    roleResolutionStatus === "resolving"
      ? t("common.loadingWorkspace")
      : workspaceRole === "supervisory"
        ? DEMO_SUPERVISORY_SCOPE.policeStation
        : workspaceRole === "citizen"
          ? t("citizen.profileUnit")
        : profileUnit;

  const title = useMemo(() => {
    if (pathname.startsWith("/cases/new")) return t("nav.createCase");
    if (pathname.startsWith("/cases/")) return t("common.openCase");
    if (pathname === "/cases") return t("nav.myCases");
    if (pathname.startsWith("/case-assistant")) return t("common.caseAssistant");
    if (pathname.startsWith("/analysis")) return t("nav.analysis");
    if (pathname.startsWith("/citizen-requests")) return t("nav.citizenRequests");
    if (pathname.startsWith("/citizen/report")) return t("nav.citizenReport");
    if (pathname.startsWith("/citizen/reports")) return t("nav.citizenReports");
    if (pathname.startsWith("/citizen/safety")) return t("nav.citizenSafety");
    if (pathname.startsWith("/citizen")) return t("nav.citizenHome");
    if (pathname.startsWith("/oversight")) return t("nav.oversight");
    if (pathname.startsWith("/settings")) return t("nav.settings");
    return t("nav.dashboard");
  }, [pathname, t]);

  return (
    <header className="app-header">
      <div>
        <p>{subtitle}</p>
        <h1>{title}</h1>
      </div>

      <div className="app-header-actions">
        <button
          className="app-utility-button icon-only app-mobile-nav-toggle"
          type="button"
          onClick={onToggleSidebar}
          aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileNavOpen}
        >
          <Icon name="menu" />
        </button>
        <label className="app-utility-button language-placeholder" aria-label={t("common.languageSelector")}>
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
          <Icon name="chevron" />
        </label>
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
          <span>{effectiveProfileBadge}</span>
          <div>
            <strong>{effectiveProfileName}</strong>
            <em>{effectiveProfileUnit}</em>
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
      <span>{t("common.demoBanner")}</span>
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
    case "menu":
      return (
        <>
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h16" />
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
