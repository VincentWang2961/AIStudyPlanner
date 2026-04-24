"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Sidebar.module.css";

const navItems = [
  { id: "planner", label: "Planner", icon: "✨", href: "/create-plan" },
  { id: "plans", label: "My Plans", icon: "📋", href: "/my-plans" },
  { id: "units", label: "Units", icon: "📚", href: "/units" },
  { id: "settings", label: "Settings", icon: "⚙", href: "/settings" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.branding}>
        <span className={styles.brandMark}>AI</span>
        <div>
          <h2>Study Planner</h2>
          <p>Focused planning with live validation</p>
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
              <span className={styles.icon}>{item.icon}</span>
              <span className={styles.label}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <p>AI Study Planner v1.0</p>
      </div>
    </aside>
  );
}
