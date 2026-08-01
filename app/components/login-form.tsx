"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "./app-shell";
import { useLanguage } from "./language-provider";

export function LoginForm() {
  const router = useRouter();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState("");

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

      router.push("/dashboard");
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
              <em>{t("login.brandTag")}</em>
            </span>
          </Link>

          <div className="login-context-copy">
            <p className="page-eyebrow">{t("login.authorisedAccess")}</p>
            <h1 id="login-title">{t("login.signInToCaseflow")}</h1>
            <p>{t("login.intro")}</p>
          </div>

          <div className="login-security-card">
            <Icon name="shield" />
            <div>
              <strong>{t("login.restrictedAccess")}</strong>
              <p>{t("login.restrictedAccessCopy")}</p>
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

          <p className="login-privacy-note">{t("login.privacyNote")}</p>
        </form>
      </section>

      <footer className="login-footer-note">{t("login.emergencyNotice")}</footer>
    </main>
  );
}
