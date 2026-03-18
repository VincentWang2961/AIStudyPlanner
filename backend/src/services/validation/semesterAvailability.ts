export function checkSemesterAvailability(plan: any, unitMap: any): string[] {

  const errors: string[] = [];

  for (const semester of plan.semesters) {

    for (const unitCode of semester.units) {

      const unit = unitMap[unitCode];

      if (!unit) continue;

      if (!unit.offeredIn.includes(semester.semester)) {
        errors.push(
          `${unitCode} is not offered in semester ${semester.semester}`
        );
      }
    }
  }

  return errors;
}