import type { PlannerConfig, SemesterPlan } from "./plannerData";
import { API_BASE_URL } from "./apiBaseUrl";

export interface SavedStudyPlan {
  id: string;
  name: string;
  courseCode: string | null;
  program: string | null;
  config: PlannerConfig | null;
  planData: SemesterPlan[];
  createdAt: string;
  updatedAt: string;
}

export interface SaveStudyPlanInput {
  id?: string;
  name: string;
  courseCode: string;
  program: string;
  config: PlannerConfig;
  planData: SemesterPlan[];
}

async function readJson(response: Response) {
  return response.json().catch(() => null);
}

export async function listStudyPlans(): Promise<SavedStudyPlan[]> {
  const response = await fetch(`${API_BASE_URL}/api/plans`, {
    credentials: "include",
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(payload?.error ?? payload?.message ?? "Unable to load saved plans.");
  }

  return Array.isArray(payload?.plans) ? payload.plans : [];
}

export async function saveStudyPlan(input: SaveStudyPlanInput): Promise<SavedStudyPlan> {
  const response = await fetch(`${API_BASE_URL}/api/plans`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(payload?.error ?? payload?.message ?? "Unable to save study plan.");
  }

  if (!payload?.plan) {
    throw new Error("The save response was incomplete.");
  }

  return payload.plan;
}

export async function deleteStudyPlan(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/plans/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(payload?.error ?? payload?.message ?? "Unable to delete study plan.");
  }
}
