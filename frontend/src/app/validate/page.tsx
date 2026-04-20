import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import styles from "./page.module.css";
import { DEFAULT_PLANNER_CONFIG, generateDraftPlan } from "@/lib/plannerData";
import { validatePlan } from "@/utils/validationRules";

export default function ValidatePage() {
  const plan = generateDraftPlan(DEFAULT_PLANNER_CONFIG);
  const validation = validatePlan(plan, plan.flatMap((semester) => semester.units.map((unit) => unit.code)));

  return (
    <div className={styles.layout}>
      <Sidebar />
      <div className={styles.main}>
        <Header
          title="Validation Report"
          subtitle="A deeper report view that supports the main planner rather than replacing it."
        />

        <div className={styles.content}>
          <div className={styles.workspace}>
            <section className={styles.summaryCard}>
              <h2>Current report summary</h2>
              <div className={styles.summaryGrid}>
                <div><span>Program</span><strong>Computer Science</strong></div>
                <div><span>Semesters</span><strong>{plan.length}</strong></div>
                <div><span>Total units</span><strong>{plan.flatMap((semester) => semester.units).length}</strong></div>
                <div><span>Overall status</span><strong>{validation.overallStatus}</strong></div>
              </div>
            </section>

            <section className={styles.reportCard}>
              <h2>Grouped issues</h2>
              <div className={styles.issueGrid}>
                {Object.entries(validation.groupedByCategory).map(([category, issues]) => (
                  <article key={category} className={styles.issuePanel}>
                    <h3>{category}</h3>
                    {issues.map((issue, index) => (
                      <div key={index} className={`${styles.issueItem} ${styles[issue.severity]}`}>
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
      </div>
    </div>
  );
}
