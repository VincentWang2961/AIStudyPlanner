"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";
import UnitCard from "@/components/UnitCard";
import styles from "./page.module.css";
import {
  fetchCourseDetails,
  fetchCourses,
  formatCourseOptionLabel,
  type CourseSummary,
  type CourseUnit,
} from "@/lib/courseApi";

export default function UnitsPage() {
  const [query, setQuery] = React.useState("");
  const [courses, setCourses] = React.useState<CourseSummary[]>([]);
  const [selectedCourseCode, setSelectedCourseCode] = React.useState("62510");
  const [units, setUnits] = React.useState<CourseUnit[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();

    async function loadUnits() {
      setIsLoading(true);
      setError(null);

      try {
        const loadedCourses = await fetchCourses(controller.signal);
        const preferredCourse =
          loadedCourses.find((course) => course.code === selectedCourseCode) ??
          loadedCourses.find((course) => course.code === "62510") ??
          loadedCourses[0];

        if (!preferredCourse) {
          setCourses([]);
          setUnits([]);
          return;
        }

        const details = await fetchCourseDetails(preferredCourse.code, controller.signal);

        if (!controller.signal.aborted) {
          setCourses(loadedCourses);
          setSelectedCourseCode(preferredCourse.code);
          setUnits([...details.units].sort((left, right) => left.code.localeCompare(right.code)));
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load units from the backend.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadUnits();

    return () => controller.abort();
  }, [selectedCourseCode]);

  const filteredUnits = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return units;
    return units.filter(
      (unit) =>
        unit.code.toLowerCase().includes(normalized) ||
        unit.title.toLowerCase().includes(normalized) ||
        (unit.prerequisitesRaw ?? "").toLowerCase().includes(normalized)
    );
  }, [query, units]);

  return (
    <div className={styles.layout}>
      <Sidebar />
      <main id="main-content" className={styles.main}>
        <div className={styles.content}>
          <div className={styles.workspace}>
            <div className={styles.filterBar} role="search">
              <label className={styles.visuallyHidden} htmlFor="unit-search">Search units</label>
              <input
                id="unit-search"
                className={styles.searchInput}
                placeholder="Search by unit code, title, or keyword..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-describedby="unit-search-count"
              />
              <label className={styles.visuallyHidden} htmlFor="unit-course-filter">Filter by course</label>
              <select
                id="unit-course-filter"
                className={styles.courseSelect}
                value={selectedCourseCode}
                onChange={(event) => setSelectedCourseCode(event.target.value)}
                disabled={courses.length === 0}
              >
                {courses.map((course) => (
                  <option key={course.code} value={course.code}>
                    {formatCourseOptionLabel(course)}
                  </option>
                ))}
              </select>
              <p id="unit-search-count" className={styles.visuallyHidden} aria-live="polite">
                {filteredUnits.length} unit{filteredUnits.length !== 1 ? "s" : ""} found.
              </p>
            </div>

            <div className={styles.unitGrid}>
              {isLoading ? <p>Loading units from backend...</p> : null}
              {error ? <p role="alert">{error}</p> : null}
              {!isLoading && !error && filteredUnits.length === 0 ? (
                <p>No units found.</p>
              ) : null}
              {filteredUnits.map((unit) => (
                <article key={unit.code} className={styles.unitPanel}>
                  <UnitCard
                    code={unit.code}
                    name={unit.title}
                    semester={unit.availabilities.length > 0 ? unit.availabilities.join(", ") : "Availability not listed"}
                  />
                  <div className={styles.metaBlock}>
                    <p>{unit.curriculumType ?? unit.status ?? "Backend course unit"}</p>
                    <div className={styles.metaRow}><strong>Credits:</strong> 6cr</div>
                    <div className={styles.metaRow}><strong>Prerequisites:</strong> {unit.prerequisitesRaw ?? "None"}</div>
                    <div className={styles.metaRow}><strong>Availability:</strong> {unit.availabilities.length > 0 ? unit.availabilities.join(", ") : "Not listed"}</div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
