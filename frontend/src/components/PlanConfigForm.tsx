import styles from "./PlanConfigForm.module.css";

interface PlanConfigFormProps {
  onGenerate?: () => void;
}

export default function PlanConfigForm({ onGenerate }: PlanConfigFormProps) {
  return (
    <form className={styles.form}>
      <div className={styles.section}>
        <h3 className={styles.title}>Study Plan Configuration</h3>

        <div className={styles.formGroup}>
          <label className={styles.label}>Program *</label>
          <select className={styles.select} defaultValue="">
            <option value="">Select a program</option>
            <option value="cs">Computer Science</option>
            <option value="math">Mathematics</option>
            <option value="physics">Physics</option>
            <option value="engineering">Engineering</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Study Mode *</label>
          <select className={styles.select} defaultValue="">
            <option value="">Select study mode</option>
            <option value="fulltime">Full-time</option>
            <option value="parttime">Part-time</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Number of Semesters *</label>
          <input
            type="number"
            min="1"
            max="12"
            defaultValue="6"
            className={styles.input}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Preferred Units per Semester</label>
          <input
            type="number"
            min="1"
            max="8"
            defaultValue="4"
            className={styles.input}
          />
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.primaryBtn} onClick={onGenerate}>
            Generate Plan
          </button>
          <button type="reset" className={styles.secondaryBtn}>
            Clear
          </button>
        </div>
      </div>
    </form>
  );
}
