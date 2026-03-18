const MAX_UNITS = 4;

export function checkWorkload(plan: any): string[] {

  const errors: string[] = [];

  for (const semester of plan.semesters) {

    if (semester.units.length > MAX_UNITS) {

      errors.push(
        `Semester ${semester.semester} exceeds maximum workload`
      );
    }
  }

  return errors;
}