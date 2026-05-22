"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import PlanCard from "@/components/PlanCard";
import { deleteStudyPlan, getStudyPlan, listStudyPlans, saveStudyPlan, type SavedStudyPlan } from "@/lib/planApi";
import styles from "./page.module.css";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getTotalUnits(plan: SavedStudyPlan): number {
  return plan.planData.reduce((sum, semester) => sum + semester.units.length, 0);
}

export default function MyPlansPage() {
  const [plans, setPlans] = React.useState<SavedStudyPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [programFilter, setProgramFilter] = React.useState("all");
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isDuplicating, setIsDuplicating] = React.useState(false);
  const router = useRouter();

  const PLANNER_DRAFT_STORAGE_KEY = "ai-study-planner.currentPlannerDraft.v1";

  React.useEffect(() => {
    let ignore = false;

    async function loadPlans() {
      setIsLoading(true);
      setError(null);

      try {
        const loadedPlans = await listStudyPlans();

        if (!ignore) {
          setPlans(loadedPlans);
          setSelectedPlanId(loadedPlans[0]?.id ?? null);
        }
      } catch (loadError) {
        if (!ignore) {
          setPlans([]);
          setSelectedPlanId(null);
          setError(loadError instanceof Error ? loadError.message : "Unable to load saved plans.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadPlans();

    return () => {
      ignore = true;
    };
  }, []);

  const availablePrograms = React.useMemo(
    () => Array.from(new Set(plans.map((plan) => plan.program).filter(Boolean))) as string[],
    [plans]
  );
  const filteredPlans = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return plans.filter((plan) => {
      const matchesSearch =
        !query ||
        plan.name.toLowerCase().includes(query) ||
        (plan.program ?? "").toLowerCase().includes(query);
      const matchesProgram = programFilter === "all" || plan.program === programFilter;

      return matchesSearch && matchesProgram;
    });
  }, [plans, programFilter, searchQuery]);
  const selectedPlan =
    plans.find((plan) => plan.id === selectedPlanId) ?? filteredPlans[0] ?? plans[0] ?? null;

  const handleDeleteSelected = async () => {
    if (!selectedPlan) return;

    setIsDeleting(true);
    setError(null);

    try {
      await deleteStudyPlan(selectedPlan.id);
      setPlans((currentPlans) => currentPlans.filter((plan) => plan.id !== selectedPlan.id));
      setSelectedPlanId((currentId) => (currentId === selectedPlan.id ? null : currentId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete study plan.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenSelected = async () => {
    if (!selectedPlan) return;

    try {
      const fullPlan = await getStudyPlan(selectedPlan.id);

      window.sessionStorage.setItem(
        PLANNER_DRAFT_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          planConfig: fullPlan.config ?? { program: fullPlan.courseCode ?? "", semesters: fullPlan.planData.length, unitsPerSemester: 4, studyMode: "full-time" },
          activePlanConfig: fullPlan.config,
          generatedPlan: fullPlan.planData,
          planGenerated: true,
          selectedSpecialisation: "",
          savedPlanId: fullPlan.id,
          aiPlanResponse: null,
        })
      );

      router.push("/create-plan");
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Unable to open study plan.");
    }
  };

  const handleRenameSelected = async () => {
    if (!selectedPlan) return;

    const newName = window.prompt("Enter a new name for this plan:", selectedPlan.name);
    if (!newName || newName.trim() === "" || newName.trim() === selectedPlan.name) return;

    setError(null);

    try {
      const updatedPlan = await saveStudyPlan({
        id: selectedPlan.id,
        name: newName.trim(),
        courseCode: selectedPlan.courseCode ?? "",
        program: selectedPlan.program ?? "",
        config: selectedPlan.config ?? { program: selectedPlan.courseCode ?? "", semesters: selectedPlan.planData.length, unitsPerSemester: 4, studyMode: "full-time" },
        planData: selectedPlan.planData,
      });

      setPlans((currentPlans) =>
        currentPlans.map((plan) => (plan.id === updatedPlan.id ? updatedPlan : plan))
      );
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : "Unable to rename study plan.");
    }
  };

  const handleDuplicateSelected = async () => {
    if (!selectedPlan) return;

    setIsDuplicating(true);
    setError(null);

    try {
      const fullPlan = await getStudyPlan(selectedPlan.id);

      const duplicatedPlan = await saveStudyPlan({
        name: `${fullPlan.name} (Copy)`,
        courseCode: fullPlan.courseCode ?? "",
        program: fullPlan.program ?? "",
        config: fullPlan.config ?? { program: fullPlan.courseCode ?? "", semesters: fullPlan.planData.length, unitsPerSemester: 4, studyMode: "full-time" },
        planData: fullPlan.planData,
      });

      setPlans((currentPlans) => [...currentPlans, duplicatedPlan]);
      setSelectedPlanId(duplicatedPlan.id);
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : "Unable to duplicate study plan.");
    } finally {
      setIsDuplicating(false);
    }
  };

  return (
    <div className={styles.layout}>
      <Sidebar />
      <main id="main-content" className={styles.main}>
        <div className={styles.content}>
          <div className={styles.workspace}>
            <div className={styles.filterBar} role="search" aria-label="Saved plans filters">
              <label className={styles.visuallyHidden} htmlFor="plan-search">Search plans</label>
              <input
                id="plan-search"
                className={styles.searchInput}
                placeholder="Search plans by name or program..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              <label className={styles.visuallyHidden} htmlFor="plan-program-filter">Filter by program</label>
              <select
                id="plan-program-filter"
                className={styles.filterSelect}
                value={programFilter}
                onChange={(event) => setProgramFilter(event.target.value)}
              >
                <option value="all">All programs</option>
                {availablePrograms.map((program) => (
                  <option key={program} value={program}>{program}</option>
                ))}
              </select>
            </div>

            <section className={styles.section}>
              <h2>Saved plans</h2>
              {isLoading ? <p className={styles.stateMessage}>Loading saved plans...</p> : null}
              {error ? <p className={styles.errorMessage} role="alert">{error}</p> : null}
              {!isLoading && filteredPlans.length === 0 ? (
                <p className={styles.stateMessage}>No saved plans found.</p>
              ) : null}
              {filteredPlans.length > 0 ? (
                <div className={styles.grid}>
                  {filteredPlans.map((plan) => {
                    const totalUnits = getTotalUnits(plan);

                    return (
                      <PlanCard
                        key={plan.id}
                        name={plan.name}
                        program={plan.program ?? "Unknown program"}
                        semesters={plan.planData.length}
                        unitsCompleted={totalUnits}
                        totalUnits={totalUnits}
                        createdDate={formatDate(plan.updatedAt)}
                        status="pass"
                        selected={selectedPlan?.id === plan.id}
                        onClick={() => setSelectedPlanId(plan.id)}
                        onOpen={handleOpenSelected}
                      />
                    );
                  })}
                </div>
              ) : null}
            </section>

            {selectedPlan ? (
              <section className={styles.section}>
                <h2 id="selected-plan-heading">Selected plan details</h2>
                <div className={styles.detailGrid}>
                  <div className={styles.detailCard}>
                    <span className={styles.detailLabel}>Name</span>
                    <strong>{selectedPlan.name}</strong>
                  </div>
                  <div className={styles.detailCard}>
                    <span className={styles.detailLabel}>Program</span>
                    <strong>{selectedPlan.program ?? "Unknown program"}</strong>
                  </div>
                  <div className={styles.detailCard}>
                    <span className={styles.detailLabel}>Last updated</span>
                    <strong>{formatDate(selectedPlan.updatedAt)}</strong>
                  </div>
                  <div className={styles.detailCard}>
                    <span className={styles.detailLabel}>Units</span>
                    <strong>{getTotalUnits(selectedPlan)}</strong>
                  </div>
                </div>

                <div className={styles.actionRow}>
                  <button className={styles.primaryBtn} type="button" onClick={handleOpenSelected}>Open</button>
                  <button className={styles.secondaryBtn} type="button" onClick={handleRenameSelected}>Rename</button>
                  <button className={styles.secondaryBtn} type="button" onClick={handleDuplicateSelected} disabled={isDuplicating} aria-busy={isDuplicating}>{isDuplicating ? "Duplicating..." : "Duplicate"}</button>
                  <button
                    className={styles.secondaryBtn}
                    type="button"
                    onClick={handleDeleteSelected}
                    disabled={isDeleting}
                    aria-busy={isDeleting}
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </button>
                  <button className={styles.secondaryBtn} type="button">Export</button>
                </div>

                <div className={styles.semesterBreakdown} aria-label="Selected plan semester breakdown">
                  {selectedPlan.planData.map((semester) => (
                    <article key={semester.id} className={styles.semesterCard}>
                      <div className={styles.semesterHeader}>
                        <h3>{semester.name}</h3>
                        <span>{semester.units.length} units</span>
                      </div>

                      <div className={styles.unitList}>
                        {semester.units.map((unit) => (
                          <div key={unit.code} className={styles.unitRow}>
                            <div>
                              <div className={styles.unitTitle}>
                                <span>{unit.code}</span>
                                <strong>{unit.name}</strong>
                              </div>
                              <p>{unit.description}</p>
                              {unit.prerequisites.length > 0 ? (
                                <p className={styles.unitMeta}>
                                  Prerequisites: {unit.prerequisites.join(", ")}
                                </p>
                              ) : null}
                            </div>
                            <div className={styles.unitTags}>
                              <span>{unit.credits} cp</span>
                              <span>{unit.type ?? "unit"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
