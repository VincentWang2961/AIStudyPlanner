import styles from "./Header.module.css";

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <h1>Dashboard</h1>
      </div>

      <div className={styles.right}>
        <input
          type="text"
          placeholder="Search study plans..."
          className={styles.searchInput}
        />
        <button className={styles.userButton}>👤 New Plan</button>
      </div>
    </header>
  );
}
