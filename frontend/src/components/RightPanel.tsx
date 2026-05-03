import styles from "./RightPanel.module.css";
import CyberIcon from "./CyberIcon";
import { ValidationResult } from "@/utils/validationRules";

interface RightPanelProps {
  validationResult?: ValidationResult;
  currentPlanUnitsCount?: number;
  planGenerated?: boolean;
  aiMessages?: string[];
  validationSource?: "backend" | "local";
  validationError?: string | null;
  validationPending?: boolean;
}

function getStatusIcon(severity: "pass" | "warning" | "fail"): string {
  switch (severity) {
    case "pass":
      return "✓";
    case "warning":
      return "⚠";
    case "fail":
      return "✗";
  }
}

function getOverallStatusText(status: "pass" | "warning" | "fail"): string {
  switch (status) {
    case "pass":
      return "Plan is valid";
    case "warning":
      return "Plan needs review";
    case "fail":
      return "Plan has issues";
  }
}

export default function RightPanel({
  validationResult,
  currentPlanUnitsCount = 0,
  planGenerated = false,
  aiMessages = [],
  validationSource = "local",
  validationError = null,
  validationPending = false,
}: RightPanelProps) {
  return (
    <aside className={styles.panel} aria-label="Planning feedback">
      {planGenerated && validationResult ? (
        <>
          <section className={styles.section} aria-labelledby="validation-summary-panel-title" aria-live="polite">
            <div className={styles.summaryHeader}>
              <h3 id="validation-summary-panel-title" className={styles.title}>
                <CyberIcon variant="validation" size="md" />
                <span>Validation Summary</span>
              </h3>
              <span
                className={`${styles.overallBadge} ${styles[validationResult.overallStatus]}`}
                aria-label={getOverallStatusText(validationResult.overallStatus)}
              >
                {getStatusIcon(validationResult.overallStatus)}
              </span>
            </div>

            <div className={styles.overallStatus}>
              <p className={styles.overallText}>
                {getOverallStatusText(validationResult.overallStatus)}
              </p>
              <p className={styles.statusCount}>
                {currentPlanUnitsCount} unit{currentPlanUnitsCount !== 1 ? "s" : ""} in current plan
              </p>
              <p className={styles.validationMeta}>
                {validationPending
                  ? "Syncing backend validation..."
                  : validationSource === "backend"
                  ? "Showing backend validation feedback"
                  : "Showing local validation fallback"}
              </p>
              {validationError ? (
                <p className={styles.validationNote}>
                  {validationError}
                </p>
              ) : null}
            </div>

            <div className={styles.validationGroups}>
              {Object.entries(validationResult.groupedByCategory).map(([category, categoryIssues]) => {
                if (categoryIssues.length === 0) return null;

                const firstIssue = categoryIssues[0];
                const hasMultiple = categoryIssues.length > 1;

                return (
                  <div
                    key={category}
                    className={`${styles.categoryGroup} ${styles[firstIssue.severity]}`}
                  >
                    <div className={styles.categoryHeader}>
                      <span className={styles.categoryIcon}>{getStatusIcon(firstIssue.severity)}</span>
                      <span className={styles.categoryTitle}>{firstIssue.title}</span>
                      {hasMultiple && <span className={styles.issueCount}>{categoryIssues.length}</span>}
                    </div>
                    <p className={styles.categoryMessage}>{firstIssue.message}</p>
                    {hasMultiple && (
                      <div className={styles.additionalIssues}>
                        {categoryIssues.slice(1).map((issue, index) => (
                          <p key={index} className={styles.additionalMessage}>
                            • {issue.message}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className={styles.section} aria-labelledby="ai-assistant-panel-title">
            <h3 id="ai-assistant-panel-title" className={styles.title}>
              <CyberIcon variant="assistant" size="md" />
              <span>AI Assistant</span>
            </h3>
            <div className={styles.tips}>
              {aiMessages.map((tip, index) => (
                <p key={index} className={styles.tipItem}>
                  {tip}
                </p>
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          <section className={styles.section} aria-labelledby="empty-validation-panel-title">
            <h3 id="empty-validation-panel-title" className={styles.title}>
              <CyberIcon variant="validation" size="md" />
              <span>Validation</span>
            </h3>
            <p className={styles.emptyMessage}>
              Generate a plan to see live validation feedback, issue summaries, and AI guidance.
            </p>
          </section>
          <section className={styles.section} aria-labelledby="empty-assistant-panel-title">
            <h3 id="empty-assistant-panel-title" className={styles.title}>
              <CyberIcon variant="assistant" size="md" />
              <span>AI Assistant</span>
            </h3>
            <p className={styles.emptyMessage}>
              Once a draft plan appears, this panel will explain issues and suggest adjustments.
            </p>
          </section>
        </>
      )}
    </aside>
  );
}
