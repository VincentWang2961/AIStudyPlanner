import styles from "./TaskItem.module.css";

interface TaskItemProps {
  title: string;
  dueDate: string;
  priority?: "high" | "medium" | "low";
  completed?: boolean;
}

export default function TaskItem({
  title,
  dueDate,
  priority = "medium",
  completed = false,
}: TaskItemProps) {
  return (
    <div className={`${styles.item} ${completed ? styles.completed : ""}`}>
      <div className={styles.left}>
        <input
          type="checkbox"
          checked={completed}
          readOnly
          className={styles.checkbox}
        />
        <div className={styles.info}>
          <p className={styles.title}>{title}</p>
          <p className={styles.dueDate}>{dueDate}</p>
        </div>
      </div>

      <span className={`${styles.priority} ${styles[priority]}`}>
        {priority}
      </span>
    </div>
  );
}
