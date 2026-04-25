"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login, register, type AuthMode } from "@/lib/authApi";
import styles from "./page.module.css";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = React.useState<AuthMode>("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

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

  return (
    <main className={styles.page}>
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
          <div className={styles.toggleRow}>
            <button
              type="button"
              className={mode === "login" ? styles.activeTab : styles.tab}
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
              required
            />
          </div>

          {error ? <p className={styles.errorMessage}>{error}</p> : null}

          <button type="submit" className={styles.primaryBtn} disabled={isSubmitting}>
            {isSubmitting ? "Please wait..." : submitLabel}
          </button>
          <Link href="/create-plan" className={styles.secondaryBtn}>
            Continue as guest
          </Link>
        </form>
      </div>
    </main>
  );
}
