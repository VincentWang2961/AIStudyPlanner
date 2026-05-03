"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";
import PlanConfigForm, {
  type PlannerProgramOption,
} from "@/components/PlanConfigForm";
import UnitCard from "@/components/UnitCard";
import RightPanel from "@/components/RightPanel";
import {
  buildDraftPlanFromCourse,
  generateAiStudyPlan,
  toSemesterPlan,
  type AiStudyPlanResponse,
} from "@/lib/aiPlannerApi";
import { saveStudyPlan } from "@/lib/planApi";
import {
  buildPlannerValidationRequest,
  validatePlannerPlan,
} from "@/lib/plannerValidationApi";
import {
  fetchCourseDetails,
  fetchCourses,
  formatCourseOptionLabel,
  type CourseDetails,
  type CourseSummary,
} from "@/lib/courseApi";
import {
  DEGREE_LEVEL_LABELS,
  DEFAULT_PLANNER_CONFIG,
  STUDY_MODE_LABELS,
  flattenUnits,
  generateDraftPlan,
  getTotalCredits,
  type PlanUnit,
  type PlannerConfig,
  type SemesterPlan,
} from "@/lib/plannerData";
import {
  validatePlan,
  type ValidationResult,
} from "@/utils/validationRules";
import styles from "./page.module.css";

interface SelectedUnitRef {
  semesterId: number;
  unitCode: string;
}

function buildAiMessages(plan: SemesterPlan[]): string[] {
  const units = flattenUnits(plan);
  const messages: string[] = [];

  if (plan.some((semester) => semester.units.length > 4)) {
    messages.push("At least one semester looks heavy. Consider spreading difficult units across later study periods.");
  }
  if (!units.some((unit) => unit.code.startsWith("MATH"))) {
    messages.push("A mathematics foundation would strengthen many technical pathways in later semesters.");
  }
  if (units.some((unit) => unit.type === "elective")) {
    messages.push("You have some flexibility in the current draft. Use electives to balance workload and interests.");
  }
  if (messages.length === 0) {
    messages.push("The current draft looks balanced. Review unit details before you finalise or export the plan.");
    messages.push("Use the unit detail view to inspect prerequisites, availability, and alternatives.");
  }

  return messages.slice(0, 3);
}

function buildCourseSummaryMessage(courseDetails: CourseDetails): string[] {
  const messages: string[] = [];

  if (courseDetails.minPoints !== null || courseDetails.maxPoints !== null) {
    const lower = courseDetails.minPoints ?? courseDetails.maxPoints;
    const upper = courseDetails.maxPoints ?? courseDetails.minPoints;
    messages.push(`Course requirements span ${lower}-${upper} credit points.`);
  }

  if (courseDetails.maxYears !== null) {
    messages.push(`The handbook time limit for this course is ${courseDetails.maxYears} years.`);
  }

  if (courseDetails.specialisations.length > 0) {
    messages.push(`Available specialisations include ${courseDetails.specialisations.join(", ")}.`);
  }

  return messages;
}

export default function PlannerPage() {
  const [planConfig, setPlanConfig] = React.useState<PlannerConfig>(DEFAULT_PLANNER_CONFIG);
  const [activePlanConfig, setActivePlanConfig] = React.useState<PlannerConfig | null>(null);
  const [generatedPlan, setGeneratedPlan] = React.useState<SemesterPlan[]>([]);
  const [planGenerated, setPlanGenerated] = React.useState(false);
  const [selectedUnit, setSelectedUnit] = React.useState<SelectedUnitRef | null>(null);
  const [isSetupPopoverOpen, setIsSetupPopoverOpen] = React.useState(false);
  const [aiPreferences, setAiPreferences] = React.useState("I want a balanced plan with clear prerequisite sequencing.");
  const [aiPlanResponse, setAiPlanResponse] = React.useState<AiStudyPlanResponse | null>(null);
  const [availableCourses, setAvailableCourses] = React.useState<CourseSummary[]>([]);
  const [selectedCourseDetails, setSelectedCourseDetails] = React.useState<CourseDetails | null>(null);
  const [courseLoadError, setCourseLoadError] = React.useState<string | null>(null);
  const [isLoadingCourses, setIsLoadingCourses] = React.useState(true);
  const [generationError, setGenerationError] = React.useState<string | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [savedPlanId, setSavedPlanId] = React.useState<string | undefined>(undefined);
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [backendValidation, setBackendValidation] = React.useState<ValidationResult | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [isValidatingPlan, setIsValidatingPlan] = React.useState(false);
  const setupPopoverRef = React.useRef<HTMLDivElement | null>(null);
  const setupTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const validationRequestIdRef = React.useRef(0);

  const programOptions = React.useMemo<PlannerProgramOption[]>(
    () =>
      availableCourses.map((course) => ({
        value: course.code,
        label: formatCourseOptionLabel(course),
      })),
    [availableCourses]
  );
  const selectedCourseSummary = React.useMemo(
    () => availableCourses.find((course) => course.code === planConfig.program) ?? null,
    [availableCourses, planConfig.program]
  );
  const activeCourseSummary = React.useMemo(
    () =>
      activePlanConfig
        ? availableCourses.find((course) => course.code === activePlanConfig.program) ?? null
        : null,
    [activePlanConfig, availableCourses]
  );
  const allUnits = React.useMemo(() => flattenUnits(generatedPlan), [generatedPlan]);
  const totalCredits = React.useMemo(() => getTotalCredits(generatedPlan), [generatedPlan]);
  const localValidationResult = React.useMemo(
    () => (planGenerated ? validatePlan(generatedPlan, allUnits.map((unit) => unit.code)) : undefined),
    [generatedPlan, planGenerated, allUnits]
  );
  const validationResult = backendValidation ?? localValidationResult;
  const validationSource = backendValidation ? "backend" : "local";
  const aiMessages = React.useMemo(
    () => {
      if (!planGenerated) return [];

      if (aiPlanResponse) {
        return [
          aiPlanResponse.explanation.overview,
          ...aiPlanResponse.explanation.electiveRationales,
          ...aiPlanResponse.warnings,
        ].filter(Boolean).slice(0, 3);
      }

      const courseMessages = selectedCourseDetails
        ? buildCourseSummaryMessage(selectedCourseDetails)
        : [];

      return [...courseMessages, ...buildAiMessages(generatedPlan)].slice(0, 3);
    },
    [aiPlanResponse, generatedPlan, planGenerated, selectedCourseDetails]
  );

  const selectedUnitDetails: PlanUnit | undefined = React.useMemo(() => {
    if (!selectedUnit) return undefined;
    return generatedPlan
      .find((semester) => semester.id === selectedUnit.semesterId)
      ?.units.find((unit) => unit.code === selectedUnit.unitCode);
  }, [generatedPlan, selectedUnit]);

  React.useEffect(() => {
    const controller = new AbortController();

    async function loadCourses() {
      setIsLoadingCourses(true);
      setCourseLoadError(null);

      try {
        const courses = await fetchCourses(controller.signal);
        setAvailableCourses(courses);

        if (courses.length > 0) {
          setPlanConfig((currentConfig) => {
            if (courses.some((course) => course.code === currentConfig.program)) {
              return currentConfig;
            }

            return {
              ...currentConfig,
              program: courses[0].code,
            };
          });
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        setCourseLoadError(
          error instanceof Error ? error.message : "Unable to load the course catalogue."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingCourses(false);
        }
      }
    }

    loadCourses();

    return () => controller.abort();
  }, []);

  React.useEffect(() => {
    setSelectedCourseDetails((currentDetails) =>
      currentDetails?.code === planConfig.program ? currentDetails : null
    );
  }, [planConfig.program]);

  React.useEffect(() => {
    if (!planGenerated || !isSetupPopoverOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (setupPopoverRef.current?.contains(target) || setupTriggerRef.current?.contains(target)) {
        return;
      }
      setIsSetupPopoverOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSetupPopoverOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [planGenerated, isSetupPopoverOpen]);

  React.useEffect(() => {
    if (!planGenerated || generatedPlan.length === 0 || !activePlanConfig?.program) {
      setBackendValidation(null);
      setValidationError(null);
      setIsValidatingPlan(false);
      return;
    }

    const controller = new AbortController();
    const requestId = validationRequestIdRef.current + 1;
    validationRequestIdRef.current = requestId;

    setBackendValidation(null);
    setValidationError(null);
    setIsValidatingPlan(true);

    validatePlannerPlan(
      buildPlannerValidationRequest({
        courseCode: activePlanConfig.program,
        completedUnits: [],
        selectedSpecialisations: [],
        plan: generatedPlan,
      }),
      controller.signal
    )
      .then((result) => {
        if (controller.signal.aborted || requestId !== validationRequestIdRef.current) {
          return;
        }

        setBackendValidation(result);
      })
      .catch((error) => {
        if (controller.signal.aborted || requestId !== validationRequestIdRef.current) {
          return;
        }

        setBackendValidation(null);
        setValidationError(
          error instanceof Error ? error.message : "Backend validation is unavailable right now."
        );
      })
      .finally(() => {
        if (controller.signal.aborted || requestId !== validationRequestIdRef.current) {
          return;
        }

        setIsValidatingPlan(false);
      });

    return () => controller.abort();
  }, [activePlanConfig, generatedPlan, planGenerated]);

  const buildUserMessage = (nextConfig: PlannerConfig, courseDetails?: CourseDetails | null) => {
    const programLabel =
      courseDetails?.title ?? selectedCourseSummary?.title ?? nextConfig.program;
    const modeLabel = STUDY_MODE_LABELS[nextConfig.studyMode] ?? nextConfig.studyMode;

    return [
      `Create a ${nextConfig.semesters}-semester study plan for ${programLabel} (${nextConfig.program}).`,
      `Study mode: ${modeLabel}.`,
      `Preferred units per semester: ${nextConfig.unitsPerSemester}.`,
      courseDetails?.specialisations.length
        ? `Course specialisations: ${courseDetails.specialisations.join(", ")}.`
        : "No specialisation preference was provided by the course catalogue.",
      `Student preferences: ${aiPreferences.trim() || "No additional preferences provided."}`,
    ].join(" ");
  };

  const applyLocalDraftPlan = (
    nextConfig: PlannerConfig,
    courseDetails?: CourseDetails | null
  ) => {
    setPlanConfig(nextConfig);
    setActivePlanConfig(nextConfig);
    setGeneratedPlan(
      courseDetails ? buildDraftPlanFromCourse(nextConfig, courseDetails) : generateDraftPlan(nextConfig)
    );
    setPlanGenerated(true);
    setAiPlanResponse(null);
    setSavedPlanId(undefined);
    setSaveMessage(null);
    setSaveError(null);
    setSelectedUnit(null);
    setIsSetupPopoverOpen(false);
    if (courseDetails) {
      setSelectedCourseDetails(courseDetails);
    }
  };

  const handleGeneratePlan = async (nextConfig: PlannerConfig) => {
    if (!nextConfig.program) {
      setGenerationError("Select a course before generating a plan.");
      return;
    }

    setPlanConfig(nextConfig);
    setGenerationError(null);
    setIsGenerating(true);

    try {
      const courseDetails = await fetchCourseDetails(nextConfig.program);
      setSelectedCourseDetails(courseDetails);
      const response = await generateAiStudyPlan({
        programCode: nextConfig.program,
        userMessage: buildUserMessage(nextConfig, courseDetails),
      });

      setActivePlanConfig(nextConfig);
      setGeneratedPlan(toSemesterPlan(response, courseDetails));
      setPlanGenerated(true);
      setAiPlanResponse(response);
      setSavedPlanId(undefined);
      setSaveMessage(null);
      setSaveError(null);
      setSelectedUnit(null);
      setIsSetupPopoverOpen(false);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Unable to generate an AI study plan.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClearPlan = () => {
    setPlanConfig({
      ...DEFAULT_PLANNER_CONFIG,
      program: availableCourses[0]?.code ?? DEFAULT_PLANNER_CONFIG.program,
    });
    setActivePlanConfig(null);
    setGeneratedPlan([]);
    setPlanGenerated(false);
    setSelectedUnit(null);
    setIsSetupPopoverOpen(false);
    setAiPlanResponse(null);
    setSelectedCourseDetails(null);
    setGenerationError(null);
    setSavedPlanId(undefined);
    setSaveMessage(null);
    setSaveError(null);
    setBackendValidation(null);
    setValidationError(null);
    setIsValidatingPlan(false);
  };

  const handleSavePlan = async () => {
    if (!planGenerated || generatedPlan.length === 0) return;

    const planConfigToSave = activePlanConfig ?? planConfig;
    const courseCode = planConfigToSave.program;
    const programName =
      activeCourseSummary?.title ??
      selectedCourseDetails?.title ??
      courseCode;

    setIsSaving(true);
    setSaveMessage(null);
    setSaveError(null);

    try {
      const savedPlan = await saveStudyPlan({
        id: savedPlanId,
        name: `${programName} Plan`,
        courseCode,
        program: programName,
        config: planConfigToSave,
        planData: generatedPlan,
      });

      setSavedPlanId(savedPlan.id);
      setSaveMessage("Plan saved.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save study plan.");
    } finally {
      setIsSaving(false);
    }
  };

  const moveUnitToNextSemester = () => {
    if (!selectedUnit) return;

    setGeneratedPlan((currentPlan) => {
      const semesterIndex = currentPlan.findIndex((semester) => semester.id === selectedUnit.semesterId);
      if (semesterIndex === -1 || semesterIndex === currentPlan.length - 1) return currentPlan;

      const currentSemester = currentPlan[semesterIndex];
      const unit = currentSemester.units.find((item) => item.code === selectedUnit.unitCode);
      if (!unit) return currentPlan;

      return currentPlan.map((semester, index) => {
        if (index === semesterIndex) {
          return {
            ...semester,
            units: semester.units.filter((item) => item.code !== selectedUnit.unitCode),
          };
        }
        if (index === semesterIndex + 1) {
          return {
            ...semester,
            units: [...semester.units, unit],
          };
        }
        return semester;
      });
    });

    setSelectedUnit(null);
    setSaveMessage(null);
  };

  const removeUnitFromPlan = () => {
    if (!selectedUnit) return;

    setGeneratedPlan((currentPlan) =>
      currentPlan.map((semester) =>
        semester.id === selectedUnit.semesterId
          ? {
              ...semester,
              units: semester.units.filter((item) => item.code !== selectedUnit.unitCode),
            }
          : semester
      )
    );

    setSelectedUnit(null);
    setSaveMessage(null);
  };

  return (
    <div className={styles.layout}>
      <Sidebar />
      <main id="main-content" className={styles.main}>
        <div className={styles.content}>
          <div className={styles.plannerWorkspace} aria-busy={isGenerating}>
            {planGenerated ? (
              <section className={styles.setupDock}>
                <div className={styles.compactSetupBar}>
                  <div className={styles.compactSetupCopy}>
                    <span className={styles.compactSetupEyebrow}>Draft Generated</span>
                    <h2 className={styles.compactSetupHeading}>Study Plan Overview</h2>
                    <p className={styles.compactSetupText}>
                      Your semesters are now front and center. Reopen setup any time to tune
                      the inputs and regenerate.
                    </p>
                  </div>

                  <div className={styles.compactSetupActions}>
                    <button
                      ref={setupTriggerRef}
                      type="button"
                      className={styles.setupTrigger}
                      onClick={() => setIsSetupPopoverOpen((open) => !open)}
                      aria-expanded={isSetupPopoverOpen}
                      aria-controls="plan-setup-popover"
                      aria-label={isSetupPopoverOpen ? "Close plan setup" : "Edit plan setup"}
                    >
                      {isSetupPopoverOpen ? "Close Setup" : "Edit Setup"}
                    </button>
                  </div>
                </div>

                {isSetupPopoverOpen ? (
                  <div
                    ref={setupPopoverRef}
                    id="plan-setup-popover"
                    className={styles.setupPopover}
                  >
                    <div className={styles.setupPopoverHeader}>
                      <div>
                        <h3>Adjust Plan Inputs</h3>
                        <p>Change the values below, then regenerate the draft when you are ready.</p>
                      </div>
                    </div>

                    <PlanConfigForm
                      compact
                      showTitle={false}
                      value={planConfig}
                      onChange={setPlanConfig}
                      onGenerate={handleGeneratePlan}
                      onClear={handleClearPlan}
                      programOptions={programOptions}
                      programLoading={isLoadingCourses}
                      programDisabled={isLoadingCourses || Boolean(courseLoadError)}
                      programHelpText={
                        selectedCourseSummary?.specialisations.length
                          ? `Specialisations: ${selectedCourseSummary.specialisations.join(", ")}`
                          : "This course has no listed specialisations."
                      }
                      programError={courseLoadError}
                      submitLabel={isGenerating ? "Generating..." : "Regenerate Plan"}
                    />

                    <div className={styles.aiInputBlock}>
                      <label htmlFor="ai-preferences-compact">Planning preferences</label>
                      <textarea
                        id="ai-preferences-compact"
                        value={aiPreferences}
                        onChange={(event) => setAiPreferences(event.target.value)}
                        rows={4}
                      />
                    </div>
                  </div>
                ) : null}
              </section>
            ) : (
              <section className={styles.setupSection}>
                <h2 className={styles.setupTitle}>Plan Setup</h2>
                <PlanConfigForm
                  value={planConfig}
                  onChange={setPlanConfig}
                  onGenerate={handleGeneratePlan}
                  onClear={handleClearPlan}
                  programOptions={programOptions}
                  programLoading={isLoadingCourses}
                  programDisabled={isLoadingCourses || Boolean(courseLoadError)}
                  programHelpText={
                    selectedCourseSummary?.specialisations.length
                      ? `Specialisations: ${selectedCourseSummary.specialisations.join(", ")}`
                      : "This course has no listed specialisations."
                  }
                  programError={courseLoadError}
                  submitLabel={isGenerating ? "Generating..." : "Generate Plan"}
                />

                <div className={styles.aiInputBlock}>
                  <label htmlFor="ai-preferences">Planning preferences</label>
                  <textarea
                    id="ai-preferences"
                    value={aiPreferences}
                    onChange={(event) => setAiPreferences(event.target.value)}
                    rows={4}
                  />
                </div>
              </section>
            )}

            {generationError ? (
              <section className={styles.errorPanel} role="alert" aria-live="assertive">
                <div>
                  <h3>AI generation failed</h3>
                  <p>{generationError}</p>
                </div>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => applyLocalDraftPlan(planConfig, selectedCourseDetails)}
                >
                  Use local draft
                </button>
              </section>
            ) : null}

            {planGenerated ? (
              <>
                <section className={styles.statusBar} aria-label="Study plan summary" aria-live="polite">
                  <div className={styles.statusItem}>
                    <span className={styles.statusLabel}>Level</span>
                    <span className={styles.statusValue}>
                      {DEGREE_LEVEL_LABELS[activePlanConfig?.degreeLevel ?? planConfig.degreeLevel]}
                    </span>
                  </div>
                  <div className={styles.statusItem}>
                    <span className={styles.statusLabel}>Program</span>
                    <span className={styles.statusValue}>
                      {activeCourseSummary?.title ??
                        selectedCourseDetails?.title ??
                        activePlanConfig?.program ??
                        planConfig.program}
                    </span>
                  </div>
                  <div className={styles.statusItem}>
                    <span className={styles.statusLabel}>Mode</span>
                    <span className={styles.statusValue}>
                      {STUDY_MODE_LABELS[activePlanConfig?.studyMode ?? planConfig.studyMode]}
                    </span>
                  </div>
                  <div className={styles.statusItem}>
                    <span className={styles.statusLabel}>Semesters</span>
                    <span className={styles.statusValue}>{generatedPlan.length}</span>
                  </div>
                  <div className={styles.statusItem}>
                    <span className={styles.statusLabel}>Total Units</span>
                    <span className={styles.statusValue}>{allUnits.length}</span>
                  </div>
                  <div className={styles.statusItem}>
                    <span className={styles.statusLabel}>Total Credits</span>
                    <span className={styles.statusValue}>{totalCredits}cr</span>
                  </div>
                  {selectedCourseDetails && selectedCourseDetails.minPoints !== null ? (
                    <div className={styles.statusItem}>
                      <span className={styles.statusLabel}>Min Points</span>
                      <span className={styles.statusValue}>{selectedCourseDetails.minPoints}</span>
                    </div>
                  ) : null}
                  {selectedCourseDetails && selectedCourseDetails.maxYears !== null ? (
                    <div className={styles.statusItem}>
                      <span className={styles.statusLabel}>Max Years</span>
                      <span className={styles.statusValue}>{selectedCourseDetails.maxYears}</span>
                    </div>
                  ) : null}
                </section>

                <section className={styles.planContent}>
                  <div className={styles.semesterGrid} aria-label="Generated semester plan">
                    {generatedPlan.map((semester) => (
                      <article key={semester.id} className={styles.semesterCard}>
                        <div className={styles.semesterMeta}>
                          <h3 className={styles.semesterTitle}>{semester.name}</h3>
                          <div className={styles.semesterStats}>
                            {semester.units.length} unit{semester.units.length !== 1 ? "s" : ""} ·{" "}
                            {semester.units.reduce((sum, unit) => sum + unit.credits, 0)}cr
                          </div>
                        </div>

                        <div className={styles.semesterUnits}>
                          {semester.units.length > 0 ? (
                            semester.units.map((unit) => (
                              <button
                                key={unit.code}
                                type="button"
                                className={`${styles.unitItem} ${selectedUnit?.unitCode === unit.code ? styles.activeUnit : ""}`}
                                aria-label={`View details for ${unit.code}, ${unit.name}, in ${semester.name}`}
                                onClick={() =>
                                  setSelectedUnit({
                                    semesterId: semester.id,
                                    unitCode: unit.code,
                                  })
                                }
                              >
                                <div className={styles.unitCardWrapper}>
                                  <UnitCard
                                    code={unit.code}
                                    name={unit.name}
                                    semester={semester.name}
                                  />
                                </div>
                                <span className={styles.credits}>{unit.credits}cr</span>
                              </button>
                            ))
                          ) : (
                            <div className={styles.emptySemester}>No units allocated yet.</div>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className={styles.planActions}>
                    {saveMessage ? <span className={styles.saveStatus}>{saveMessage}</span> : null}
                    {saveError ? <span className={styles.saveError} role="alert">{saveError}</span> : null}
                    <button
                      className={styles.primaryBtn}
                      type="button"
                      onClick={handleSavePlan}
                      disabled={isSaving}
                      aria-busy={isSaving}
                    >
                      {isSaving ? "Saving..." : "Save Plan"}
                    </button>
                    <button className={styles.secondaryBtn} type="button" onClick={() => handleGeneratePlan(planConfig)}>
                      Regenerate
                    </button>
                    <button className={styles.secondaryBtn} type="button">Export PDF</button>
                  </div>
                </section>
              </>
            ) : (
              <section className={styles.emptyState}>
                <div className={styles.emptyContent}>
                  <h3>Ready to create your study plan?</h3>
                  <p>
                    Configure the planner inputs above to generate a semester based draft plan. Once
                    generated, you will see validation feedback and AI guidance in the panel on the
                    right.
                  </p>
                </div>
              </section>
            )}
          </div>

          <RightPanel
            validationResult={validationResult}
            currentPlanUnitsCount={allUnits.length}
            planGenerated={planGenerated}
            aiMessages={aiMessages}
            validationError={validationError}
            validationPending={isValidatingPlan}
            validationSource={validationSource}
          />
        </div>
      </main>

      {selectedUnit && selectedUnitDetails ? (
        <div className={styles.modalOverlay} onClick={() => setSelectedUnit(null)}>
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="unit-dialog-title"
            aria-describedby="unit-dialog-description"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <h3 id="unit-dialog-title">{selectedUnitDetails.code}</h3>
                <p>{selectedUnitDetails.name}</p>
              </div>
              <button type="button" className={styles.modalClose} onClick={() => setSelectedUnit(null)} aria-label="Close unit details">
                ×
              </button>
            </div>

            <div className={styles.modalSection}>
              <h4>Description</h4>
              <p id="unit-dialog-description">{selectedUnitDetails.description}</p>
            </div>

            <div className={styles.modalGrid}>
              <div className={styles.modalSection}>
                <h4>Prerequisites</h4>
                <p>{selectedUnitDetails.prerequisites.length > 0 ? selectedUnitDetails.prerequisites.join(", ") : "None"}</p>
              </div>
              <div className={styles.modalSection}>
                <h4>Corequisites</h4>
                <p>{selectedUnitDetails.corequisites.length > 0 ? selectedUnitDetails.corequisites.join(", ") : "None"}</p>
              </div>
              <div className={styles.modalSection}>
                <h4>Availability</h4>
                <p>{selectedUnitDetails.availability.join(", ")}</p>
              </div>
              <div className={styles.modalSection}>
                <h4>Credits</h4>
                <p>{selectedUnitDetails.credits}cr</p>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.primaryBtn} onClick={moveUnitToNextSemester}>
                Move to next semester
              </button>
              <button type="button" className={styles.secondaryBtn} onClick={removeUnitFromPlan}>
                Remove from plan
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
