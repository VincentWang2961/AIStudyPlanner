export function checkPrerequisites(plan: any, unitMap: any): string[] {

  const completed = new Set<string>();
  const errors: string[] = [];

  for (const semester of plan.semesters) {

    for (const unitCode of semester.units) {

      const unit = unitMap[unitCode];

      if (!unit) continue;

      const prereqs = unit.prerequisites || [];

      for (const prereq of prereqs) {
        if (!completed.has(prereq)) {
          errors.push(
            `${unitCode} requires prerequisite ${prereq}`
          );
        }
      }
    }

    semester.units.forEach((u: string) => completed.add(u));
  }

  return errors;
}