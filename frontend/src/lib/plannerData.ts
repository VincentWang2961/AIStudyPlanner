export interface PlannerConfig {
  degreeLevel: string;
  program: string;
  studyMode: string;
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

export function buildSemesterName(index: number): string {
  const season = index % 2 === 0 ? "Spring" : "Fall";
  const year = 2025 + Math.floor(index / 2);
  return `${season} ${year}`;
}

export function flattenUnits(plan: SemesterPlan[]): PlanUnit[] {
  return plan.flatMap((semester) => semester.units);
}

export function getTotalCredits(plan: SemesterPlan[]): number {
  return flattenUnits(plan).reduce((sum, unit) => sum + unit.credits, 0);
}
