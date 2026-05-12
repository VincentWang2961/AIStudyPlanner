import { API_BASE_URL } from "./apiBaseUrl";
import { getDummyStudyPlans } from "./dummyStudyPlans";

export interface CourseSummary {
  code: string;
  title: string;
  specialisations: string[];
}

export interface CourseUnit {
  code: string;
  title: string;
  curriculumType: string | null;
  sourceId: string | null;
  status: string | null;
  availabilities: string[];
  prerequisitesRaw: string | null;
  prerequisitesParsed: unknown | null;
  corequisitesRaw: string | null;
  corequisitesParsed: unknown | null;
  incompatibilitiesRaw: string | null;
  incompatibilitiesParsed: unknown | null;
}

export interface CourseGroup {
  id: string;
  courseCode: string;
  groupCode: string;
  name: string;
  ruleText: string | null;
  ruleJson: unknown | null;
  units: CourseUnit[];
}

export interface CourseDetails {
  code: string;
  title: string;
  majorCode: string | null;
  minPoints: number | null;
  maxPoints: number | null;
  maxYears: number | null;
  specialisations: string[];
  rules: unknown;
  units: CourseUnit[];
  groups: CourseGroup[];
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => String(item ?? "").trim())
    .filter((item) => item.length > 0);
}

function toAvailabilityArray(value: unknown): string[] {
  if (typeof value !== "string") return [];

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeCourseUnit(value: unknown): CourseUnit {
  const raw = toRecord(value);

  return {
    code: String(raw?.code ?? ""),
    title: String(raw?.title ?? ""),
    curriculumType: nullableString(raw.curriculum_type),
    sourceId: nullableString(raw.source_id),
    status: nullableString(raw.status),
    availabilities: toAvailabilityArray(raw?.availabilities),
    prerequisitesRaw: nullableString(raw.prerequisites_raw),
    prerequisitesParsed: raw?.prerequisites_parsed ?? null,
    corequisitesRaw: nullableString(raw.corequisites_raw),
    corequisitesParsed: raw?.corequisites_parsed ?? null,
    incompatibilitiesRaw: nullableString(raw.incompatibilities_raw),
    incompatibilitiesParsed: raw?.incompatibilities_parsed ?? null,
  };
}

function normalizeCourseSummary(value: unknown): CourseSummary {
  const raw = toRecord(value);

  return {
    code: String(raw?.code ?? ""),
    title: String(raw?.title ?? ""),
    specialisations: toStringArray(raw?.specialisations),
  };
}

function normalizeCourseGroup(value: unknown): CourseGroup {
  const raw = toRecord(value);

  return {
    id: String(raw?.id ?? ""),
    courseCode: String(raw?.course_code ?? ""),
    groupCode: String(raw?.group_code ?? ""),
    name: String(raw?.name ?? ""),
    ruleText: nullableString(raw.rule_text),
    ruleJson: raw?.rule_json ?? null,
    units: Array.isArray(raw?.units) ? raw.units.map(normalizeCourseUnit) : [],
  };
}

function normalizeCourseDetails(value: unknown): CourseDetails {
  const raw = toRecord(value);

  return {
    code: String(raw?.code ?? ""),
    title: String(raw?.title ?? ""),
    majorCode: nullableString(raw.major_code),
    minPoints: typeof raw?.min_points === "number" ? raw.min_points : null,
    maxPoints: typeof raw?.max_points === "number" ? raw.max_points : null,
    maxYears: typeof raw?.time_limit_years === "number" ? raw.time_limit_years : null,
    specialisations: toStringArray(raw?.specialisations),
    rules: raw?.extracted_rules ?? null,
    units: Array.isArray(raw?.units) ? raw.units.map(normalizeCourseUnit) : [],
    groups: Array.isArray(raw?.groups) ? raw.groups.map(normalizeCourseGroup) : [],
  };
}

function buildFallbackCourses(): CourseSummary[] {
  return getDummyStudyPlans().map((plan) => ({
    code: plan.courseCode ?? plan.id,
    title: plan.program ?? plan.name,
    specialisations: [],
  }));
}

function buildFallbackCourseDetails(courseCode: string): CourseDetails | null {
  const plan = getDummyStudyPlans().find((item) => item.courseCode === courseCode);

  if (!plan) return null;
  const units = plan.planData.flatMap((semester) =>
    semester.units.map((unit) => ({
      code: unit.code,
      title: unit.name,
      curriculumType: unit.type === "elective" ? "Elective" : "Core",
      sourceId: plan.courseCode,
      status: "Demo catalogue",
      availabilities: unit.availability,
      prerequisitesRaw: unit.prerequisites.join(", ") || null,
      prerequisitesParsed: null,
      corequisitesRaw: unit.corequisites.join(", ") || null,
      corequisitesParsed: null,
      incompatibilitiesRaw: null,
      incompatibilitiesParsed: null,
    }))
  );
  const coreUnits = units.filter((unit) => unit.curriculumType === "Core");
  const electiveUnits = units.filter((unit) => unit.curriculumType === "Elective");

  return {
    code: plan.courseCode ?? plan.id,
    title: plan.program ?? plan.name,
    majorCode: null,
    minPoints: null,
    maxPoints: plan.planData.reduce(
      (sum, semester) =>
        sum + semester.units.reduce((unitSum, unit) => unitSum + unit.credits, 0),
      0
    ),
    maxYears: plan.config?.semesters ? Math.ceil(plan.config.semesters / 2) : null,
    specialisations: ["General pathway", "Applied pathway"],
    rules: null,
    units,
    groups: [
      {
        id: `${plan.courseCode}-core`,
        courseCode: plan.courseCode ?? plan.id,
        groupCode: "CORE",
        name: "Core units",
        ruleText: "Complete the required core units for the course structure.",
        ruleJson: null,
        units: coreUnits,
      },
      {
        id: `${plan.courseCode}-elective`,
        courseCode: plan.courseCode ?? plan.id,
        groupCode: "ELEC",
        name: "Elective units",
        ruleText: "Choose electives to balance interests and workload.",
        ruleJson: null,
        units: electiveUnits,
      },
    ].filter((group) => group.units.length > 0),
  };
}

function logFallbackWarning(scope: string, error: unknown) {
  if (process.env.NODE_ENV === "production") return;

  console.warn(
    `Using local demo course catalogue because ${scope} could not be loaded from ${API_BASE_URL}.`,
    error
  );
}

export function formatCourseOptionLabel(course: CourseSummary): string {
  const specialisations =
    course.specialisations.length > 0
      ? ` (${course.specialisations.join(", ")})`
      : "";

  return `${course.code} - ${course.title}${specialisations}`;
}

export async function fetchCourses(signal?: AbortSignal): Promise<CourseSummary[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/courses`, {
      cache: "no-store",
      signal,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(readErrorMessage(payload, "Unable to load courses."));
    }

    if (!Array.isArray(payload?.courses)) {
      throw new Error("The course catalogue response was incomplete.");
    }

    return (payload.courses as unknown[])
      .map(normalizeCourseSummary)
      .filter((course) => course.code.length > 0);
  } catch (error) {
    if (signal?.aborted) throw error;

    logFallbackWarning("courses", error);
    return buildFallbackCourses();
  }
}

export async function fetchCourseDetails(
  courseCode: string,
  signal?: AbortSignal
): Promise<CourseDetails> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/courses/${encodeURIComponent(courseCode)}/full`,
      {
        cache: "no-store",
        signal,
      }
    );

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(readErrorMessage(payload, "Unable to load course details."));
    }

    if (!payload?.course) {
      throw new Error("The course detail response was incomplete.");
    }

    return normalizeCourseDetails(payload.course);
  } catch (error) {
    if (signal?.aborted) throw error;

    const fallbackDetails = buildFallbackCourseDetails(courseCode);

    if (!fallbackDetails) {
      throw error;
    }

    logFallbackWarning(`course ${courseCode}`, error);
    return fallbackDetails;
  }
}
