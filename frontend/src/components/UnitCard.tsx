import styles from "./UnitCard.module.css";

interface UnitCardProps {
  code: string;
  name: string;
  semester: string;
  status?: "not-started" | "in-progress" | "completed";
}

export default function UnitCard({
  code,
  name,
  semester,
  status = "not-started",
}: UnitCardProps) {
  return (
    <div className={`${styles.card} ${styles[status]}`}>
      <div className={styles.header}>
        <h3 className={styles.code}>{code}</h3>
        <span className={styles.status}>{status}</span>
      </div>
      <p className={styles.name}>{name}</p>
      <p className={styles.semester}>{semester}</p>
    </div>
  );
}
