import { checkPrerequisites } from "../validation/prerequisiteChecker";
import { checkSemesterAvailability } from "../validation/semesterAvailability";
import { checkWorkload } from "../validation/workloadChecker";
import { askLLM } from "../llm/llmService";
import { evaluatePlanPrompt } from "../llm/prompts";

export async function evaluatePlan(plan: any, unitMap: any) {

  const errors: string[] = [];

  errors.push(...checkPrerequisites(plan, unitMap));
  errors.push(...checkSemesterAvailability(plan, unitMap));
  errors.push(...checkWorkload(plan));

  const aiFeedback = await askLLM(evaluatePlanPrompt(plan));

  return {
    errors,
    aiFeedback
  };
}