import Link from "next/link";
import styles from "./page.module.css";

export default function AuthPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>Authentication</span>
          <h1>Sign in to save and revisit your plans.</h1>
          <p>
            This frontend prototype includes a lightweight authentication page to support the
            intended user flow. In the full product, registration and sign in would connect to
            persistent user sessions and saved plans.
          </p>
        </div>

        <div className={styles.formCard}>
          <div className={styles.toggleRow}>
            <button className={styles.activeTab}>Sign in</button>
            <button className={styles.tab}>Register</button>
          </div>

          <div className={styles.fieldGroup}>
            <label>Email</label>
            <input type="email" placeholder="student@uwa.edu.au" />
          </div>
          <div className={styles.fieldGroup}>
            <label>Password</label>
            <input type="password" placeholder="••••••••" />
          </div>

          <Link href="/create-plan" className={styles.primaryBtn}>
            Continue to planner
          </Link>
          <Link href="/create-plan" className={styles.secondaryBtn}>
            Continue as guest
          </Link>
        </div>
      </div>
    </main>
  );
}
