"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "./app-shell";
import { useLanguage } from "./language-provider";

type LoginMode = "police" | "citizen";

export function LoginForm({ mode = "police" }: { mode?: LoginMode }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const isCitizenMode = mode === "citizen";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError("");
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setAuthError(t("common.authError"));
        setIsLoading(false);
        return;
      }

      router.push(isCitizenMode ? "/citizen" : "/dashboard");
      router.refresh();
    } catch {
      setAuthError(t("common.authError"));
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== "Enter" || isLoading) return;

    event.preventDefault();
    event.currentTarget.requestSubmit();
  };

  return (
    <main className="login-screen">
      <section className="login-shell app-page-enter" aria-labelledby="login-title">
        <div className="login-context-panel">
          <Link className="login-brand" href="/" aria-label="CaseFlow AI landing page">
            <span className="app-brand-mark" aria-hidden="true">
              <Icon name="layers" />
            </span>
            <span>
              <strong>CaseFlow AI</strong>
              <em>{isCitizenMode ? "Citizen demonstration portal" : t("login.brandTag")}</em>
            </span>
          </Link>

          <div className="login-context-copy">
            <p className="page-eyebrow">{isCitizenMode ? "Citizen access" : t("login.authorisedAccess")}</p>
            <h1 id="login-title">{isCitizenMode ? "Sign in to Citizen Portal" : t("login.signInToCaseflow")}</h1>
            <p>
              {isCitizenMode
                ? "Use this route for the citizen demonstration workspace only."
                : t("login.intro")}
            </p>
          </div>

          <div className="login-security-card">
            <Icon name="shield" />
            <div>
              <strong>{isCitizenMode ? "Demonstration-only flow" : t("login.restrictedAccess")}</strong>
              <p>
                {isCitizenMode
                  ? "Demonstration portal only. Reports submitted here are stored on this device and are not sent to police or emergency services."
                  : t("login.restrictedAccessCopy")}
              </p>
            </div>
          </div>
        </div>

        <form className="login-card" onKeyDown={handleKeyDown} onSubmit={handleSubmit}>
          <div className="login-warning" role="status">
            <Icon name="alert" />
            <span>{t("warnings.fictionalData")}</span>
          </div>

          <div className="login-form-stack">
            <label className="login-field">
              <span>{t("login.emailLabel")}</span>
              <input
                autoComplete="email"
                inputMode="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("login.placeholderEmail")}
                required
                type="email"
                value={email}
              />
            </label>

            <label className="login-field">
              <span>{t("login.passwordLabel")}</span>
              <span className="login-password-control">
                <input
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t("login.placeholderPassword")}
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  {showPassword ? t("login.hide") : t("login.show")}
                </button>
              </span>
            </label>
          </div>

          {authError ? (
            <div className="login-inline-error" role="status">
              <Icon name="alert" />
              <span>{authError}</span>
            </div>
          ) : (
            <div className="login-inline-error empty" aria-hidden="true" />
          )}

          <button className="login-submit button button-primary" disabled={isLoading} type="submit">
            {isLoading ? t("common.signingIn") : t("common.signIn")}
            <Icon name="arrow" />
          </button>

          <a className="login-citizen-link" href="/citizen">
            Citizen Portal
          </a>

          <p className="login-privacy-note">
            {isCitizenMode
              ? "Do not use this demonstration portal for emergencies. Contact the appropriate local emergency service."
              : t("login.privacyNote")}
          </p>
        </form>
      </section>

      <footer className="login-footer-note">
        {isCitizenMode
          ? "Do not use this demonstration portal for emergencies. Contact the appropriate local emergency service."
          : t("login.emergencyNotice")}
      </footer>
    </main>
  );
}
