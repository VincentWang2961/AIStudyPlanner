import { askLLM } from "../llm/llmService";
import { generateStudyPlanPrompt } from "../llm/prompts";

export async function generatePlan(
  program: string,
  semesters: number,
  units: any[]
) {

  const prompt = generateStudyPlanPrompt(program, semesters, units);

  const response = await askLLM(prompt);

  try {
    return JSON.parse(response);
  } catch {
    throw new Error("LLM returned invalid JSON");
  }
}