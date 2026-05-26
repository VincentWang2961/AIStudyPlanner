import { API_BASE_URL } from "./apiBaseUrl";

export interface DefaultPlanTerm {
  sequence: number;
  year: number;
  term: "S1" | "S2";
  units: string[];
}

export interface DefaultStudyPlan {
  id: string;
  name: string;
  selectedSpecialisations: string[];
  startTerm: "S1" | "S2";
  startYear: number;
  plan: DefaultPlanTerm[];
}

export interface FetchDefaultPlanRequest {
  courseCode: string;
  specialisation: string;
  startTerm: "S1" | "S2";
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

export async function fetchDefaultStudyPlan(
  request: FetchDefaultPlanRequest,
  signal?: AbortSignal
): Promise<DefaultStudyPlan> {
  const params = new URLSearchParams({
    courseCode: request.courseCode,
    specialisation: request.specialisation,
    startTerm: request.startTerm,
  });

  const response = await fetch(`${API_BASE_URL}/api/default-plans?${params.toString()}`, {
    cache: "no-store",
    signal,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, "Unable to load a default study plan."));
  }

  if (!payload?.success || !payload?.plan || !Array.isArray(payload.plan.plan)) {
    throw new Error("The default plan response was incomplete.");
  }

  return payload.plan as DefaultStudyPlan;
}
