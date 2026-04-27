"use client";

import styles from "./PlanConfigForm.module.css";
import {
  DEGREE_LEVEL_LABELS,
  DEFAULT_PLANNER_CONFIG,
  PROGRAM_LABELS,
  STUDY_MODE_LABELS,
  type PlannerConfig,
} from "@/lib/plannerData";

interface PlanConfigFormProps {
  value?: PlannerConfig;
  onChange?: (nextValue: PlannerConfig) => void;
  onGenerate?: (config: PlannerConfig) => void;
  onClear?: () => void;
  compact?: boolean;
  showTitle?: boolean;
  submitLabel?: string;
  clearLabel?: string;
}

export default function PlanConfigForm({
  value,
  onChange,
  onGenerate,
  onClear,
  compact = false,
  showTitle = true,
  submitLabel = "Generate Plan",
  clearLabel = "Clear",
}: PlanConfigFormProps) {
  const safeValue = value ?? DEFAULT_PLANNER_CONFIG;
  const idPrefix = compact ? "compact-plan-config" : "plan-config";

  const updateField = <K extends keyof PlannerConfig>(
    field: K,
    nextValue: PlannerConfig[K]
  ) => {
    onChange?.({
      ...safeValue,
      [field]: nextValue,
    });
  };

  return (
    <form
      className={`${styles.form} ${compact ? styles.compactForm : ""}`}
      onSubmit={(e) => e.preventDefault()}
    >
      <fieldset className={`${styles.section} ${compact ? styles.compactSection : ""}`}>
        {showTitle ? <legend className={styles.title}>Study Plan Configuration</legend> : null}

        <div className={`${styles.fields} ${compact ? styles.compactFields : ""}`}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor={`${idPrefix}-degree-level`}>Degree Level *</label>
            <select
              id={`${idPrefix}-degree-level`}
              className={styles.select}
              value={safeValue.degreeLevel}
              onChange={(e) => updateField("degreeLevel", e.target.value)}
            >
              {Object.entries(DEGREE_LEVEL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor={`${idPrefix}-program`}>Program *</label>
            <select
              id={`${idPrefix}-program`}
              className={styles.select}
              value={safeValue.program}
              onChange={(e) => updateField("program", e.target.value)}
            >
              {Object.entries(PROGRAM_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor={`${idPrefix}-study-mode`}>Study Mode *</label>
            <select
              id={`${idPrefix}-study-mode`}
              className={styles.select}
              value={safeValue.studyMode}
              onChange={(e) => updateField("studyMode", e.target.value)}
            >
              {Object.entries(STUDY_MODE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor={`${idPrefix}-semesters`}>Number of Semesters *</label>
            <input
              id={`${idPrefix}-semesters`}
              type="number"
              min="1"
              max="12"
              value={safeValue.semesters}
              onChange={(e) =>
                updateField("semesters", Math.min(12, Math.max(1, Number(e.target.value) || 1)))
              }
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor={`${idPrefix}-units-per-semester`}>Preferred Units per Semester</label>
            <input
              id={`${idPrefix}-units-per-semester`}
              type="number"
              min="1"
              max="6"
              value={safeValue.unitsPerSemester}
              onChange={(e) =>
                updateField(
                  "unitsPerSemester",
                  Math.min(6, Math.max(1, Number(e.target.value) || 1))
                )
              }
              className={styles.input}
            />
          </div>
        </div>

        <div className={`${styles.actions} ${compact ? styles.compactActions : ""}`}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => onGenerate?.(safeValue)}
          >
            {submitLabel}
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => onClear?.()}
          >
            {clearLabel}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
