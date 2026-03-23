"use client";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import SectionCard from "@/components/SectionCard";
import PlanCard from "@/components/PlanCard";
import UnitCard from "@/components/UnitCard";
import RightPanel from "@/components/RightPanel";
import styles from "./page.module.css";
import React from "react";

export default function MyPlansPage() {
  const [selectedPlan, setSelectedPlan] = React.useState<string | null>("plan-1");

  // Sample plans data
  const plans = [
    {
      id: "plan-1",
      name: "CS Major - 2025",
      program: "Computer Science",
      semesters: 6,
      unitsCompleted: 3,
      totalUnits: 12,
      createdDate: "Mar 10, 2025",
    },
    {
      id: "plan-2",
      name: "CS with Math Minor",
      program: "Computer Science",
      semesters: 8,
      unitsCompleted: 0,
      totalUnits: 16,
      createdDate: "Mar 15, 2025",
    },
    {
      id: "plan-3",
      name: "Data Science Track",
      program: "Computer Science",
      semesters: 7,
      unitsCompleted: 1,
      totalUnits: 14,
      createdDate: "Mar 18, 2025",
    },
  ];

  const selectedPlanUnits = [
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
      code: "CS301",
      name: "Algorithms",
      semester: "Fall 25",
    },
    {
      code: "PHYS111",
      name: "Physics I",
      semester: "Spring 25",
      status: "completed" as const,
    },
    {
      code: "MATH101",
      name: "Calculus I",
      semester: "Winter 25",
      status: "completed" as const,
    },
  ];

  return (
    <div className={styles.layout}>
      <Sidebar />
      <div className={styles.main}>
        <Header />

        <div className={styles.content}>
          <div className={styles.centerContent}>
            <div className={styles.filterBar}>
              <input
                type="text"
                placeholder="Search plans by name or program..."
                className={styles.searchInput}
              />
              <select className={styles.filterSelect}>
                <option>All Programs</option>
                <option>Computer Science</option>
                <option>Mathematics</option>
                <option>Physics</option>
              </select>
            </div>

            <SectionCard title="All Study Plans">
              <div className={styles.plansGrid}>
                {plans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    {...plan}
                    selected={selectedPlan === plan.id}
                    onClick={() => setSelectedPlan(plan.id)}
                  />
                ))}
              </div>
            </SectionCard>

            {selectedPlan && (
              <>
                <SectionCard title="Plan Details & Units">
                  <div className={styles.planInfo}>
                    <div className={styles.infoCol}>
                      <h4>Plan Information</h4>
                      <p>
                        <strong>Name:</strong>{" "}
                        {plans.find((p) => p.id === selectedPlan)?.name}
                      </p>
                      <p>
                        <strong>Program:</strong>{" "}
                        {plans.find((p) => p.id === selectedPlan)?.program}
                      </p>
                      <p>
                        <strong>Semesters:</strong>{" "}
                        {plans.find((p) => p.id === selectedPlan)?.semesters}
                      </p>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Units in This Plan">
                  <div className={styles.unitsGrid}>
                    {selectedPlanUnits.map((unit) => (
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
              </>
            )}
          </div>

          <RightPanel />
        </div>
      </div>
    </div>
  );
}
