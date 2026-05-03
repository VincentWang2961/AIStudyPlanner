"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { createGuestSession, login, register, type AuthMode } from "@/lib/authApi";
import styles from "./page.module.css";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = React.useState<AuthMode>("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isStartingGuest, setIsStartingGuest] = React.useState(false);

  const submitLabel = mode === "login" ? "Sign in" : "Create account";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password);
      }

      router.push("/create-plan");
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuestContinue = async () => {
    setError(null);
    setIsStartingGuest(true);

    try {
      await createGuestSession();
      router.push("/create-plan");
    } catch (guestError) {
      setError(guestError instanceof Error ? guestError.message : "Unable to start a guest session.");
    } finally {
      setIsStartingGuest(false);
    }
  };

  return (
    <main id="main-content" className={styles.page}>
      <div className={styles.card}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>Authentication</span>
          <h1>Sign in to save and revisit your plans.</h1>
          <p>
            Use an account when you want your planning workspace tied to a session, or continue
            without signing in when you only need a temporary plan.
          </p>
        </div>

        <form className={styles.formCard} onSubmit={handleSubmit}>
          <div className={styles.toggleRow} role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              className={mode === "login" ? styles.activeTab : styles.tab}
              role="tab"
              aria-selected={mode === "login"}
              onClick={() => {
                setMode("login");
                setError(null);
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === "register" ? styles.activeTab : styles.tab}
              role="tab"
              aria-selected={mode === "register"}
              onClick={() => {
                setMode("register");
                setError(null);
              }}
            >
              Register
            </button>
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="student@uwa.edu.au"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              aria-invalid={Boolean(error)}
              required
            />
          </div>
          <div className={styles.fieldGroup}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={8}
              aria-describedby="password-help"
              required
            />
            <span id="password-help" className={styles.helpText}>Use at least 8 characters.</span>
          </div>

          {error ? <p className={styles.errorMessage} role="alert">{error}</p> : null}

          <button type="submit" className={styles.primaryBtn} disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? "Please wait..." : submitLabel}
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={handleGuestContinue}
            disabled={isSubmitting || isStartingGuest}
            aria-busy={isStartingGuest}
          >
            {isStartingGuest ? "Please wait..." : "Continue as guest"}
          </button>
        </form>
      </div>
    </main>
  );
}
