import styles from "./UnitCard.module.css";
import { getAvailabilityBadgeLabel } from "@/lib/plannerData";

interface UnitCardProps {
  code: string;
  name: string;
  semester: string;
  availability?: string[];
  compact?: boolean;
}

export default function UnitCard({
  code,
  name,
  semester,
  availability,
  compact = false,
}: UnitCardProps) {
  const availabilityLabel = availability ? getAvailabilityBadgeLabel(availability) : null;

  return (
    <div className={`${styles.card} ${compact ? styles.compact : ""}`}>
      <div className={styles.header}>
        <h3 className={styles.code}>{code}</h3>
        {availabilityLabel ? (
          <span className={styles.availabilityBadge} aria-label={`Available in ${availabilityLabel}`}>
            {availabilityLabel}
          </span>
        ) : null}
      </div>
      <p className={styles.name}>{name}</p>
      <p className={styles.semester}>{semester}</p>
    </div>
  );
}
