import styles from "./Header.module.css";

interface HeaderProps {
  title?: string;
  subtitle?: string;
  actionLabel?: string;
}

export default function Header({
  title = "AI Study Planner",
  subtitle,
  actionLabel = "New Plan",
}: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <h1>{title}</h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>

      <div className={styles.right}>
        <input
          type="text"
          placeholder="Search study plans..."
          className={styles.searchInput}
        />
        <button className={styles.userButton}>✦ {actionLabel}</button>
      </div>
    </header>
  );
}
