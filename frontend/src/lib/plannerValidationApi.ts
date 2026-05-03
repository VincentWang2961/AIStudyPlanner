import { API_BASE_URL } from "./apiBaseUrl";
import type { SemesterPlan } from "./plannerData";
import {
  buildValidationResult,
  type ValidationIssue,
  type ValidationResult,
  type ValidationSeverity,
} from "@/utils/validationRules";

export interface PlannerValidationPlanTerm {
  sequence: number;
  year: number;
  term: "S1" | "S2";
  units: string[];
}

export interface PlannerValidationRequest {
  courseCode: string;
  completedUnits: string[];
  selectedSpecialisations: string[];
  plan: PlannerValidationPlanTerm[];
}

interface PlannerValidationIssuePayload {
  category?: string;
  severity?: string;
  status?: string;
  title?: string;
  name?: string;
  check?: string;
  message?: string;
  description?: string;
  summary?: string;
  detail?: string;
  details?: string[];
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function toStringArray(value: unknown): string[] {
  if (typeof value === "string" && value.trim().length > 0) {
    return [value.trim()];
  }

  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => String(entry ?? "").trim())
    .filter((entry) => entry.length > 0);
}

function normalizeSeverity(value: unknown, fallback: ValidationSeverity = "warning"): ValidationSeverity {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (["pass", "passed", "ok", "success", "valid"].includes(normalized)) {
    return "pass";
  }
  if (["warning", "warn", "review"].includes(normalized)) {
    return "warning";
  }
  if (["fail", "failed", "error", "invalid"].includes(normalized)) {
    return "fail";
  }

  return fallback;
}

function readErrorMessage(payload: unknown, fallback: string): string {
  const raw = toRecord(payload);

  if (typeof raw.message === "string" && raw.message.trim().length > 0) {
    return raw.message;
  }

  if (typeof raw.error === "string" && raw.error.trim().length > 0) {
    return raw.error;
  }

  return fallback;
}

function slugifyCategory(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "validation";
}

function extractResponseRoot(payload: unknown): Record<string, unknown> {
  const raw = toRecord(payload);

  if (raw.data && typeof raw.data === "object") {
    const data = toRecord(raw.data);
    if (data.validation && typeof data.validation === "object") {
      return toRecord(data.validation);
    }

    return data;
  }

  if (raw.validation && typeof raw.validation === "object") {
    return toRecord(raw.validation);
  }

  return raw;
}

function normalizeIssue(
  value: unknown,
  index: number,
  fallbackSeverity: ValidationSeverity
): ValidationIssue | null {
  const raw = toRecord(value) as PlannerValidationIssuePayload;
  const title =
    raw.title?.trim() ||
    raw.name?.trim() ||
    raw.check?.trim() ||
    raw.category?.trim() ||
    `Validation Issue ${index + 1}`;
  const message =
    raw.message?.trim() ||
    raw.description?.trim() ||
    raw.summary?.trim() ||
    raw.detail?.trim() ||
    "Validation feedback was returned without extra detail.";
  const category = slugifyCategory(raw.category?.trim() || title);

  if (!title || !message) {
    return null;
  }

  return {
    category,
    severity: normalizeSeverity(raw.severity ?? raw.status, fallbackSeverity),
    title,
    message,
  };
}

function normalizeIssues(
  value: unknown,
  fallbackSeverity: ValidationSeverity
): ValidationIssue[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((issue, index) => normalizeIssue(issue, index, fallbackSeverity))
    .filter((issue): issue is ValidationIssue => issue !== null);
}

function extractSummaryIssues(
  raw: Record<string, unknown>,
  fallbackSeverity: ValidationSeverity
): ValidationIssue[] {
  const textCandidates = [
    raw.summary,
    raw.message,
    raw.feedback,
    raw.warnings,
    raw.messages,
    raw.details,
  ];
  const messages = textCandidates.flatMap(toStringArray);

  if (messages.length > 0) {
    return messages.map((message, index) => ({
      category: "validation",
      severity: fallbackSeverity,
      title: index === 0 ? "Backend Validation" : "Additional Validation Feedback",
      message,
    }));
  }

  const summaryText =
    typeof raw.summary === "string"
      ? raw.summary.trim()
      : typeof raw.message === "string"
      ? raw.message.trim()
      : "";

  if (!summaryText) {
    return [];
  }

  return [
    {
      category: "validation",
      severity: fallbackSeverity,
      title: "Backend Validation",
      message: summaryText,
    },
  ];
}

function normalizeValidationResult(payload: unknown): ValidationResult | null {
  const raw = extractResponseRoot(payload);
  const fallbackSeverity = normalizeSeverity(raw.overallStatus ?? raw.status, "pass");
  const issues = [
    ...normalizeIssues(raw.issues, fallbackSeverity),
    ...normalizeIssues(raw.checks, fallbackSeverity),
  ];

  if (issues.length > 0) {
    return buildValidationResult(issues);
  }

  const summaryIssues = extractSummaryIssues(raw, fallbackSeverity);
  if (summaryIssues.length > 0) {
    return buildValidationResult(summaryIssues);
  }

  if ("overallStatus" in raw || "status" in raw) {
    return buildValidationResult([
      {
        category: "validation",
        severity: fallbackSeverity,
        title: fallbackSeverity === "pass" ? "Validation Passed" : "Validation Feedback",
        message:
          fallbackSeverity === "pass"
            ? "Backend validation completed without reporting any issues."
            : "Backend validation completed.",
      },
    ]);
  }

  return null;
}

function extractYear(value: string): number | null {
  const match = value.match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function inferTerm(value: string, index: number): "S1" | "S2" {
  const normalized = value.trim().toLowerCase();

  if (
    /\bs1\b/.test(normalized) ||
    normalized.includes("semester 1") ||
    normalized.includes("spring")
  ) {
    return "S1";
  }

  if (
    /\bs2\b/.test(normalized) ||
    normalized.includes("semester 2") ||
    normalized.includes("fall") ||
    normalized.includes("autumn")
  ) {
    return "S2";
  }

  return index % 2 === 0 ? "S1" : "S2";
}

export function buildPlannerValidationRequest(input: {
  courseCode: string;
  plan: SemesterPlan[];
  completedUnits?: string[];
  selectedSpecialisations?: string[];
}): PlannerValidationRequest {
  const baseYear =
    extractYear(input.plan[0]?.name ?? "") ??
    new Date().getFullYear();

  return {
    courseCode: input.courseCode,
    completedUnits: input.completedUnits ?? [],
    selectedSpecialisations: input.selectedSpecialisations ?? [],
    plan: input.plan.map((semester, index) => ({
      sequence: index + 1,
      year: extractYear(semester.name) ?? baseYear + Math.floor(index / 2),
      term: inferTerm(semester.name, index),
      units: semester.units.map((unit) => unit.code),
    })),
  };
}

export async function validatePlannerPlan(
  request: PlannerValidationRequest,
  signal?: AbortSignal
): Promise<ValidationResult> {
  const response = await fetch(`${API_BASE_URL}/api/planner/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    signal,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, "Backend validation is unavailable right now."));
  }

  const normalizedResult = normalizeValidationResult(payload);

  if (!normalizedResult) {
    throw new Error("Planner validation returned an unexpected response.");
  }

  return normalizedResult;
}
