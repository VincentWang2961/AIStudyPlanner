"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";
import PlanCard from "@/components/PlanCard";
import styles from "./page.module.css";
import { MOCK_SAVED_PLANS } from "@/lib/plannerData";

export default function MyPlansPage() {
  const [selectedPlanId, setSelectedPlanId] = React.useState<string>(MOCK_SAVED_PLANS[0].id);
  const selectedPlan = MOCK_SAVED_PLANS.find((plan) => plan.id === selectedPlanId) ?? MOCK_SAVED_PLANS[0];

  return (
    <div className={styles.layout}>
      <Sidebar />
      <div className={styles.main}>
        <div className={styles.content}>
          <div className={styles.workspace}>
            <div className={styles.filterBar}>
              <input className={styles.searchInput} placeholder="Search plans by name or program..." />
              <select className={styles.filterSelect} defaultValue="all">
                <option value="all">All programs</option>
                <option value="cs">Computer Science</option>
              </select>
            </div>

            <section className={styles.section}>
              <h2>Saved plans</h2>
              <div className={styles.grid}>
                {MOCK_SAVED_PLANS.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    name={plan.name}
                    program={plan.program}
                    semesters={plan.semesters}
                    unitsCompleted={Math.round((plan.totalUnits * plan.progressPercent) / 100)}
                    totalUnits={plan.totalUnits}
                    createdDate={plan.updatedAt}
                    status={plan.validationStatus}
                    selected={selectedPlanId === plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                  />
                ))}
              </div>
            </section>

            <section className={styles.section}>
              <h2>Selected plan details</h2>
              <div className={styles.detailGrid}>
                <div className={styles.detailCard}>
                  <span className={styles.detailLabel}>Name</span>
                  <strong>{selectedPlan.name}</strong>
                </div>
                <div className={styles.detailCard}>
                  <span className={styles.detailLabel}>Program</span>
                  <strong>{selectedPlan.program}</strong>
                </div>
                <div className={styles.detailCard}>
                  <span className={styles.detailLabel}>Last updated</span>
                  <strong>{selectedPlan.updatedAt}</strong>
                </div>
                <div className={styles.detailCard}>
                  <span className={styles.detailLabel}>Validation</span>
                  <strong>{selectedPlan.validationStatus}</strong>
                </div>
              </div>

              <div className={styles.actionRow}>
                <button className={styles.primaryBtn}>Open</button>
                <button className={styles.secondaryBtn}>Rename</button>
                <button className={styles.secondaryBtn}>Duplicate</button>
                <button className={styles.secondaryBtn}>Delete</button>
                <button className={styles.secondaryBtn}>Export</button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
