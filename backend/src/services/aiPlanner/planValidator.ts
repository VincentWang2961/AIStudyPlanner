/**
 * Plan Validator for AI-Generated Plans
 *
 * This module bridges the AI planner output with the validation engine.
 * After AI generates a study plan, we run validation server-side before
 * returning to the frontend. This enforces the AI → Validation → Frontend
 * architecture.
 *
 * Validation checks include:
 * - Prerequisites compliance
 * - Unit availability
 * - Semester load limits
 * - Duplicate units
 * - Incompatibilities
 * - Corequisites
 * - Course-specific rules
 * - Group/points requirements
 */

import { StudyPlanResponse, ValidationResult } from './types';
import { validatePlan, PlannedTerm } from '../validation/planValidationService';

/**
 * Convert an AI-generated StudyPlanResponse into the format expected by
 * the validation engine (PlannedTerm[]).
 */
function convertPlanToValidateInput(plan: StudyPlanResponse): PlannedTerm[] {
  return plan.plan.semesters.map((semester) => {
    // Parse label like "S1 2026" into year and term
    const labelMatch = semester.label.match(/(S[12])\s*(\d{4})/i);
    let year = 2026;
    let term: 'S1' | 'S2' = 'S1';

    if (labelMatch) {
      term = labelMatch[1].toUpperCase() as 'S1' | 'S2';
      year = parseInt(labelMatch[2], 10);
    }

    return {
      sequence: semester.sequence,
      year,
      term,
      units: semester.units.map((u) => u.code),
    };
  });
}

/**
 * Detect if a plan uses generic/unrecognised unit codes that were clearly
 * hallucinated by the AI rather than sourced from the catalogue.
 *
 * UWA unit codes follow the pattern: 4 letters + 4 digits (e.g. CITS4009).
 * The primary validity check is whether the unit exists in the catalogue —
 * this is handled by the validation engine. Here we only flag codes that
 * clearly don't match ANY known UWA code pattern.
 */
function detectHallucinatedUnits(plan: StudyPlanResponse): string[] {
  const hallucinated: string[] = [];

  for (const semester of plan.plan.semesters) {
    for (const unit of semester.units) {
      // UWA unit codes are always 4 alphabetic characters + 4 digits
      // This regex catches clearly invalid patterns (e.g. "ABC123", "UNIT1", "CODE-X", "CITS100")
      if (!/^[A-Z]{4}\d{4}$/.test(unit.code.toUpperCase())) {
        hallucinated.push(unit.code);
      }
    }
  }

  return hallucinated;
}

/**
 * Validate an AI-generated study plan, converting its structure to the
 * format expected by the validation engine, then running all checks.
 */
export async function validateAiGeneratedPlan(
  plan: StudyPlanResponse,
  courseCode: string,
  completedUnits: string[],
  specialisation?: string,
): Promise<ValidationResult> {
  const plannedTerms = convertPlanToValidateInput(plan);
  const selectedSpecialisations = specialisation ? [specialisation] : [];

  let validationResult: ValidationResult;

  try {
    validationResult = await validatePlan({
      courseCode,
      completedUnits,
      selectedSpecialisations,
      plan: plannedTerms,
    });
  } catch (err) {
    console.warn('[planValidator] Validation engine error:', err);
    // If validation fails completely, return a warning-level result
    return {
      overallStatus: 'warning',
      issues: [
        {
          category: 'validation-system',
          severity: 'warning',
          title: 'Validation service unavailable',
          message: 'The validation service encountered an error. The plan may still be valid but should be reviewed manually.',
        },
      ],
    };
  }

  // Add AI-specific checks
  const hallucinatedUnits = detectHallucinatedUnits(plan);

  for (const code of hallucinatedUnits) {
    validationResult.issues.push({
      category: 'ai-quality',
      severity: 'fail',
      title: 'Unrecognised unit code',
      message: `${code} is not a valid UWA unit code and may have been hallucinated by the AI. Please verify this unit on the UWA Handbook.`,
    });
  }

  // Recalculate overall status
  if (hallucinatedUnits.length > 0) {
    validationResult.overallStatus = 'fail';
  }

  return validationResult;
}
