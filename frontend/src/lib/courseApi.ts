import { API_BASE_URL } from "./apiBaseUrl";

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
    .map((item) => {
      if (item && typeof item === "object") {
        const raw = item as Record<string, unknown>;
        return String(raw.name ?? raw.title ?? raw.code ?? "").trim();
      }
      return String(item ?? "").trim();
    })
    .filter((item) => item.length > 0);
}

function toAvailabilityArray(value: unknown): string[] {
  if (Array.isArray(value)) return toStringArray(value);
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
    title: String(raw?.title ?? raw?.name ?? ""),
    curriculumType: nullableString(raw.curriculum_type ?? raw.curriculumType),
    sourceId: nullableString(raw.source_id ?? raw.sourceId ?? raw.id),
    status: nullableString(raw.status),
    availabilities: toAvailabilityArray(raw?.availabilities ?? raw?.availability),
    prerequisitesRaw: nullableString(raw.prerequisites_raw ?? raw.prerequisitesRaw),
    prerequisitesParsed: raw?.prerequisites_parsed ?? raw?.prerequisitesParsed ?? raw?.prerequisites ?? null,
    corequisitesRaw: nullableString(raw.corequisites_raw ?? raw.corequisitesRaw),
    corequisitesParsed: raw?.corequisites_parsed ?? raw?.corequisitesParsed ?? raw?.corequisites ?? null,
    incompatibilitiesRaw: nullableString(raw.incompatibilities_raw ?? raw.incompatibilitiesRaw),
    incompatibilitiesParsed: raw?.incompatibilities_parsed ?? raw?.incompatibilitiesParsed ?? raw?.incompatibilities ?? null,
  };
}

function normalizeCourseSummary(value: unknown): CourseSummary {
  const raw = toRecord(value);

  return {
    code: String(raw?.code ?? raw?.courseCode ?? ""),
    title: String(raw?.title ?? raw?.name ?? ""),
    specialisations: toStringArray(raw?.specialisations),
  };
}

function normalizeCourseGroup(value: unknown): CourseGroup {
  const raw = toRecord(value);
  const groupCode = String(raw?.group_code ?? raw?.groupCode ?? raw?.code ?? raw?.name ?? "");

  return {
    id: String(raw?.id ?? groupCode),
    courseCode: String(raw?.course_code ?? raw?.courseCode ?? ""),
    groupCode,
    name: String(raw?.name ?? ""),
    ruleText: nullableString(raw.rule_text ?? raw.ruleText),
    ruleJson: raw?.rule_json ?? raw?.ruleJson ?? null,
    units: Array.isArray(raw?.units) ? raw.units.map(normalizeCourseUnit) : [],
  };
}

function normalizeSpecialisationGroups(value: unknown, courseCode: string): CourseGroup[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const specialisation = toRecord(item);
    const specialisationCode = String(specialisation.code ?? specialisation.name ?? "").trim();
    const specialisationName = String(specialisation.name ?? specialisation.code ?? "").trim();
    const groups = Array.isArray(specialisation.groups) ? specialisation.groups : [];

    return groups.map((group, index) => {
      const rawGroup = toRecord(group);
      const fallbackCode = [specialisationCode, String(rawGroup.name ?? `GROUP_${index + 1}`)]
        .filter(Boolean)
        .join("-");

      return normalizeCourseGroup({
        ...rawGroup,
        id: rawGroup.id ?? fallbackCode,
        course_code: rawGroup.course_code ?? rawGroup.courseCode ?? courseCode,
        group_code: rawGroup.group_code ?? rawGroup.groupCode ?? rawGroup.code ?? fallbackCode,
        name: rawGroup.name
          ? `${specialisationName ? `${specialisationName} - ` : ""}${rawGroup.name}`
          : specialisationName,
        rule_json: rawGroup.rule_json ?? rawGroup.ruleJson ?? { specialisation: specialisationCode },
      });
    });
  });
}

function mergeGroups(groups: CourseGroup[]): CourseGroup[] {
  const seen = new Set<string>();

  return groups.filter((group) => {
    const key = `${group.groupCode}|${group.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeCourseDetails(value: unknown): CourseDetails {
  const raw = toRecord(value);
  const code = String(raw?.code ?? raw?.courseCode ?? "");
  const topLevelGroups = Array.isArray(raw?.groups) ? raw.groups.map(normalizeCourseGroup) : [];
  const nestedSpecialisationGroups = normalizeSpecialisationGroups(raw?.specialisations, code);

  return {
    code,
    title: String(raw?.title ?? raw?.name ?? ""),
    majorCode: nullableString(raw.major_code),
    minPoints: typeof raw?.min_points === "number" ? raw.min_points : null,
    maxPoints: typeof raw?.max_points === "number" ? raw.max_points : null,
    maxYears: typeof raw?.time_limit_years === "number" ? raw.time_limit_years : null,
    specialisations: toStringArray(raw?.specialisations),
    rules: raw?.extracted_rules ?? null,
    units: Array.isArray(raw?.units) ? raw.units.map(normalizeCourseUnit) : [],
    groups: mergeGroups([...topLevelGroups, ...nestedSpecialisationGroups]),
  };
}

export function formatCourseOptionLabel(course: CourseSummary): string {
  return course.title;
}

export async function fetchCourses(signal?: AbortSignal): Promise<CourseSummary[]> {
  const response = await fetch(`${API_BASE_URL}/api/courses`, {
    cache: "no-store",
    signal,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, "Unable to load courses."));
  }

  if (!payload?.success || !Array.isArray(payload?.courses)) {
    throw new Error("The course catalogue response was incomplete.");
  }

  return (payload.courses as unknown[])
    .map(normalizeCourseSummary)
    .filter((course) => course.code.length > 0 && course.title.length > 0);
}

export async function fetchCourseDetails(
  courseCode: string,
  signal?: AbortSignal
): Promise<CourseDetails> {
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

  if (!payload?.success || !payload?.course) {
    throw new Error("The course detail response was incomplete.");
  }

  return normalizeCourseDetails(payload.course);
}
