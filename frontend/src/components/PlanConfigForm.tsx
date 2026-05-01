"use client";

import styles from "./PlanConfigForm.module.css";
import {
  DEGREE_LEVEL_LABELS,
  DEFAULT_PLANNER_CONFIG,
  PROGRAM_LABELS,
  STUDY_MODE_LABELS,
  type PlannerConfig,
} from "@/lib/plannerData";

export interface PlannerProgramOption {
  value: string;
  label: string;
}

interface PlanConfigFormProps {
  value?: PlannerConfig;
  onChange?: (nextValue: PlannerConfig) => void;
  onGenerate?: (config: PlannerConfig) => void;
  onClear?: () => void;
  compact?: boolean;
  showTitle?: boolean;
  submitLabel?: string;
  clearLabel?: string;
  programOptions?: PlannerProgramOption[];
  programLoading?: boolean;
  programDisabled?: boolean;
  programHelpText?: string | null;
  programError?: string | null;
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
  programOptions,
  programLoading = false,
  programDisabled = false,
  programHelpText,
  programError,
}: PlanConfigFormProps) {
  const safeValue = value ?? DEFAULT_PLANNER_CONFIG;
  const resolvedProgramOptions =
    programOptions ??
    Object.entries(PROGRAM_LABELS).map(([optionValue, label]) => ({
      value: optionValue,
      label,
    }));
  const usingDynamicPrograms = programOptions !== undefined;
  const disableGenerate =
    programDisabled ||
    (usingDynamicPrograms && resolvedProgramOptions.length > 0 && !safeValue.program);

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
      <div className={`${styles.section} ${compact ? styles.compactSection : ""}`}>
        {showTitle ? <h3 className={styles.title}>Study Plan Configuration</h3> : null}

        <div className={`${styles.fields} ${compact ? styles.compactFields : ""}`}>
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
              disabled={programDisabled}
            >
              {usingDynamicPrograms && resolvedProgramOptions.length === 0 ? (
                <option value="">
                  {programLoading ? "Loading courses..." : "No courses available"}
                </option>
              ) : null}
              {resolvedProgramOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {programError ? <p className={styles.errorText}>{programError}</p> : null}
            {!programError && programHelpText ? (
              <p className={styles.helperText}>{programHelpText}</p>
            ) : null}
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
        </div>

        <div className={`${styles.actions} ${compact ? styles.compactActions : ""}`}>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={disableGenerate}
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
      </div>
    </form>
  );
}
