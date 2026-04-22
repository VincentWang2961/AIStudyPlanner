import Link from "next/link";
import styles from "./page.module.css";

const supportedPrograms = [
  "Computer Science",
  "Mathematics",
  "Physics",
  "Engineering",
];

const featureCards = [
  {
    title: "Generate a first draft plan",
    text: "Provide your program, study mode, and preferences to create a semester based draft plan.",
  },
  {
    title: "Review live validation feedback",
    text: "Check prerequisites, availability, and workload without leaving the planner workspace.",
  },
  {
    title: "Refine with AI guidance",
    text: "Use contextual suggestions to understand issues and improve your study path.",
  },
];

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>AI Study Planner</span>
          <h1>Build, validate, and refine a clearer degree plan.</h1>
          <p>
            This planning tool helps students generate an initial study plan, inspect semester
            structure, review academic rule checks, and adjust the draft with continuous guidance.
          </p>
          <div className={styles.actions}>
            <Link href="/auth" className={styles.primaryBtn}>
              Sign in
            </Link>
            <Link href="/create-plan" className={styles.secondaryBtn}>
              Continue as guest
            </Link>
          </div>
        </div>

        <div className={styles.heroPanel}>
          <h2>What you can do here</h2>
          <ul>
            <li>Generate a draft plan organised by semester</li>
            <li>See validation results while editing</li>
            <li>Review handbook style unit information</li>
            <li>Return to saved plans and export later</li>
          </ul>
        </div>
      </section>

      <section className={styles.features}>
        {featureCards.map((card) => (
          <article key={card.title} className={styles.featureCard}>
            <h3>{card.title}</h3>
            <p>{card.text}</p>
          </article>
        ))}
      </section>

      <section className={styles.programs}>
        <div>
          <h2>Supported programs</h2>
          <p>The current frontend prototype is focused on a small supported scope for clear planning demonstrations.</p>
        </div>
        <div className={styles.programGrid}>
          {supportedPrograms.map((program) => (
            <span key={program} className={styles.programChip}>
              {program}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
