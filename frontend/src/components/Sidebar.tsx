"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const showOverviewButton = !pathname.startsWith("/auth");
  const isOverviewPage = pathname === "/";

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

      <nav className={styles.nav}>
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`${styles.navItem} ${active ? styles.active : ""}`}
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
