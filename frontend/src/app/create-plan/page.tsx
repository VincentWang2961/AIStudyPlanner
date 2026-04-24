"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";
import PlanConfigForm from "@/components/PlanConfigForm";
import UnitCard from "@/components/UnitCard";
import RightPanel from "@/components/RightPanel";
import {
  DEGREE_LEVEL_LABELS,
  DEFAULT_PLANNER_CONFIG,
  PROGRAM_LABELS,
  STUDY_MODE_LABELS,
  flattenUnits,
  generateDraftPlan,
  getTotalCredits,
  type PlanUnit,
  type PlannerConfig,
  type SemesterPlan,
} from "@/lib/plannerData";
import { validatePlan } from "@/utils/validationRules";
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

export default function PlannerPage() {
  const [planConfig, setPlanConfig] = React.useState<PlannerConfig>(DEFAULT_PLANNER_CONFIG);
  const [generatedPlan, setGeneratedPlan] = React.useState<SemesterPlan[]>([]);
  const [planGenerated, setPlanGenerated] = React.useState(false);
  const [selectedUnit, setSelectedUnit] = React.useState<SelectedUnitRef | null>(null);

  const allUnits = React.useMemo(() => flattenUnits(generatedPlan), [generatedPlan]);
  const totalCredits = React.useMemo(() => getTotalCredits(generatedPlan), [generatedPlan]);
  const validationResult = React.useMemo(
    () => (planGenerated ? validatePlan(generatedPlan, allUnits.map((unit) => unit.code)) : undefined),
    [generatedPlan, planGenerated, allUnits]
  );
  const aiMessages = React.useMemo(
    () => (planGenerated ? buildAiMessages(generatedPlan) : []),
    [generatedPlan, planGenerated]
  );

  const selectedUnitDetails: PlanUnit | undefined = React.useMemo(() => {
    if (!selectedUnit) return undefined;
    return generatedPlan
      .find((semester) => semester.id === selectedUnit.semesterId)
      ?.units.find((unit) => unit.code === selectedUnit.unitCode);
  }, [generatedPlan, selectedUnit]);

  const handleGeneratePlan = (nextConfig: PlannerConfig) => {
    setPlanConfig(nextConfig);
    setGeneratedPlan(generateDraftPlan(nextConfig));
    setPlanGenerated(true);
    setSelectedUnit(null);
  };

  const handleClearPlan = () => {
    setPlanConfig(DEFAULT_PLANNER_CONFIG);
    setGeneratedPlan([]);
    setPlanGenerated(false);
    setSelectedUnit(null);
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
  };

  return (
    <div className={styles.layout}>
      <Sidebar />
      <div className={styles.main}>
        <div className={styles.content}>
          <div className={styles.plannerWorkspace}>
            <section className={styles.setupSection}>
              <h2 className={styles.setupTitle}>Plan Setup</h2>
              <PlanConfigForm
                value={planConfig}
                onChange={setPlanConfig}
                onGenerate={handleGeneratePlan}
                onClear={handleClearPlan}
              />
            </section>

            {planGenerated ? (
              <>
                <section className={styles.statusBar}>
                  <div className={styles.statusItem}>
                    <span className={styles.statusLabel}>Level</span>
                    <span className={styles.statusValue}>{DEGREE_LEVEL_LABELS[planConfig.degreeLevel]}</span>
                  </div>
                  <div className={styles.statusItem}>
                    <span className={styles.statusLabel}>Program</span>
                    <span className={styles.statusValue}>{PROGRAM_LABELS[planConfig.program]}</span>
                  </div>
                  <div className={styles.statusItem}>
                    <span className={styles.statusLabel}>Mode</span>
                    <span className={styles.statusValue}>{STUDY_MODE_LABELS[planConfig.studyMode]}</span>
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
                </section>

                <section className={styles.planContent}>
                  <h2 className={styles.planTitle}>Study Plan Overview</h2>

                  <div className={styles.semesterGrid}>
                    {generatedPlan.map((semester) => (
                      <article key={semester.id} className={styles.semesterCard}>
                        <h3 className={styles.semesterTitle}>{semester.name}</h3>

                        <div className={styles.semesterUnits}>
                          {semester.units.length > 0 ? (
                            semester.units.map((unit) => (
                              <button
                                key={unit.code}
                                type="button"
                                className={`${styles.unitItem} ${selectedUnit?.unitCode === unit.code ? styles.activeUnit : ""}`}
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

                        <div className={styles.semesterStats}>
                          {semester.units.length} unit{semester.units.length !== 1 ? "s" : ""} · {semester.units.reduce((sum, unit) => sum + unit.credits, 0)}cr
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className={styles.planActions}>
                    <button className={styles.primaryBtn}>Save Plan</button>
                    <button className={styles.secondaryBtn} onClick={() => handleGeneratePlan(planConfig)}>
                      Regenerate
                    </button>
                    <button className={styles.secondaryBtn}>Export PDF</button>
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
          />
        </div>
      </div>

      {selectedUnit && selectedUnitDetails ? (
        <div className={styles.modalOverlay} onClick={() => setSelectedUnit(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3>{selectedUnitDetails.code}</h3>
                <p>{selectedUnitDetails.name}</p>
              </div>
              <button type="button" className={styles.modalClose} onClick={() => setSelectedUnit(null)}>
                ×
              </button>
            </div>

            <div className={styles.modalSection}>
              <h4>Description</h4>
              <p>{selectedUnitDetails.description}</p>
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
