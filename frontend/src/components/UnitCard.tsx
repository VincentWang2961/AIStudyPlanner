import styles from "./UnitCard.module.css";

interface UnitCardProps {
  code: string;
  name: string;
  semester: string;
}

export default function UnitCard({
  code,
  name,
  semester,
}: UnitCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.code}>{code}</h3>
      </div>
      <p className={styles.name}>{name}</p>
      <p className={styles.semester}>{semester}</p>
    </div>
  );
}
