"use client";

import styles from "./PlanConfigForm.module.css";
import {
  DEFAULT_PLANNER_CONFIG,
  PROGRAM_LABELS,
  type PlannerConfig,
} from "@/lib/plannerData";

export interface PlannerProgramOption {
  value: string;
  label: string;
}

export interface PlannerSpecialisationOption {
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
  specialisationOptions?: PlannerSpecialisationOption[];
  specialisationValue?: string;
  onSpecialisationChange?: (nextValue: string) => void;
  maxSemesters?: number;
  maxUnitsPerSemester?: number;
  warnings?: string[];
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
  specialisationOptions = [],
  specialisationValue = "",
  onSpecialisationChange,
  maxSemesters = 12,
  maxUnitsPerSemester = 6,
  warnings = [],
}: PlanConfigFormProps) {
  const safeValue = value ?? DEFAULT_PLANNER_CONFIG;
  const idPrefix = compact ? "compact-plan-config" : "plan-config";
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
      <fieldset className={`${styles.section} ${compact ? styles.compactSection : ""}`}>
        {showTitle ? <legend className={styles.title}>Study Plan Configuration</legend> : null}

        <div className={`${styles.fields} ${compact ? styles.compactFields : ""}`}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor={`${idPrefix}-program`}>Course *</label>
            <select
              id={`${idPrefix}-program`}
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
            <label className={styles.label} htmlFor={`${idPrefix}-specialisation`}>Specialisation</label>
            <select
              id={`${idPrefix}-specialisation`}
              className={styles.select}
              value={specialisationValue}
              onChange={(event) => onSpecialisationChange?.(event.target.value)}
              disabled={specialisationOptions.length === 0}
            >
              <option value="">
                {specialisationOptions.length > 0 ? "No specialisation selected" : "No specialisations available"}
              </option>
              {specialisationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
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
              max={maxSemesters}
              value={safeValue.semesters}
              onChange={(e) =>
                updateField(
                  "semesters",
                  Math.min(maxSemesters, Math.max(1, Number(e.target.value) || 1))
                )
              }
              className={styles.input}
            />
            <p className={styles.helperText}>Maximum {maxSemesters} semester{maxSemesters !== 1 ? "s" : ""}.</p>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor={`${idPrefix}-units-per-semester`}>Preferred Units per Semester</label>
            <input
              id={`${idPrefix}-units-per-semester`}
              type="number"
              min="1"
              max={maxUnitsPerSemester}
              value={safeValue.unitsPerSemester}
              onChange={(e) =>
                updateField(
                  "unitsPerSemester",
                  Math.min(maxUnitsPerSemester, Math.max(1, Number(e.target.value) || 1))
                )
              }
              className={styles.input}
            />
          </div>
        </div>

        {warnings.length > 0 ? (
          <div className={styles.warningList} role="status" aria-live="polite">
            {warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}

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
      </fieldset>
    </form>
  );
}
