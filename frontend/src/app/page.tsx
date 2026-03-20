import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import SectionCard from "@/components/SectionCard";
import UnitCard from "@/components/UnitCard";
import TaskItem from "@/components/TaskItem";
import RightPanel from "@/components/RightPanel";
import styles from "./page.module.css";

export default function Home() {
  // Sample data for demonstration
  const nextUnits = [
    { code: "CS101", name: "Intro to Computer Science", semester: "Spring 25" },
    { code: "MATH201", name: "Calculus II", semester: "Spring 25", status: "in-progress" as const },
    { code: "PHYS111", name: "Physics I", semester: "Spring 25", status: "completed" as const },
  ];

  const upcomingTasks = [
    {
      title: "Complete CS101 Assignment",
      dueDate: "Due Mar 25, 2025",
      priority: "high" as const,
    },
    {
      title: "Study for MATH201 Midterm",
      dueDate: "Due Mar 28, 2025",
      priority: "high" as const,
    },
    {
      title: "Read PHYS111 Chapter 5",
      dueDate: "Due Apr 2, 2025",
      priority: "medium" as const,
      completed: true,
    },
    {
      title: "Submit lab report",
      dueDate: "Due Apr 5, 2025",
      priority: "medium" as const,
    },
  ];

  const studyPlanUnits = [
    {
      code: "CS101",
      name: "Intro to Computer Science",
      semester: "Spring 25",
      status: "in-progress" as const,
    },
    {
      code: "MATH201",
      name: "Calculus II",
      semester: "Spring 25",
      status: "in-progress" as const,
    },
    {
      code: "CS201",
      name: "Data Structures",
      semester: "Fall 25",
    },
    {
      code: "PHYS201",
      name: "Physics II",
      semester: "Fall 25",
    },
  ];

  return (
    <div className={styles.layout}>
      <Sidebar />

      <div className={styles.main}>
        <Header />

        <div className={styles.content}>
          <div className={styles.centerContent}>
            {/* Study Plan Overview */}
            <SectionCard title="Current Study Plan">
              <div className={styles.overview}>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Total Units</span>
                  <span className={styles.statValue}>12</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Completed</span>
                  <span className={styles.statValue}>3</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>In Progress</span>
                  <span className={styles.statValue}>4</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Remaining</span>
                  <span className={styles.statValue}>5</span>
                </div>
              </div>
            </SectionCard>

            {/* Next Units */}
            <SectionCard title="Next Units (Spring 2025)">
              <div className={styles.unitGrid}>
                {nextUnits.map((unit) => (
                  <UnitCard
                    key={unit.code}
                    code={unit.code}
                    name={unit.name}
                    semester={unit.semester}
                    status={unit.status}
                  />
                ))}
              </div>
            </SectionCard>

            {/* Upcoming Tasks */}
            <SectionCard title="Upcoming Tasks">
              <div className={styles.taskList}>
                {upcomingTasks.map((task, index) => (
                  <TaskItem
                    key={index}
                    title={task.title}
                    dueDate={task.dueDate}
                    priority={task.priority}
                    completed={task.completed}
                  />
                ))}
              </div>
            </SectionCard>

            {/* My Study Plan */}
            <SectionCard title="My Study Plan">
              <div className={styles.unitGrid}>
                {studyPlanUnits.map((unit) => (
                  <UnitCard
                    key={unit.code}
                    code={unit.code}
                    name={unit.name}
                    semester={unit.semester}
                    status={unit.status}
                  />
                ))}
              </div>
            </SectionCard>
          </div>

          <RightPanel />
        </div>
      </div>
    </div>
  );
}
