"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "./app-shell";

export function LoginForm() {
  const router = useRouter();
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
        setAuthError("Invalid email or password.");
        setIsLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setAuthError("Invalid email or password.");
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
              <em>Investigation intelligence workspace</em>
            </span>
          </Link>

          <div className="login-context-copy">
            <p className="page-eyebrow">Authorised Access</p>
            <h1 id="login-title">Sign in to CaseFlow AI</h1>
            <p>
              Access is determined by active role, posting, jurisdiction, and assigned
              responsibilities.
            </p>
          </div>

          <div className="login-security-card">
            <Icon name="shield" />
            <div>
              <strong>Restricted access model</strong>
              <p>
                Access is restricted by role, current posting, territorial jurisdiction,
                and case assignment.
              </p>
            </div>
          </div>
        </div>

        <form className="login-card" onKeyDown={handleKeyDown} onSubmit={handleSubmit}>
          <div className="login-warning" role="status">
            <Icon name="alert" />
            <span>Demonstration environment — fictional case data only.</span>
          </div>

          <div className="login-form-stack">
            <label className="login-field">
              <span>Email address</span>
              <input
                autoComplete="email"
                inputMode="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="authorised.user@example.invalid"
                required
                type="email"
                value={email}
              />
            </label>

            <label className="login-field">
              <span>Password</span>
              <span className="login-password-control">
                <input
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  {showPassword ? "Hide" : "Show"}
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
            {isLoading ? "Signing in..." : "Sign In"}
            <Icon name="arrow" />
          </button>

          <p className="login-privacy-note">
            Privacy-first access controls should be verified before any production
            deployment. Do not enter real case data in this demonstration environment.
          </p>
        </form>
      </section>

      <footer className="login-footer-note">
        For immediate danger, contact official emergency services. CaseFlow AI does not replace
        emergency response systems.
      </footer>
    </main>
  );
}
