"use client";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import SectionCard from "@/components/SectionCard";
import PlanConfigForm from "@/components/PlanConfigForm";
import UnitCard from "@/components/UnitCard";
import RightPanel from "@/components/RightPanel";
import styles from "./page.module.css";
import React from "react";

export default function CreatePlanPage() {
  const [planGenerated, setPlanGenerated] = React.useState(false);

  const generatedUnits = [
    {
      code: "CS101",
      name: "Intro to Computer Science",
      semester: "Spring 25",
      status: "not-started" as const,
    },
    {
      code: "MATH201",
      name: "Calculus II",
      semester: "Spring 25",
      status: "not-started" as const,
    },
    {
      code: "CS201",
      name: "Data Structures",
      semester: "Spring 25",
      status: "not-started" as const,
    },
    {
      code: "CS301",
      name: "Algorithms",
      semester: "Fall 25",
      status: "not-started" as const,
    },
  ];

  return (
    <div className={styles.layout}>
      <Sidebar />
      <div className={styles.main}>
        <Header />

        <div className={styles.content}>
          <div className={styles.centerContent}>
            <SectionCard title="Create New Study Plan">
              <div className={styles.twoColumn}>
                <div className={styles.formColumn}>
                  <PlanConfigForm onGenerate={() => setPlanGenerated(true)} />
                </div>

                <div className={styles.previewColumn}>
                  <div className={styles.previewBox}>
                    <h3 className={styles.previewTitle}>Plan Summary</h3>
                    {!planGenerated ? (
                      <p className={styles.emptyState}>
                        Configure settings and generate a plan to see a preview
                      </p>
                    ) : (
                      <div className={styles.summary}>
                        <div className={styles.summaryItem}>
                          <span className={styles.label}>Program:</span>
                          <span className={styles.value}>Computer Science</span>
                        </div>
                        <div className={styles.summaryItem}>
                          <span className={styles.label}>Study Mode:</span>
                          <span className={styles.value}>Full-time</span>
                        </div>
                        <div className={styles.summaryItem}>
                          <span className={styles.label}>Total Semesters:</span>
                          <span className={styles.value}>6</span>
                        </div>
                        <div className={styles.summaryItem}>
                          <span className={styles.label}>Units per Sem:</span>
                          <span className={styles.value}>4</span>
                        </div>
                        <div className={styles.summaryItem}>
                          <span className={styles.label}>Total Units:</span>
                          <span className={styles.value}>24</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>

            {planGenerated && (
              <>
                <SectionCard title="Generated Study Plan - Units">
                  <div className={styles.generatedInfo}>
                    <p>
                      Here are the units recommended for your study plan. You can
                      refine this plan by adjusting individual units or regenerating
                      with different parameters.
                    </p>
                  </div>
                </SectionCard>

                <SectionCard title="Semester 1 (Spring 2025)">
                  <div className={styles.unitsGrid}>
                    {generatedUnits.slice(0, 2).map((unit) => (
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

                <SectionCard title="Semester 2 (Fall 2025)">
                  <div className={styles.unitsGrid}>
                    {generatedUnits.slice(2, 4).map((unit) => (
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

                <div className={styles.planActions}>
                  <button className={styles.primaryBtn}>Save Plan</button>
                  <button className={styles.secondaryBtn}>
                    Regenerate Plan
                  </button>
                  <button className={styles.secondaryBtn}>Export PDF</button>
                </div>
              </>
            )}
          </div>

          <RightPanel />
        </div>
      </div>
    </div>
  );
}
