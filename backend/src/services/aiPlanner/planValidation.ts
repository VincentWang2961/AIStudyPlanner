import { GeneratePlanInput, PlanSemester, ProgramCatalogue, StudyPlanResponse } from './types';

export type PlannerValidationIssue = {
  code: string;
  message: string;
};

function targetUnitCount(catalogue: ProgramCatalogue): number {
  return Math.ceil(catalogue.totalCreditPoints / 6);
}

function mentionedUnitCodes(message: string): string[] {
  return Array.from(new Set(message.match(/\b[A-Z]{4}\d{4}\b/g) ?? []));
}

function semesterContainsAvailability(label: string, availability: string[]): boolean {
  if (availability.includes('N/A')) {
    return true;
  }

  const normalisedLabel = label.toUpperCase();
  return availability.some((item) => normalisedLabel.includes(item.toUpperCase()));
}

function getSemesterUnitCodes(semester: PlanSemester): string[] {
  return semester.units.map((unit) => unit.code);
}

export function validatePlannerRequest(input: GeneratePlanInput, catalogue: ProgramCatalogue): PlannerValidationIssue[] {
  const issues: PlannerValidationIssue[] = [];
  const unitMap = new Map(catalogue.units.map((unit) => [unit.code, unit]));
  const requestedSemesters = input.requestedSemesters;
  const requestedUnitsPerSemester = input.requestedUnitsPerSemester;

  if (requestedSemesters !== undefined && (!Number.isInteger(requestedSemesters) || requestedSemesters < 1 || requestedSemesters > 8)) {
    issues.push({
      code: 'SEMESTER_RANGE',
      message: 'The requested number of semesters must be between 1 and 8.',
    });
  }

  if (requestedUnitsPerSemester !== undefined && (!Number.isInteger(requestedUnitsPerSemester) || requestedUnitsPerSemester < 1 || requestedUnitsPerSemester > 4)) {
    issues.push({
      code: 'SEMESTER_LOAD',
      message: 'The planner supports 1 to 4 units per semester.',
    });
  }

  if (requestedSemesters && requestedUnitsPerSemester) {
    const requestedSlots = requestedSemesters * requestedUnitsPerSemester;
    const expectedUnits = targetUnitCount(catalogue);

    if (requestedSlots > expectedUnits + 4) {
      issues.push({
        code: 'EXCESSIVE_PLAN_SIZE',
        message: `The requested plan has ${requestedSlots} unit slots, which is not reasonable for a ${catalogue.totalCreditPoints}-point programme.`,
      });
    }
  }

  const mentionedCodes = mentionedUnitCodes(input.userMessage);
  const unknownCodes = mentionedCodes.filter((code) => !unitMap.has(code));

  for (const code of unknownCodes) {
    issues.push({
      code: 'UNKNOWN_UNIT',
      message: `${code} is not available in ${catalogue.programName}.`,
    });
  }

  for (const code of mentionedCodes) {
    const unit = unitMap.get(code);
    if (!unit) continue;

    for (const incompatibleCode of unit.incompatibilities) {
      if (mentionedCodes.includes(incompatibleCode)) {
        issues.push({
          code: 'INCOMPATIBLE_REQUEST',
          message: `${code} cannot be planned with ${incompatibleCode}.`,
        });
      }
    }
  }

  return issues;
}

export function validateGeneratedStudyPlan(
  plan: StudyPlanResponse,
  catalogue: ProgramCatalogue,
  input: GeneratePlanInput
): PlannerValidationIssue[] {
  const issues: PlannerValidationIssue[] = [];
  const unitMap = new Map(catalogue.units.map((unit) => [unit.code, unit]));
  const plannedCodes = plan.plan.semesters.flatMap(getSemesterUnitCodes);
  const plannedSet = new Set(plannedCodes);
  const seen = new Set<string>();
  const maxUnitsPerSemester = input.requestedUnitsPerSemester ?? catalogue.defaultUnitsPerSemester;

  if (plan.plan.programCode !== catalogue.programCode) {
    issues.push({
      code: 'PROGRAM_MISMATCH',
      message: `The generated plan is for ${plan.plan.programCode}, not ${catalogue.programCode}.`,
    });
  }

  for (const semester of plan.plan.semesters) {
    if (semester.units.length > maxUnitsPerSemester) {
      issues.push({
        code: 'SEMESTER_LOAD',
        message: `${semester.label} contains ${semester.units.length} units; the limit is ${maxUnitsPerSemester}.`,
      });
    }

    for (const selectedUnit of semester.units) {
      const catalogueUnit = unitMap.get(selectedUnit.code);

      if (!catalogueUnit) {
        issues.push({
          code: 'UNKNOWN_UNIT',
          message: `${selectedUnit.code} is not in the programme catalogue.`,
        });
        continue;
      }

      if (seen.has(selectedUnit.code)) {
        issues.push({
          code: 'DUPLICATE_UNIT',
          message: `${selectedUnit.code} appears more than once.`,
        });
      }
      seen.add(selectedUnit.code);

      if (!semesterContainsAvailability(semester.label, catalogueUnit.availability)) {
        issues.push({
          code: 'AVAILABILITY',
          message: `${selectedUnit.code} is not normally offered in ${semester.label}.`,
        });
      }
    }
  }

  const semesterIndexByCode = new Map<string, number>();
  plan.plan.semesters.forEach((semester, index) => {
    semester.units.forEach((unit) => semesterIndexByCode.set(unit.code, index));
  });

  for (const code of plannedCodes) {
    const catalogueUnit = unitMap.get(code);
    if (!catalogueUnit) continue;

    for (const prerequisite of catalogueUnit.prerequisites) {
      const prerequisiteSemester = semesterIndexByCode.get(prerequisite);
      const unitSemester = semesterIndexByCode.get(code);

      if (prerequisiteSemester === undefined || unitSemester === undefined || prerequisiteSemester >= unitSemester) {
        issues.push({
          code: 'PREREQUISITE',
          message: `${code} requires ${prerequisite} to be completed in an earlier semester.`,
        });
      }
    }

    for (const incompatibleCode of catalogueUnit.incompatibilities) {
      if (plannedSet.has(incompatibleCode)) {
        issues.push({
          code: 'INCOMPATIBLE_UNITS',
          message: `${code} cannot be included with ${incompatibleCode}.`,
        });
      }
    }
  }

  const calculatedCredits = plannedCodes.reduce((sum, code) => sum + (unitMap.get(code)?.creditPoints ?? 0), 0);
  if (calculatedCredits > catalogue.totalCreditPoints) {
    issues.push({
      code: 'CREDIT_TOTAL',
      message: `The generated plan has ${calculatedCredits} credit points, exceeding the programme target of ${catalogue.totalCreditPoints}.`,
    });
  }

  if (plan.plan.summary.totalCreditPoints !== calculatedCredits) {
    issues.push({
      code: 'SUMMARY_MISMATCH',
      message: 'The generated summary does not match the units in the plan.',
    });
  }

  return issues;
}

export function assertNoValidationIssues(issues: PlannerValidationIssue[], status = 400): void {
  if (issues.length === 0) {
    return;
  }

  throw Object.assign(new Error(issues.map((issue) => issue.message).join(' ')), {
    status,
    issues,
  });
}
