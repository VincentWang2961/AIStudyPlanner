"use client";

import styles from "./PlanConfigForm.module.css";
import {
  DEFAULT_PLANNER_CONFIG,
  STUDY_TERM_LABELS,
  withPlannerConfigDefaults,
  type PlannerConfig,
  type StudyTerm,
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
  onUseDefaultPlan?: (config: PlannerConfig) => void;
  onClear?: () => void;
  compact?: boolean;
  showTitle?: boolean;
  submitLabel?: string;
  defaultPlanLabel?: string;
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
  defaultPlanLoading?: boolean;
  defaultPlanDisabled?: boolean;
  defaultPlanHelpText?: string | null;
}

export default function PlanConfigForm({
  value,
  onChange,
  onGenerate,
  onUseDefaultPlan,
  onClear,
  compact = false,
  showTitle = true,
  submitLabel = "Generate Plan",
  defaultPlanLabel = "Use Default Plan",
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
  defaultPlanLoading = false,
  defaultPlanDisabled = false,
  defaultPlanHelpText,
}: PlanConfigFormProps) {
  const safeValue = withPlannerConfigDefaults(value ?? DEFAULT_PLANNER_CONFIG);
  const idPrefix = compact ? "compact-plan-config" : "plan-config";
  const resolvedProgramOptions = programOptions ?? [];
  const usingDynamicPrograms = programOptions !== undefined;
  const disableGenerate =
    programDisabled ||
    (usingDynamicPrograms && resolvedProgramOptions.length > 0 && !safeValue.program);
  const disableDefaultPlan =
    disableGenerate ||
    defaultPlanDisabled ||
    defaultPlanLoading ||
    !specialisationValue;

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
            <label className={styles.label} htmlFor={`${idPrefix}-start-term`}>Start Semester</label>
            <select
              id={`${idPrefix}-start-term`}
              className={styles.select}
              value={safeValue.startTerm}
              onChange={(event) => updateField("startTerm", event.target.value as StudyTerm)}
            >
              <option value="S1">{STUDY_TERM_LABELS.S1}</option>
              <option value="S2">{STUDY_TERM_LABELS.S2}</option>
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
            disabled={disableGenerate || defaultPlanLoading}
            onClick={() => onGenerate?.(safeValue)}
          >
            {submitLabel}
          </button>
          {onUseDefaultPlan ? (
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={disableDefaultPlan}
              onClick={() => onUseDefaultPlan(safeValue)}
              aria-describedby={defaultPlanHelpText ? `${idPrefix}-default-plan-help` : undefined}
            >
              {defaultPlanLoading ? "Loading Default..." : defaultPlanLabel}
            </button>
          ) : null}
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => onClear?.()}
            disabled={defaultPlanLoading}
          >
            {clearLabel}
          </button>
        </div>
        {onUseDefaultPlan && defaultPlanHelpText ? (
          <p
            id={`${idPrefix}-default-plan-help`}
            className={styles.defaultPlanHelpText}
          >
            {defaultPlanHelpText}
          </p>
        ) : null}
      </fieldset>
    </form>
  );
}
