import styles from "./PlanCard.module.css";

interface PlanCardProps {
  name: string;
  program: string;
  semesters: number;
  unitsCompleted: number;
  totalUnits: number;
  createdDate: string;
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
  selected = false,
  onClick,
}: PlanCardProps) {
  return (
    <div
      className={`${styles.card} ${selected ? styles.selected : ""}`}
      onClick={onClick}
    >
      <div className={styles.header}>
        <h3 className={styles.title}>{name}</h3>
        <span className={styles.date}>{createdDate}</span>
      </div>

      <div className={styles.details}>
        <div className={styles.detail}>
          <span className={styles.label}>Program:</span>
          <span className={styles.value}>{program}</span>
        </div>
        <div className={styles.detail}>
          <span className={styles.label}>Semesters:</span>
          <span className={styles.value}>{semesters}</span>
        </div>
      </div>

      <div className={styles.progress}>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{
              width: `${(unitsCompleted / totalUnits) * 100}%`,
            }}
          />
        </div>
        <span className={styles.progressText}>
          {unitsCompleted} of {totalUnits} units
        </span>
      </div>

      <div className={styles.actions}>
        <button className={styles.actionBtn}>View</button>
        <button className={styles.actionBtn}>Edit</button>
      </div>
    </div>
  );
}
