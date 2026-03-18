export function generateStudyPlanPrompt(
  program: string,
  semesters: number,
  units: any[]
): string {

  return `
You are a university study planner.

Program: ${program}
Semesters: ${semesters}

Available units:
${JSON.stringify(units)}

Generate a study plan with units distributed across semesters.
Return the result as JSON.
`;
}

export function evaluatePlanPrompt(plan: any): string {
  return `
Evaluate this study plan and identify problems such as:

- prerequisite violations
- unavailable units
- overload

Study plan:
${JSON.stringify(plan)}

Respond in 1-3 paragraphs with suggestions.
`;
}