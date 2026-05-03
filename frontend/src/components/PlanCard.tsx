"use client";

import styles from "./PlanCard.module.css";

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
    status === "pass" ? "Valid" : status === "warning" ? "Needs review" : "Issues found";
  const progressPercent = Math.round((unitsCompleted / totalUnits) * 100);

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
        <span className={`${styles.statusBadge} ${styles[status]}`}>{statusLabel}</span>
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
          <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
        </div>
        <span className={styles.progressText}>{unitsCompleted} of {totalUnits} units completed</span>
      </div>

      <div className={styles.actions}>
        <button className={styles.actionBtn} type="button">Open</button>
        <button className={styles.actionBtn} type="button">Export</button>
      </div>
    </article>
  );
}
