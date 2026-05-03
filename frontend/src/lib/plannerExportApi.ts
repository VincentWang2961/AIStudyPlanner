import { API_BASE_URL } from "./apiBaseUrl";

export interface StudyPlanTerm {
  year: number;
  term: string;
  units: string[];
}

export interface ExportPlanRequest {
  courseCode: string;
  completedUnits?: string[];
  selectedSpecialisations: string[];
  plan: StudyPlanTerm[];
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

function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();

  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function exportPlanCsv(
  requestBody: ExportPlanRequest,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/planner/export/csv`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
    signal,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(readErrorMessage(payload, "Unable to export CSV file."));
  }

  const blob = await response.blob();

  downloadBlob(blob, "study-plan.csv");
}
