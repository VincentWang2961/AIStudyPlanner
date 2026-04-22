export type UnitStatus = "not-started" | "in-progress" | "completed";

export interface PlannerConfig {
  program: string;
  studyMode: string;
  semesters: number;
  unitsPerSemester: number;
  completedUnits: string;
  interests: string;
}

export interface PlanUnit {
  code: string;
  name: string;
  credits: number;
  description: string;
  prerequisites: string[];
  corequisites: string[];
  availability: string[];
  status: UnitStatus;
  type?: "core" | "elective";
}

export interface SemesterPlan {
  id: number;
  name: string;
  units: PlanUnit[];
}

export interface SavedPlanSummary {
  id: string;
  name: string;
  program: string;
  updatedAt: string;
  validationStatus: "pass" | "warning" | "fail";
  progressPercent: number;
  semesters: number;
  totalUnits: number;
}

export const DEFAULT_PLANNER_CONFIG: PlannerConfig = {
  program: "cs",
  studyMode: "fulltime",
  semesters: 6,
  unitsPerSemester: 4,
  completedUnits: "",
  interests: "AI, data, software engineering",
};

export const PROGRAM_LABELS: Record<string, string> = {
  cs: "Computer Science",
  math: "Mathematics",
  physics: "Physics",
  engineering: "Engineering",
};

export const STUDY_MODE_LABELS: Record<string, string> = {
  fulltime: "Full-time",
  parttime: "Part-time",
};

const CS_CATALOG: PlanUnit[] = [
  { code: "CS101", name: "Intro to Computer Science", credits: 3, description: "Foundational programming and problem solving.", prerequisites: [], corequisites: [], availability: ["Spring 2025", "Spring 2026", "Fall 2025"], status: "not-started", type: "core" },
  { code: "MATH101", name: "Calculus I", credits: 4, description: "Mathematics foundation for technical study.", prerequisites: [], corequisites: [], availability: ["Spring 2025", "Fall 2025", "Spring 2026"], status: "not-started", type: "core" },
  { code: "CS201", name: "Data Structures", credits: 3, description: "Core data structures and algorithmic thinking.", prerequisites: ["CS101"], corequisites: [], availability: ["Fall 2025", "Fall 2026"], status: "not-started", type: "core" },
  { code: "MATH201", name: "Calculus II", credits: 4, description: "Continuation of calculus for technical programs.", prerequisites: ["MATH101"], corequisites: [], availability: ["Fall 2025", "Spring 2026"], status: "not-started", type: "core" },
  { code: "CS301", name: "Algorithms", credits: 4, description: "Design and analysis of efficient algorithms.", prerequisites: ["CS201"], corequisites: [], availability: ["Spring 2026", "Spring 2027"], status: "not-started", type: "core" },
  { code: "PHYS111", name: "Physics I", credits: 4, description: "Mechanics and mathematical modelling.", prerequisites: [], corequisites: [], availability: ["Spring 2026", "Fall 2025"], status: "not-started", type: "elective" },
  { code: "CS302", name: "Databases", credits: 3, description: "Data modelling, SQL, and transactional systems.", prerequisites: ["CS201"], corequisites: [], availability: ["Fall 2026", "Fall 2025"], status: "not-started", type: "core" },
  { code: "CS303", name: "Operating Systems", credits: 4, description: "Processes, memory, concurrency, and systems design.", prerequisites: ["CS201"], corequisites: [], availability: ["Fall 2026", "Spring 2026"], status: "not-started", type: "core" },
  { code: "STAT200", name: "Statistics", credits: 3, description: "Probability, inference, and data interpretation.", prerequisites: ["MATH101"], corequisites: [], availability: ["Spring 2026", "Fall 2025"], status: "not-started", type: "core" },
  { code: "CS401", name: "Machine Learning", credits: 4, description: "Supervised and unsupervised learning methods.", prerequisites: ["CS301", "STAT200"], corequisites: [], availability: ["Fall 2026", "Spring 2027"], status: "not-started", type: "elective" },
  { code: "CS402", name: "Networks", credits: 3, description: "Protocols, routing, and network architectures.", prerequisites: ["CS201"], corequisites: [], availability: ["Fall 2026"], status: "not-started", type: "elective" },
  { code: "CS403", name: "Software Engineering", credits: 3, description: "Team based system design and delivery.", prerequisites: ["CS201"], corequisites: [], availability: ["Spring 2026", "Fall 2026"], status: "not-started", type: "core" },
];

const MATH_CATALOG: PlanUnit[] = [
  { code: "MATH101", name: "Calculus I", credits: 4, description: "Limits, differentiation, and applications.", prerequisites: [], corequisites: [], availability: ["Spring 2025", "Fall 2025"], status: "not-started", type: "core" },
  { code: "MATH102", name: "Linear Algebra", credits: 4, description: "Matrices, vector spaces, and transformations.", prerequisites: [], corequisites: [], availability: ["Spring 2025", "Spring 2026"], status: "not-started", type: "core" },
  { code: "STAT140", name: "Intro Statistics", credits: 3, description: "Basic probability and statistical inference.", prerequisites: [], corequisites: [], availability: ["Fall 2025", "Spring 2026"], status: "not-started", type: "core" },
  { code: "MATH201", name: "Calculus II", credits: 4, description: "Integration and series.", prerequisites: ["MATH101"], corequisites: [], availability: ["Fall 2025", "Spring 2026"], status: "not-started", type: "core" },
  { code: "MATH202", name: "Discrete Mathematics", credits: 3, description: "Logic, proofs, combinatorics, graphs.", prerequisites: [], corequisites: [], availability: ["Fall 2025"], status: "not-started", type: "core" },
  { code: "MATH301", name: "Real Analysis", credits: 4, description: "Rigorous foundations of calculus.", prerequisites: ["MATH201"], corequisites: [], availability: ["Spring 2026"], status: "not-started", type: "core" },
  { code: "MATH302", name: "Abstract Algebra", credits: 4, description: "Groups, rings, and fields.", prerequisites: ["MATH202"], corequisites: [], availability: ["Fall 2026"], status: "not-started", type: "elective" },
  { code: "STAT240", name: "Probability", credits: 3, description: "Random variables and distributions.", prerequisites: ["STAT140", "MATH101"], corequisites: [], availability: ["Spring 2026"], status: "not-started", type: "elective" },
];

const PHYSICS_CATALOG: PlanUnit[] = [
  { code: "PHYS111", name: "Physics I", credits: 4, description: "Classical mechanics and motion.", prerequisites: [], corequisites: [], availability: ["Spring 2025", "Fall 2025"], status: "not-started", type: "core" },
  { code: "MATH101", name: "Calculus I", credits: 4, description: "Mathematics for physical science.", prerequisites: [], corequisites: [], availability: ["Spring 2025", "Fall 2025"], status: "not-started", type: "core" },
  { code: "PHYS112", name: "Physics II", credits: 4, description: "Electricity, magnetism, and waves.", prerequisites: ["PHYS111"], corequisites: ["MATH101"], availability: ["Fall 2025", "Spring 2026"], status: "not-started", type: "core" },
  { code: "MATH201", name: "Calculus II", credits: 4, description: "Further mathematics for modelling.", prerequisites: ["MATH101"], corequisites: [], availability: ["Fall 2025", "Spring 2026"], status: "not-started", type: "core" },
  { code: "PHYS211", name: "Classical Mechanics", credits: 4, description: "Advanced mechanics and systems.", prerequisites: ["PHYS112"], corequisites: [], availability: ["Spring 2026"], status: "not-started", type: "core" },
  { code: "PHYS212", name: "Electromagnetism", credits: 4, description: "Fields and Maxwell equations.", prerequisites: ["PHYS112"], corequisites: [], availability: ["Fall 2026"], status: "not-started", type: "core" },
];

const ENGINEERING_CATALOG: PlanUnit[] = [
  { code: "ENGR101", name: "Engineering Design", credits: 3, description: "Studio based introduction to design practice.", prerequisites: [], corequisites: [], availability: ["Spring 2025", "Fall 2025"], status: "not-started", type: "core" },
  { code: "MATH101", name: "Calculus I", credits: 4, description: "Mathematics for engineering systems.", prerequisites: [], corequisites: [], availability: ["Spring 2025", "Fall 2025"], status: "not-started", type: "core" },
  { code: "PHYS111", name: "Physics I", credits: 4, description: "Mechanics and physical principles.", prerequisites: [], corequisites: [], availability: ["Spring 2025", "Fall 2025"], status: "not-started", type: "core" },
  { code: "ENGR201", name: "Mechanics", credits: 4, description: "Statics, forces, and structures.", prerequisites: ["PHYS111"], corequisites: [], availability: ["Fall 2025"], status: "not-started", type: "core" },
  { code: "ENGR202", name: "Materials", credits: 3, description: "Properties and selection of materials.", prerequisites: [], corequisites: [], availability: ["Spring 2026"], status: "not-started", type: "core" },
  { code: "ENGR301", name: "Control Systems", credits: 4, description: "Modelling and control of dynamic systems.", prerequisites: ["ENGR201"], corequisites: [], availability: ["Fall 2026"], status: "not-started", type: "elective" },
];

export const PROGRAM_CATALOGS: Record<string, PlanUnit[]> = {
  cs: CS_CATALOG,
  math: MATH_CATALOG,
  physics: PHYSICS_CATALOG,
  engineering: ENGINEERING_CATALOG,
};

export const ALL_UNITS = Object.values(PROGRAM_CATALOGS).flat();

export const MOCK_SAVED_PLANS: SavedPlanSummary[] = [
  {
    id: "plan-1",
    name: "CS Major Starter Plan",
    program: "Computer Science",
    updatedAt: "Apr 20, 2026",
    validationStatus: "warning",
    progressPercent: 35,
    semesters: 6,
    totalUnits: 12,
  },
  {
    id: "plan-2",
    name: "Balanced Part-time Schedule",
    program: "Computer Science",
    updatedAt: "Apr 18, 2026",
    validationStatus: "pass",
    progressPercent: 60,
    semesters: 8,
    totalUnits: 14,
  },
  {
    id: "plan-3",
    name: "Math-heavy AI Path",
    program: "Computer Science",
    updatedAt: "Apr 15, 2026",
    validationStatus: "warning",
    progressPercent: 28,
    semesters: 6,
    totalUnits: 13,
  },
];

export function buildSemesterName(index: number): string {
  const season = index % 2 === 0 ? "Spring" : "Fall";
  const year = 2025 + Math.floor(index / 2);
  return `${season} ${year}`;
}

export function generateDraftPlan(config: PlannerConfig): SemesterPlan[] {
  const catalog = PROGRAM_CATALOGS[config.program] ?? PROGRAM_CATALOGS.cs;
  const semesters: SemesterPlan[] = Array.from({ length: config.semesters }, (_, index) => ({
    id: index + 1,
    name: buildSemesterName(index),
    units: [],
  }));

  let cursor = 0;
  for (const semester of semesters) {
    const chunk = catalog.slice(cursor, cursor + config.unitsPerSemester);
    semester.units = chunk.map((unit) => ({ ...unit }));
    cursor += config.unitsPerSemester;
  }

  return semesters;
}

export function flattenUnits(plan: SemesterPlan[]): PlanUnit[] {
  return plan.flatMap((semester) => semester.units);
}

export function getTotalCredits(plan: SemesterPlan[]): number {
  return flattenUnits(plan).reduce((sum, unit) => sum + unit.credits, 0);
}

export function findUnitByCode(code: string): PlanUnit | undefined {
  return ALL_UNITS.find((unit) => unit.code === code);
}
