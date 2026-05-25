import { PlanUnit, SemesterPlan } from "@/lib/plannerData";

export type ValidationSeverity = "pass" | "warning" | "fail";
export type ValidationCategory = string;

export interface ValidationIssue {
  category: ValidationCategory;
  severity: ValidationSeverity;
  title: string;
  message: string;
}

export interface ValidationResult {
  overallStatus: ValidationSeverity;
  issues: ValidationIssue[];
  groupedByCategory: Record<string, ValidationIssue[]>;
}

const DEFAULT_VALIDATION_CATEGORIES = [
  "prerequisites",
  "corequisites",
  "availability",
  "workload",
  "coverage",
];

function getUnitSemesterIndex(plan: SemesterPlan[], code: string): number {
  return plan.findIndex((semester) => semester.units.some((unit) => unit.code === code));
}

function normalizeAvailabilityToken(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (!normalized) return "";
  if (normalized === "s1" || normalized.includes("semester 1") || normalized.includes("spring")) {
    return "s1";
  }
  if (normalized === "s2" || normalized.includes("semester 2") || normalized.includes("fall")) {
    return "s2";
  }
  if (normalized === "n-s" || normalized.includes("non-standard")) {
    return "n-s";
  }
  if (normalized === "n/a" || normalized.includes("unavailable") || normalized.includes("not offered")) {
    return "n/a";
  }

  return normalized;
}

function isUnitAvailableInSemester(unit: PlanUnit, semester: SemesterPlan): boolean {
  const availabilityTokens = unit.availability.map(normalizeAvailabilityToken).filter(Boolean);

  if (availabilityTokens.length === 0) {
    return true;
  }

  if (availabilityTokens.includes("n/a")) {
    return false;
  }

  const normalizedSemesterName = normalizeAvailabilityToken(semester.name);
  const semesterTokens = new Set<string>(
    normalizedSemesterName === "s1" || normalizedSemesterName === "s2"
      ? [normalizedSemesterName]
      : [semester.id % 2 === 1 ? "s1" : "s2"]
  );

  return availabilityTokens.some((token) => semesterTokens.has(token));
}

export function groupValidationIssues(issues: ValidationIssue[]): Record<string, ValidationIssue[]> {
  const grouped: Record<string, ValidationIssue[]> = Object.fromEntries(
    DEFAULT_VALIDATION_CATEGORIES.map((category) => [category, [] as ValidationIssue[]])
  );

  for (const issue of issues) {
    if (!grouped[issue.category]) {
      grouped[issue.category] = [];
    }

    grouped[issue.category].push(issue);
  }

  return grouped;
}

export function buildValidationResult(issues: ValidationIssue[]): ValidationResult {
  const groupedByCategory = groupValidationIssues(issues);
  const hasFail = issues.some((issue) => issue.severity === "fail");
  const hasWarning = issues.some((issue) => issue.severity === "warning");

  return {
    overallStatus: hasFail ? "fail" : hasWarning ? "warning" : "pass",
    issues,
    groupedByCategory,
  };
}

function makePasses(plan: SemesterPlan[]): ValidationIssue[] {
  const hasMath = plan.some((semester) => semester.units.some((unit) => unit.code.startsWith("MATH")));
  const workloadBalanced = plan.every((semester) => semester.units.length <= 4);

  return [
    {
      category: "prerequisites",
      severity: "pass",
      title: "Prerequisites Met",
      message: "The current draft satisfies the prerequisite chain for the visible units.",
    },
    {
      category: "corequisites",
      severity: "pass",
      title: "Corequisites Aligned",
      message: "Corequisite dependent units are placed in compatible study periods.",
    },
    {
      category: "availability",
      severity: "pass",
      title: "All Units Available",
      message: "Selected units are offered in the semesters where they are currently placed.",
    },
    {
      category: "workload",
      severity: workloadBalanced ? "pass" : "warning",
      title: workloadBalanced ? "Workload Balanced" : "Workload Needs Review",
      message: workloadBalanced
        ? "Semester workload looks balanced across the current plan."
        : "One or more semesters contain a heavier than recommended number of units.",
    },
    {
      category: "coverage",
      severity: hasMath ? "pass" : "warning",
      title: hasMath ? "Program Coverage Good" : "Math Foundation Needed",
      message: hasMath
        ? "The draft includes foundation units that support later technical study."
        : "Consider including mathematics units to strengthen the program foundation.",
    },
  ];
}

export function validatePlan(plan: SemesterPlan[], selectedUnitCodes: string[] = []): ValidationResult {
  if (plan.length === 0 || selectedUnitCodes.length === 0) {
    const emptyIssues = makePasses(plan).map((issue) =>
      issue.category === "coverage"
        ? { ...issue, severity: "warning" as const, title: "Plan Not Generated Yet", message: "Generate a draft plan to review rule checks and recommendations." }
        : { ...issue, severity: "pass" as const }
    );

    return {
      overallStatus: "warning",
      issues: emptyIssues,
      groupedByCategory: groupValidationIssues(emptyIssues),
    };
  }

  const issues: ValidationIssue[] = [];
  const selectedSet = new Set(selectedUnitCodes);
  const selectedUnits: PlanUnit[] = plan.flatMap((semester) => semester.units).filter((unit) => selectedSet.has(unit.code));

  for (const unit of selectedUnits) {
    for (const prereq of unit.prerequisites) {
      const prereqSemester = getUnitSemesterIndex(plan, prereq);
      const unitSemester = getUnitSemesterIndex(plan, unit.code);
      if (prereqSemester === -1 || prereqSemester >= unitSemester) {
        issues.push({
          category: "prerequisites",
          severity: "fail",
          title: "Prerequisite Sequence Issue",
          message: `${unit.code} should appear after ${prereq}.`,
        });
      }
    }

    for (const coreq of unit.corequisites) {
      const coreqSemester = getUnitSemesterIndex(plan, coreq);
      const unitSemester = getUnitSemesterIndex(plan, unit.code);
      if (coreqSemester !== -1 && coreqSemester !== unitSemester) {
        issues.push({
          category: "corequisites",
          severity: "warning",
          title: "Corequisite Alignment Warning",
          message: `${unit.code} is ideally taken with ${coreq} in the same semester.`,
        });
      }
    }

    const semester = plan.find((entry) => entry.units.some((candidate) => candidate.code === unit.code));
    if (semester && !isUnitAvailableInSemester(unit, semester)) {
      issues.push({
        category: "availability",
        severity: "warning",
        title: "Availability Warning",
        message: `${unit.code} is not normally offered in ${semester.name}.`,
      });
    }
  }

  for (const semester of plan) {
    if (semester.units.length > 4) {
      issues.push({
        category: "workload",
        severity: "warning",
        title: "Heavy Semester Load",
        message: `${semester.name} contains ${semester.units.length} units. Consider redistributing workload.`,
      });
    }
  }

  const hasMath = selectedUnits.some((unit) => unit.code.startsWith("MATH"));
  if (!hasMath) {
    issues.push({
      category: "coverage",
      severity: "warning",
      title: "Math Foundation Needed",
      message: "Consider including mathematics units for a stronger technical foundation.",
    });
  }

  const passIssues = makePasses(plan).filter((passIssue) =>
    !issues.some((issue) => issue.category === passIssue.category)
  );

  const allIssues = [...issues, ...passIssues];
  return buildValidationResult(allIssues);
}
