"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React from "react";
import { getCurrentUser, logout, type AuthUser } from "@/lib/authApi";
import CyberIcon from "./CyberIcon";
import styles from "./Sidebar.module.css";

const navItems = [
  { id: "planner", label: "Planner", icon: "planner", href: "/create-plan" },
  { id: "plans", label: "My Plans", icon: "plans", href: "/my-plans" },
  { id: "units", label: "Units", icon: "units", href: "/units" },
  { id: "settings", label: "Settings", icon: "settings", href: "/settings" },
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const showOverviewButton = !pathname.startsWith("/auth");
  const isOverviewPage = pathname === "/";
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = React.useState(true);
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [sessionError, setSessionError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;

    const loadUser = () => {
      setIsLoadingUser(true);
      getCurrentUser()
        .then((currentUser) => {
          if (active) setUser(currentUser);
        })
        .finally(() => {
          if (active) setIsLoadingUser(false);
        });
    };

    loadUser();
    window.addEventListener("auth-session-updated", loadUser);

    return () => {
      active = false;
      window.removeEventListener("auth-session-updated", loadUser);
    };
  }, []);

  const handleLogout = async () => {
    setIsSigningOut(true);
    setSessionError(null);

    try {
      await logout();
      setUser(null);
      window.dispatchEvent(new Event("auth-session-updated"));
      // Redirect to landing page after sign-out
      router.push("/");
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Unable to sign out.");
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.branding}>
        <span className={styles.brandMark} aria-hidden="true">
          <span className={styles.brandGlow} />
          <span className={styles.brandOrbit} />
          <span className={styles.brandGlyph}>AI</span>
        </span>
        <div>
          <h2>Study Planner</h2>
        </div>
      </div>

      <nav className={styles.nav} aria-label="Primary navigation">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`${styles.navItem} ${active ? styles.active : ""}`}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
            >
              <span className={styles.icon}>
                <CyberIcon variant={item.icon} />
              </span>
              <span className={styles.label}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        {showOverviewButton ? (
          <div className={styles.authActions} aria-label="Account actions">
            {user ? (
              <button
                type="button"
                className={styles.authButton}
                onClick={handleLogout}
                disabled={isLoadingUser || isSigningOut}
                aria-busy={isSigningOut}
              >
                {isSigningOut ? "Signing out" : "Sign out"}
              </button>
            ) : (
              <Link className={styles.authButton} href="/auth">
                Sign in
              </Link>
            )}
            {sessionError ? (
              <span className={styles.authError} role="alert">
                {sessionError}
              </span>
            ) : null}
          </div>
        ) : null}

        {showOverviewButton ? (
          <Link
            href="/"
            className={`${styles.overviewButton} ${isOverviewPage ? styles.overviewButtonActive : ""}`}
            aria-current={isOverviewPage ? "page" : undefined}
          >
            <span className={styles.overviewIcon} aria-hidden="true">
              ←
            </span>
            <span className={styles.overviewLabel}>Overview</span>
            <span className={styles.overviewGlow} aria-hidden="true" />
          </Link>
        ) : null}

        <p>AI Study Planner v1.0</p>
      </div>
    </aside>
  );
}
