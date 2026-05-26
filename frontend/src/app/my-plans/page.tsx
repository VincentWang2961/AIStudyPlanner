"use client";

import React from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import PlanCard from "@/components/PlanCard";
import { deleteStudyPlan, listStudyPlans, saveStudyPlan, type SavedStudyPlan } from "@/lib/planApi";
import { exportPlanCsv, exportPlanPdf } from "@/lib/plannerExportApi";
import { DEFAULT_PLANNER_CONFIG } from "@/lib/plannerData";
import styles from "./page.module.css";

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getTotalUnits(plan: SavedStudyPlan): number {
  return plan.planData.reduce((sum, semester) => sum + semester.units.length, 0);
}

function formatUnitDescription(description: string): string {
  const cleanedDescription = description.replace(/\s+/g, " ").trim();

  if (!cleanedDescription) {
    return "Planned course unit.";
  }

  const firstUsefulSegment =
    cleanedDescription
      .split(/[.;]/)
      .map((segment) => segment.trim())
      .find(
        (segment) =>
          segment.length >= 12 &&
          !/^(already placed|move [A-Z]{4}\d{4}|prerequisite check|corequisite check)/i.test(segment)
      ) ?? cleanedDescription;

  return firstUsefulSegment.length > 120
    ? `${firstUsefulSegment.slice(0, 117).trim()}...`
    : firstUsefulSegment;
}

function fileSafe(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "study-plan";
}

function downloadBlobFile(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

export default function MyPlansPage() {
  const [plans, setPlans] = React.useState<SavedStudyPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [programFilter, setProgramFilter] = React.useState("all");
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isSavingRename, setIsSavingRename] = React.useState(false);
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [renameDraft, setRenameDraft] = React.useState("");
  const [exportingFormat, setExportingFormat] = React.useState<"pdf" | "csv" | null>(null);
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

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

  React.useEffect(() => {
    if (!actionMessage) return;

    const timeoutId = window.setTimeout(() => {
      setActionMessage(null);
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [actionMessage]);

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

  React.useEffect(() => {
    setIsRenaming(false);
    setRenameDraft("");
  }, [selectedPlanId]);

  const getSelectedPlanPayload = (plan: SavedStudyPlan) => {
    const courseCode =
      plan.courseCode ??
      plan.config?.program ??
      DEFAULT_PLANNER_CONFIG.program;
    const program = plan.program ?? plan.name;
    const config = plan.config ?? {
      ...DEFAULT_PLANNER_CONFIG,
      program: courseCode,
      semesters: plan.planData.length || DEFAULT_PLANNER_CONFIG.semesters,
    };

    return {
      courseCode,
      program,
      config,
      planData: plan.planData,
    };
  };

  const handleDeleteSelected = async () => {
    if (!selectedPlan) return;

    setIsDeleting(true);
    setError(null);
    setActionMessage(null);
    setActionError(null);

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

  const handleStartRename = () => {
    if (!selectedPlan) return;

    setRenameDraft(selectedPlan.name);
    setIsRenaming(true);
    setActionMessage(null);
    setActionError(null);
  };

  const handleRenameSelected = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPlan) return;

    const nextName = renameDraft.trim();

    if (!nextName) {
      setActionError("Plan name cannot be empty.");
      return;
    }

    setIsSavingRename(true);
    setActionMessage(null);
    setActionError(null);

    try {
      const renamedPlan = await saveStudyPlan({
        id: selectedPlan.id,
        name: nextName,
        ...getSelectedPlanPayload(selectedPlan),
      });

      setPlans((currentPlans) =>
        currentPlans.map((plan) => (plan.id === renamedPlan.id ? renamedPlan : plan))
      );
      setSelectedPlanId(renamedPlan.id);
      setIsRenaming(false);
      setRenameDraft("");
      setActionMessage("Plan renamed.");
    } catch (renameError) {
      setActionError(renameError instanceof Error ? renameError.message : "Unable to rename study plan.");
    } finally {
      setIsSavingRename(false);
    }
  };

  const handleExportSelected = async (format: "pdf" | "csv") => {
    if (!selectedPlan) return;

    setExportingFormat(format);
    setActionMessage(null);
    setActionError(null);

    try {
      const payload = getSelectedPlanPayload(selectedPlan);

      if (format === "pdf") {
        const pdfBlob = await exportPlanPdf(payload);
        downloadBlobFile(`${fileSafe(selectedPlan.name)}.pdf`, pdfBlob);
        setActionMessage("PDF export ready.");
      } else {
        const csvBlob = await exportPlanCsv(payload);
        downloadBlobFile(`${fileSafe(selectedPlan.name)}.csv`, csvBlob);
        setActionMessage("CSV export ready.");
      }
    } catch (exportError) {
      const fallbackMessage =
        format === "pdf" ? "Unable to export PDF." : "Unable to export CSV.";
      setActionError(exportError instanceof Error ? exportError.message : fallbackMessage);
    } finally {
      setExportingFormat(null);
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
                        createdDate={formatDateTime(plan.updatedAt)}
                        status="pass"
                        selected={selectedPlanId === plan.id}
                        onClick={() => setSelectedPlanId(plan.id)}
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
                    <strong>{formatDateTime(selectedPlan.updatedAt)}</strong>
                  </div>
                  <div className={styles.detailCard}>
                    <span className={styles.detailLabel}>Units</span>
                    <strong>{getTotalUnits(selectedPlan)}</strong>
                  </div>
                </div>

                <div className={styles.actionRow}>
                  <button
                    className={styles.secondaryBtn}
                    type="button"
                    onClick={handleDeleteSelected}
                    disabled={isDeleting || isSavingRename || exportingFormat !== null}
                    aria-busy={isDeleting}
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </button>
                  <button
                    className={styles.secondaryBtn}
                    type="button"
                    onClick={handleStartRename}
                    disabled={isDeleting || isSavingRename || exportingFormat !== null}
                  >
                    Rename
                  </button>
                  <Link
                    className={styles.secondaryBtn}
                    href={`/create-plan?planId=${encodeURIComponent(selectedPlan.id)}`}
                  >
                    Edit Plan
                  </Link>
                  <button
                    className={styles.secondaryBtn}
                    type="button"
                    onClick={() => handleExportSelected("pdf")}
                    disabled={isDeleting || isSavingRename || exportingFormat !== null}
                    aria-busy={exportingFormat === "pdf"}
                  >
                    {exportingFormat === "pdf" ? "Exporting..." : "Export PDF"}
                  </button>
                  <button
                    className={styles.secondaryBtn}
                    type="button"
                    onClick={() => handleExportSelected("csv")}
                    disabled={isDeleting || isSavingRename || exportingFormat !== null}
                    aria-busy={exportingFormat === "csv"}
                  >
                    {exportingFormat === "csv" ? "Exporting..." : "Export CSV"}
                  </button>
                  {isRenaming ? (
                    <form className={styles.renameForm} onSubmit={handleRenameSelected}>
                      <label className={styles.visuallyHidden} htmlFor="rename-plan-input">
                        New plan name
                      </label>
                      <input
                        id="rename-plan-input"
                        className={styles.renameInput}
                        value={renameDraft}
                        onChange={(event) => setRenameDraft(event.target.value)}
                        disabled={isSavingRename}
                      />
                      <button
                        className={styles.secondaryBtn}
                        type="submit"
                        disabled={isSavingRename || !renameDraft.trim()}
                        aria-busy={isSavingRename}
                      >
                        {isSavingRename ? "Saving..." : "Save"}
                      </button>
                      <button
                        className={styles.secondaryBtn}
                        type="button"
                        onClick={() => {
                          setIsRenaming(false);
                          setRenameDraft("");
                        }}
                        disabled={isSavingRename}
                      >
                        Cancel
                      </button>
                    </form>
                  ) : null}
                  {actionMessage ? <span className={styles.actionStatus}>{actionMessage}</span> : null}
                  {actionError ? <span className={styles.actionError} role="alert">{actionError}</span> : null}
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
                              <p className={styles.unitDescription}>{formatUnitDescription(unit.description)}</p>
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
