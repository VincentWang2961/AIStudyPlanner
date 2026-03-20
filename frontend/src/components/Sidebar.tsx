"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Sidebar.module.css";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: "📊", href: "/" },
  { id: "plans", label: "My Plans", icon: "📋", href: "/my-plans" },
  { id: "create", label: "Create Plan", icon: "✨", href: "/create-plan" },
  { id: "validation", label: "Validation", icon: "✓", href: "/validate" },
  { id: "settings", label: "Settings", icon: "⚙", href: "#" },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.branding}>
        <h2>Study Planner</h2>
      </div>

      <nav className={styles.nav}>
        {navItems.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={`${styles.navItem} ${
              isActive(item.href) ? styles.active : ""
            }`}
          >
            <span className={styles.icon}>{item.icon}</span>
            <span className={styles.label}>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className={styles.footer}>
        <p>AI Study Planner v1.0</p>
      </div>
    </aside>
  );
}
