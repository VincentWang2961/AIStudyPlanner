import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import styles from "./page.module.css";
import { validatePlan } from "@/utils/validationRules";

export default function ValidatePage() {
  const validation = validatePlan([], []);

  return (
    <div className={styles.layout}>
      <Sidebar />
      <main id="main-content" className={styles.main}>
        <Header
          title="Validation Report"
          subtitle="A deeper report view that supports the main planner rather than replacing it."
        />

        <div className={styles.content}>
          <div className={styles.workspace}>
            <section className={styles.summaryCard} aria-labelledby="validation-summary-title">
              <h2 id="validation-summary-title">Current report summary</h2>
              <div className={styles.summaryGrid}>
                <div><span>Program</span><strong>No generated plan</strong></div>
                <div><span>Semesters</span><strong>0</strong></div>
                <div><span>Total units</span><strong>0</strong></div>
                <div><span>Overall status</span><strong>{validation.overallStatus}</strong></div>
              </div>
            </section>

            <section className={styles.reportCard} aria-labelledby="grouped-issues-title">
              <h2 id="grouped-issues-title">Grouped issues</h2>
              <div className={styles.issueGrid}>
                {Object.entries(validation.groupedByCategory).map(([category, issues]) => (
                  <article key={category} className={styles.issuePanel}>
                    <h3>{category}</h3>
                    {issues.map((issue, index) => (
                      <div key={index} className={`${styles.issueItem} ${styles[issue.severity]}`} role="status">
                        <strong>{issue.title}</strong>
                        <p>{issue.message}</p>
                      </div>
                    ))}
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
