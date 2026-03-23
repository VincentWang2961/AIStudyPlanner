import styles from "./RightPanel.module.css";

export default function RightPanel() {
  return (
    <aside className={styles.panel}>
      <div className={styles.section}>
        <h3 className={styles.title}>Validation Status</h3>
        <div className={styles.status}>
          <div className={styles.statusItem}>
            <span className={styles.label}>Prerequisites:</span>
            <span className={`${styles.badge} ${styles.success}`}>✓ OK</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.label}>Workload:</span>
            <span className={`${styles.badge} ${styles.warning}`}>⚠ High</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.label}>Availability:</span>
            <span className={`${styles.badge} ${styles.success}`}>✓ OK</span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.title}>AI Assistant Tips</h3>
        <div className={styles.tips}>
          <p>💡 Consider spreading electives across semesters</p>
          <p>💡 Check lab session times before confirming</p>
          <p>💡 Some units have high prerequisites</p>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.title}>Quick Actions</h3>
        <div className={styles.actions}>
          <button className={styles.actionBtn}>Regenerate Plan</button>
          <button className={styles.actionBtn}>Export PDF</button>
        </div>
      </div>
    </aside>
  );
}
