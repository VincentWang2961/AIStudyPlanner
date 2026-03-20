import styles from "./Sidebar.module.css";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "plans", label: "My Plans", icon: "📋" },
  { id: "validation", label: "Validation", icon: "✓" },
  { id: "export", label: "Export", icon: "⬇" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export default function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.branding}>
        <h2>Study Planner</h2>
      </div>

      <nav className={styles.nav}>
        {navItems.map((item) => (
          <a
            key={item.id}
            href="#"
            className={`${styles.navItem} ${
              item.id === "dashboard" ? styles.active : ""
            }`}
          >
            <span className={styles.icon}>{item.icon}</span>
            <span className={styles.label}>{item.label}</span>
          </a>
        ))}
      </nav>

      <div className={styles.footer}>
        <p>AI Study Planner v1.0</p>
      </div>
    </aside>
  );
}
