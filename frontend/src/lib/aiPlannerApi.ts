import type { PlanUnit, SemesterPlan } from "./plannerData";

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
}

export interface GenerateAiPlanRequest {
  programCode: string;
  userMessage: string;
  requestedSemesters: number;
  requestedUnitsPerSemester: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

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
    const issueMessages = Array.isArray(payload?.issues)
      ? payload.issues.map((issue: { message?: string }) => issue.message).filter(Boolean)
      : [];
    const message = issueMessages.length > 0
      ? issueMessages.join(" ")
      : payload?.error ?? payload?.message ?? "Unable to generate an AI study plan.";
    throw new Error(message);
  }

  if (!payload?.data?.plan?.semesters) {
    throw new Error("The AI planner returned an unexpected response.");
  }

  return payload.data;
}

export function toSemesterPlan(response: AiStudyPlanResponse): SemesterPlan[] {
  return response.plan.semesters.map((semester): SemesterPlan => ({
    id: semester.sequence,
    name: semester.label,
    units: semester.units.map((unit): PlanUnit => ({
      code: unit.code,
      name: unit.title,
      credits: unit.creditPoints,
      description: unit.rationale ?? `${unit.type === "core" ? "Core" : "Elective"} unit selected by the AI planner.`,
      prerequisites: [],
      corequisites: [],
      availability: [semester.label],
      type: unit.type,
    })),
  }));
}
