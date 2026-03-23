import styles from "./ValidationDetail.module.css";

interface ValidationDetailProps {
  checkName: string;
  status: "pass" | "warning" | "fail";
  message: string;
  details: string[];
}

export default function ValidationDetail({
  checkName,
  status,
  message,
  details,
}: ValidationDetailProps) {
  return (
    <div className={`${styles.detail} ${styles[status]}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>{checkName}</h3>
        <span className={`${styles.badge} ${styles[status]}`}>
          {status === "pass" && "✓ Passed"}
          {status === "warning" && "⚠ Warning"}
          {status === "fail" && "✕ Failed"}
        </span>
      </div>

      <p className={styles.message}>{message}</p>

      {details.length > 0 && (
        <div className={styles.details}>
          <h4 className={styles.detailsTitle}>Details:</h4>
          <ul className={styles.list}>
            {details.map((detail, index) => (
              <li key={index}>{detail}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.actions}>
        {status === "warning" && (
          <button className={styles.btn}>View More Info</button>
        )}
        {status === "fail" && (
          <button className={styles.btn}>Resolve Issue</button>
        )}
      </div>
    </div>
  );
}
