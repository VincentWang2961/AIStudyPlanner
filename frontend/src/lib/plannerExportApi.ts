import type { PlannerConfig, SemesterPlan } from "@/lib/plannerData";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

interface ExportPlanCsvRequest {
  courseCode: string;
  program: string;
  config: PlannerConfig;
  planData: SemesterPlan[];
}

export async function exportPlanCsv(payload: ExportPlanCsvRequest): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/api/planner/export/csv`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Unable to export CSV.");
  }

  return response.blob();
}