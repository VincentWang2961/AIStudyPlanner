"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import UnitCard from "@/components/UnitCard";
import styles from "./page.module.css";
import { ALL_UNITS } from "@/lib/plannerData";

export default function UnitsPage() {
  const [query, setQuery] = React.useState("");

  const filteredUnits = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return ALL_UNITS;
    return ALL_UNITS.filter(
      (unit) =>
        unit.code.toLowerCase().includes(normalized) ||
        unit.name.toLowerCase().includes(normalized) ||
        unit.description.toLowerCase().includes(normalized)
    );
  }, [query]);

  return (
    <div className={styles.layout}>
      <Sidebar />
      <div className={styles.main}>
        <Header
          title="Units"
          subtitle="Browse unit information, semester availability, and prerequisite details."
        />

        <div className={styles.content}>
          <div className={styles.workspace}>
            <div className={styles.filterBar}>
              <input
                className={styles.searchInput}
                placeholder="Search by unit code, title, or keyword..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className={styles.unitGrid}>
              {filteredUnits.map((unit) => (
                <article key={unit.code} className={styles.unitPanel}>
                  <UnitCard code={unit.code} name={unit.name} semester={unit.availability.join(", ")} status={unit.status} />
                  <div className={styles.metaBlock}>
                    <p>{unit.description}</p>
                    <div className={styles.metaRow}><strong>Prerequisites:</strong> {unit.prerequisites.length ? unit.prerequisites.join(", ") : "None"}</div>
                    <div className={styles.metaRow}><strong>Availability:</strong> {unit.availability.join(", ")}</div>
                    <button className={styles.actionBtn}>Add to current plan</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
