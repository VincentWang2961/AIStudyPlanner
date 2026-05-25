import type { PlanUnit, SemesterPlan } from "./plannerData";
import type { CourseDetails, CourseUnit } from "./courseApi";
import { buildSemesterName, type PlannerConfig } from "./plannerData";
import { API_BASE_URL } from "./apiBaseUrl";

export interface AiPlanUnit {
  code: string;
  title: string;
  creditPoints: number;
  type: "core" | "elective";
  rationale?: string;
}

export interface AiPlanSemester {
  sequence: number;
  label: string;
  units: AiPlanUnit[];
}

export interface AiStudyPlanSystemMessage {
  type: 'abuse' | 'off_topic' | 'fast_path' | 'irrelevant';
  message: string;
}

export interface AiStudyPlanResponse {
  plan: {
    programCode: string;
    programName: string;
    focusArea: string;
    semesters: AiPlanSemester[];
    summary: {
      totalCreditPoints: number;
      totalUnits: number;
      prerequisitesAssumedStrict: boolean;
    };
  };
  explanation: {
    overview: string;
    electiveRationales: string[];
  };
  warnings: string[];
  systemMessage?: AiStudyPlanSystemMessage;
}

export interface GenerateAiPlanRequest {
  programCode: string;
  userMessage: string;
  specialisation?: string;
  completedUnits?: string[];
  preferredSemesterCount?: number;
  unitsPerSemester?: number;
  startTerm?: PlannerConfig["startTerm"];
  preferences?: string;
}

const DEFAULT_UNIT_CREDIT_POINTS = 6;
const UNIT_CODE_PATTERN = /\b[A-Z]{4}\d{4}\b/g;

interface RuleNodeLike {
  type?: string;
  code?: string;
  children?: unknown[];
  rules?: unknown[];
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function formatAvailabilityLabel(value: string): string {
  const normalized = value.trim().toUpperCase();

  if (normalized === "S1") return "Semester 1";
  if (normalized === "S2") return "Semester 2";
  if (normalized === "N-S") return "Non-standard";
  if (normalized === "N/A") return "Unavailable";

  return value.trim();
}

function extractUnitCodesFromText(text: string | null | undefined): string[] {
  if (!text) return [];
  return dedupe(Array.from(text.matchAll(UNIT_CODE_PATTERN), (match) => match[0]));
}

function extractUnitCodesFromRule(rule: unknown): string[] {
  if (!rule || typeof rule !== "object") return [];

  const node = rule as RuleNodeLike;
  const type = node.type?.toUpperCase();

  if (type === "UNIT" && typeof node.code === "string") {
    return [node.code];
  }

  const childNodes = Array.isArray(node.children)
    ? node.children
    : Array.isArray(node.rules)
    ? node.rules
    : [];

  return dedupe(childNodes.flatMap(extractUnitCodesFromRule));
}

function extractRuleUnitCodes(rule: unknown, rawText: string | null | undefined): string[] {
  const parsedCodes = extractUnitCodesFromRule(rule);
  return parsedCodes.length > 0 ? parsedCodes : extractUnitCodesFromText(rawText);
}

function inferUnitType(unit: CourseUnit): "core" | "elective" {
  const source = `${unit.curriculumType ?? ""} ${unit.status ?? ""}`.toLowerCase();
  return source.includes("elective") || source.includes("option") ? "elective" : "core";
}

function buildUnitDescription(unit: CourseUnit, fallback: string): string {
  const details = [
    unit.curriculumType,
    unit.status,
    unit.availabilities.length > 0
      ? `Offered in ${unit.availabilities.map(formatAvailabilityLabel).join(", ")}`
      : null,
  ].filter(Boolean);

  const summary = details.join(" · ").trim();
  if (!summary) return fallback;

  return `${summary}.`;
}

function mapCourseUnitToPlanUnit(
  unit: CourseUnit,
  overrides: Partial<PlanUnit> = {}
): PlanUnit {
  const fallbackDescription = "Course unit loaded from the backend catalogue.";

  return {
    code: unit.code,
    name: unit.title,
    credits: overrides.credits ?? DEFAULT_UNIT_CREDIT_POINTS,
    description: overrides.description ?? buildUnitDescription(unit, fallbackDescription),
    prerequisites:
      overrides.prerequisites ??
      extractRuleUnitCodes(unit.prerequisitesParsed, unit.prerequisitesRaw),
    corequisites:
      overrides.corequisites ??
      extractRuleUnitCodes(unit.corequisitesParsed, unit.corequisitesRaw),
    availability:
      overrides.availability ??
      (unit.availabilities.length > 0
        ? unit.availabilities.map(formatAvailabilityLabel)
        : ["Availability unavailable"]),
    type: overrides.type ?? inferUnitType(unit),
  };
}

function buildCourseUnitLookup(courseDetails?: CourseDetails): Map<string, CourseUnit> {
  const units = [
    ...(courseDetails?.units ?? []),
    ...(courseDetails?.groups ?? []).flatMap((group) => group.units),
  ];

  return new Map(units.map((unit) => [unit.code, unit]));
}

export async function generateAiStudyPlan(input: GenerateAiPlanRequest): Promise<AiStudyPlanResponse> {
  const response = await fetch(`${API_BASE_URL}/api/ai/generate-plan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error ?? payload?.message ?? "Unable to generate an AI study plan.";
    throw new Error(message);
  }

  if (!payload?.data?.plan?.semesters) {
    throw new Error("The AI planner returned an unexpected response.");
  }

  return payload.data;
}

export function buildDraftPlanFromCourse(
  config: PlannerConfig,
  courseDetails: CourseDetails
): SemesterPlan[] {
  const semesters: SemesterPlan[] = Array.from({ length: config.semesters }, (_, index) => ({
    id: index + 1,
    name: buildSemesterName(index, config.startTerm),
    units: [],
  }));

  const sortedUnits = Array.from(buildCourseUnitLookup(courseDetails).values()).sort((left, right) => {
    const typeSort =
      Number(inferUnitType(left) === "elective") -
      Number(inferUnitType(right) === "elective");

    if (typeSort !== 0) return typeSort;
    return left.code.localeCompare(right.code);
  });

  let cursor = 0;
  for (const semester of semesters) {
    const chunk = sortedUnits.slice(cursor, cursor + config.unitsPerSemester);
    semester.units = chunk.map((unit) => mapCourseUnitToPlanUnit(unit));
    cursor += config.unitsPerSemester;
  }

  return semesters;
}

export function toSemesterPlan(
  response: AiStudyPlanResponse,
  courseDetails?: CourseDetails,
  config?: PlannerConfig
): SemesterPlan[] {
  const courseUnitLookup = buildCourseUnitLookup(courseDetails);

  return response.plan.semesters.map((semester): SemesterPlan => ({
    id: semester.sequence,
    name: config ? buildSemesterName(semester.sequence - 1, config.startTerm) : semester.label,
    units: semester.units.map((unit): PlanUnit => {
      const sourceUnit = courseUnitLookup.get(unit.code);

      if (sourceUnit) {
        return mapCourseUnitToPlanUnit(sourceUnit, {
          credits: unit.creditPoints,
          description:
            unit.rationale ??
            `${unit.type === "core" ? "Core" : "Elective"} unit selected by the AI planner.`,
          type: unit.type,
        });
      }

      return {
        code: unit.code,
        name: unit.title,
        credits: unit.creditPoints,
        description:
          unit.rationale ??
          `${unit.type === "core" ? "Core" : "Elective"} unit selected by the AI planner.`,
        prerequisites: [],
        corequisites: [],
        availability: [semester.label],
        type: unit.type,
      };
    }),
  }));
}
