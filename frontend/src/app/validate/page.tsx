"use client";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import SectionCard from "@/components/SectionCard";
import ValidationSidebar from "@/components/ValidationSidebar";
import ValidationDetail from "@/components/ValidationDetail";
import UnitTable from "@/components/UnitTable";
import RightPanel from "@/components/RightPanel";
import styles from "./page.module.css";
import React from "react";

export default function ValidatePage() {
  const [selectedCheck, setSelectedCheck] = React.useState("prerequisites");

  const validationChecks = [
    { id: "prerequisites", name: "Prerequisites", status: "pass" as const },
    { id: "workload", name: "Workload", status: "warning" as const },
    { id: "availability", name: "Availability", status: "pass" as const },
    { id: "conflicts", name: "Timetable Conflicts", status: "pass" as const },
    { id: "electives", name: "Elective Balance", status: "warning" as const },
  ];

  const checkDetails: {
    [key: string]: {
      status: "pass" | "warning" | "fail";
      message: string;
      details: string[];
    };
  } = {
    prerequisites: {
      status: "pass",
      message:
        "All selected units have their prerequisites met. Your study plan follows the correct prerequisite chain.",
      details: [
        "CS101 has no prerequisites ✓",
        "MATH201 requires MATH101 - completed ✓",
        "CS201 requires CS101 - scheduled before ✓",
      ],
    },
    workload: {
      status: "warning",
      message:
        "Your semester 3 has a high workload with 5 units. Consider spreading these across additional semesters for better learning outcomes.",
      details: [
        "Semester 1: 4 units (normal)",
        "Semester 2: 4 units (normal)",
        "Semester 3: 5 units (high) ⚠",
      ],
    },
    availability: {
      status: "pass",
      message:
        "All selected units are available in their scheduled semesters. No availability issues found.",
      details: [
        "All Spring 2025 units confirmed available ✓",
        "All Fall 2025 units confirmed available ✓",
      ],
    },
    conflicts: {
      status: "pass",
      message:
        "No timetable conflicts detected. All units can be taken simultaneously without schedule clashes.",
      details: [],
    },
    electives: {
      status: "warning",
      message:
        "Consider adding more electives for flexibility. Your plan has room for 2 more elective units.",
      details: [
        "Current electives: 3 units",
        "Recommended electives: 5 units",
        "Available elective slots: 2",
      ],
    },
  };

  const planUnits = [
    {
      code: "CS101",
      name: "Intro to Computer Science",
      semester: 1,
      credits: 3,
      status: "not-started" as const,
    },
    {
      code: "MATH201",
      name: "Calculus II",
      semester: 1,
      credits: 4,
      status: "not-started" as const,
    },
    {
      code: "CS201",
      name: "Data Structures",
      semester: 2,
      credits: 3,
      status: "not-started" as const,
    },
    {
      code: "PHYS111",
      name: "Physics I",
      semester: 2,
      credits: 4,
      status: "not-started" as const,
    },
  ];

  const currentCheck = checkDetails[selectedCheck];

  return (
    <div className={styles.layout}>
      <Sidebar />
      <div className={styles.main}>
        <Header />

        <div className={styles.content}>
          <ValidationSidebar
            checks={validationChecks}
            selectedCheck={selectedCheck}
            onSelectCheck={setSelectedCheck}
          />

          <div className={styles.centerContent}>
            <SectionCard title="Validation Report">
              <div className={styles.reportSummary}>
                <div className={styles.summaryItem}>
                  <span className={styles.label}>Plan Name:</span>
                  <span className={styles.value}>CS Major - 2025</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.label}>Program:</span>
                  <span className={styles.value}>Computer Science</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.label}>Total Units:</span>
                  <span className={styles.value}>12</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.label}>Total Semesters:</span>
                  <span className={styles.value}>4</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Validation Result">
              <ValidationDetail
                checkName={
                  validationChecks.find((c) => c.id === selectedCheck)?.name ||
                  "Validation"
                }
                status={currentCheck.status}
                message={currentCheck.message}
                details={currentCheck.details}
              />
            </SectionCard>

            <SectionCard title="Study Plan Units">
              <UnitTable units={planUnits} />
            </SectionCard>

            <div style={{ marginBottom: "20px" }}>
              <button className={styles.exportBtn}>Export Validation Report</button>
            </div>
          </div>

          <RightPanel />
        </div>
      </div>
    </div>
  );
}
