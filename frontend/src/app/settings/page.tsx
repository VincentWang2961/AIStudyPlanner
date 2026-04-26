"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";
import { useTheme, type Theme } from "@/components/ThemeProvider";
import { getCurrentUser, logout, type AuthUser } from "@/lib/authApi";
import styles from "./page.module.css";

const themeOptions: Array<{
  value: Theme;
  title: string;
  description: string;
  previewLabel: string;
}> = [
  {
    value: "light",
    title: "Light mode",
    description: "Warm white surfaces with deep navy structure and soft gold accents.",
    previewLabel: "Clean workspace",
  },
  {
    value: "dark",
    title: "Dark mode",
    description: "Ink navy background with elevated panels and premium gold highlights.",
    previewLabel: "Focused workspace",
  },
];

export default function SettingsPage() {
  const { theme, setThemeMode } = useTheme();
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = React.useState(true);

  React.useEffect(() => {
    let active = true;

    getCurrentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .finally(() => {
        if (active) setIsLoadingUser(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  return (
    <div className={styles.layout}>
      <Sidebar />

      <main className={styles.main}>
        <div className={styles.content}>
          <section className={styles.panel}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Account</h2>
                <p>Manage the current browser session for this planning workspace.</p>
              </div>
              <span className={styles.currentBadge}>
                {isLoadingUser ? "Checking" : user ? "Signed in" : "Guest"}
              </span>
            </div>

            <div className={styles.accountRow}>
              <div>
                <span className={styles.accountLabel}>Current session</span>
                <strong>{user?.email ?? "Guest user"}</strong>
              </div>

              {user ? (
                <button type="button" className={styles.secondaryAction} onClick={handleLogout}>
                  Sign out
                </button>
              ) : (
                <a className={styles.secondaryAction} href="/auth">
                  Sign in
                </a>
              )}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Appearance</h2>
                <p>Switch the product theme between light and dark versions.</p>
              </div>
              <span className={styles.currentBadge}>Current: {theme === "dark" ? "Dark" : "Light"}</span>
            </div>

            <div className={styles.themeGrid}>
              {themeOptions.map((option) => {
                const selected = theme === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.themeCard} ${selected ? styles.selected : ""}`}
                    onClick={() => setThemeMode(option.value)}
                    aria-pressed={selected}
                  >
                    <div className={`${styles.preview} ${option.value === "dark" ? styles.darkPreview : styles.lightPreview}`}>
                      <div className={styles.previewSidebar} />
                      <div className={styles.previewMain}>
                        <span />
                        <strong />
                        <em />
                      </div>
                    </div>

                    <div className={styles.themeText}>
                      <div>
                        <h3>{option.title}</h3>
                        <p>{option.description}</p>
                      </div>
                      <span className={styles.statusPill}>{selected ? "Selected" : "Select"}</span>
                    </div>

                    <span className={styles.previewLabel}>{option.previewLabel}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
