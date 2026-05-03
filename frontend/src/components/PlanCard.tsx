"use client";

import styles from "./PlanCard.module.css";
import { exportPlanCsv } from "@/lib/plannerExportApi";

const planData = {
  courseCode: "62510",
  completedUnits: [],
  selectedSpecialisations: ["SP_SOFSY"],
  plan: [
    {
      year: 2026,
      term: "S1",
      units: ["CITS2002", "CITS4401", "PHIL4100", "CITS5505"],
    },
    {
      year: 2026,
      term: "S2",
      units: ["CITS5501", "CITS5503", "CITS5506", "CITS5507"],
    },
    {
      year: 2027,
      term: "S1",
      units: ["CITS5206"],
    },
    {
      year: 2027,
      term: "S2",
      units: [],
    },
  ],
};

interface PlanCardProps {
  name: string;
  program: string;
  semesters: number;
  unitsCompleted: number;
  totalUnits: number;
  createdDate: string;
  status?: "pass" | "warning" | "fail";
  selected?: boolean;
  onClick?: () => void;
}

export default function PlanCard({
  name,
  program,
  semesters,
  unitsCompleted,
  totalUnits,
  createdDate,
  status = "pass",
  selected = false,
  onClick,
}: PlanCardProps) {
  const statusLabel =
    status === "pass"
      ? "Valid"
      : status === "warning"
        ? "Needs review"
        : "Issues found";

  const progressPercent =
    totalUnits > 0 ? Math.round((unitsCompleted / totalUnits) * 100) : 0;

  const handleExportCsv = async (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();

    try {
      await exportPlanCsv(planData);
    } catch (error) {
      console.error(error);
      alert("Failed to export CSV file.");
    }
  };

  return (
    <article className={`${styles.card} ${selected ? styles.selected : ""}`}>
      <button
        type="button"
        className={styles.selectButton}
        onClick={onClick}
        aria-pressed={selected}
        aria-label={`Select ${name}`}
      />

      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>{name}</h3>
          <p className={styles.date}>Updated {createdDate}</p>
        </div>
        <span className={`${styles.statusBadge} ${styles[status]}`}>
          {statusLabel}
        </span>
      </div>

      <div className={styles.details}>
        <div className={styles.detail}>
          <span className={styles.label}>Program</span>
          <span className={styles.value}>{program}</span>
        </div>
        <div className={styles.detail}>
          <span className={styles.label}>Semesters</span>
          <span className={styles.value}>{semesters}</span>
        </div>
      </div>

      <div className={styles.progress}>
        <div
          className={styles.progressBar}
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${name} completion`}
        >
          <div
            className={styles.progressFill}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className={styles.progressText}>
          {unitsCompleted} of {totalUnits} units completed
        </span>
      </div>

      <div className={styles.actions}>
        <button className={styles.actionBtn} type="button">
          Open
        </button>
        <button
          className={styles.actionBtn}
          type="button"
          onClick={handleExportCsv}
        >
          Export
        </button>
      </div>
    </article>
  );
}
