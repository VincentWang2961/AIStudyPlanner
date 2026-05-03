import styles from "./ValidationSidebar.module.css";

interface ValidationCheck {
  id: string;
  name: string;
  status: "pass" | "warning" | "fail";
}

interface ValidationSidebarProps {
  checks: ValidationCheck[];
  selectedCheck?: string;
  onSelectCheck?: (id: string) => void;
}

export default function ValidationSidebar({
  checks,
  selectedCheck,
  onSelectCheck,
}: ValidationSidebarProps) {
  return (
    <aside className={styles.sidebar} aria-label="Validation checks">
      <h3 className={styles.title}>Validation Checks</h3>

      <div className={styles.checkList} role="list">
        {checks.map((check) => (
          <button
            key={check.id}
            className={`${styles.checkItem} ${
              selectedCheck === check.id ? styles.active : ""
            } ${styles[check.status]}`}
            onClick={() => onSelectCheck?.(check.id)}
            aria-pressed={selectedCheck === check.id}
            aria-label={`${check.name}: ${check.status}`}
          >
            <span className={styles.icon}>
              {check.status === "pass" && "✓"}
              {check.status === "warning" && "⚠"}
              {check.status === "fail" && "✕"}
            </span>
            <span className={styles.label}>{check.name}</span>
          </button>
        ))}
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.count}>
            {checks.filter((c) => c.status === "pass").length}
          </span>
          <span className={styles.statLabel}>Passed</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.count}>
            {checks.filter((c) => c.status === "warning").length}
          </span>
          <span className={styles.statLabel}>Warnings</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.count}>
            {checks.filter((c) => c.status === "fail").length}
          </span>
          <span className={styles.statLabel}>Failed</span>
        </div>
      </div>
    </aside>
  );
}
