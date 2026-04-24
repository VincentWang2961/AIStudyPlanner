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
}

export default function PlanConfigForm({
  value,
  onChange,
  onGenerate,
  onClear,
}: PlanConfigFormProps) {
  const safeValue = value ?? DEFAULT_PLANNER_CONFIG;

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
    <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
      <div className={styles.section}>
        <h3 className={styles.title}>Study Plan Configuration</h3>

        <div className={styles.formGroup}>
          <label className={styles.label}>Degree Level *</label>
          <select
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
          <label className={styles.label}>Program *</label>
          <select
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
          <label className={styles.label}>Study Mode *</label>
          <select
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
          <label className={styles.label}>Number of Semesters *</label>
          <input
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
          <label className={styles.label}>Preferred Units per Semester</label>
          <input
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

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => onGenerate?.(safeValue)}
          >
            Generate Plan
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => onClear?.()}
          >
            Clear
          </button>
        </div>
      </div>
    </form>
  );
}
