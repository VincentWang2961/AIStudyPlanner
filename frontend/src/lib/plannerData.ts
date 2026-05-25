export type StudyTerm = "S1" | "S2";

export interface PlannerConfig {
  degreeLevel: string;
  program: string;
  studyMode: string;
  startTerm: StudyTerm;
  semesters: number;
  unitsPerSemester: number;
}

export interface PlanUnit {
  code: string;
  name: string;
  credits: number;
  description: string;
  prerequisites: string[];
  corequisites: string[];
  availability: string[];
  type?: "core" | "elective";
}

export interface SemesterPlan {
  id: number;
  name: string;
  units: PlanUnit[];
}

export const DEFAULT_PLANNER_CONFIG: PlannerConfig = {
  degreeLevel: "masters",
  program: "62510",
  studyMode: "fulltime",
  startTerm: "S1",
  semesters: 4,
  unitsPerSemester: 4,
};

export const DEGREE_LEVEL_LABELS: Record<string, string> = {
  undergraduate: "Undergraduate",
  masters: "Master",
};

export const STUDY_MODE_LABELS: Record<string, string> = {
  fulltime: "Full-time",
  parttime: "Part-time",
};

export const STUDY_TERM_LABELS: Record<StudyTerm, string> = {
  S1: "Semester 1",
  S2: "Semester 2",
};

export function withPlannerConfigDefaults(config: Partial<PlannerConfig> | null | undefined): PlannerConfig {
  return {
    ...DEFAULT_PLANNER_CONFIG,
    ...config,
    startTerm: config?.startTerm === "S2" ? "S2" : "S1",
  };
}

export function getSemesterTerm(index: number, startTerm: StudyTerm = DEFAULT_PLANNER_CONFIG.startTerm): StudyTerm {
  const startsInS2 = startTerm === "S2";
  const isS2 = startsInS2 ? index % 2 === 0 : index % 2 === 1;

  return isS2 ? "S2" : "S1";
}

export function buildSemesterName(
  index: number,
  startTerm: StudyTerm = DEFAULT_PLANNER_CONFIG.startTerm,
  startYear = 2026
): string {
  const term = getSemesterTerm(index, startTerm);
  const yearOffset = startTerm === "S2" ? Math.floor((index + 1) / 2) : Math.floor(index / 2);
  const year = startYear + yearOffset;

  return `${STUDY_TERM_LABELS[term]} ${year}`;
}

export function getAvailabilityBadgeLabel(availability: string[]): string {
  const normalized = new Set(
    availability.map((value) => value.trim().toUpperCase()).filter(Boolean)
  );

  const hasS1 = normalized.has("S1") || Array.from(normalized).some((value) => value.includes("SEMESTER 1"));
  const hasS2 = normalized.has("S2") || Array.from(normalized).some((value) => value.includes("SEMESTER 2"));

  if (hasS1 && hasS2) return "S1/S2";
  if (hasS1) return "S1";
  if (hasS2) return "S2";
  if (normalized.has("N-S") || Array.from(normalized).some((value) => value.includes("NON-STANDARD"))) return "N-S";
  if (normalized.has("N/A") || Array.from(normalized).some((value) => value.includes("UNAVAILABLE"))) return "N/A";

  return "N/L";
}

export function flattenUnits(plan: SemesterPlan[]): PlanUnit[] {
  return plan.flatMap((semester) => semester.units);
}

export function getTotalCredits(plan: SemesterPlan[]): number {
  return flattenUnits(plan).reduce((sum, unit) => sum + unit.credits, 0);
}
