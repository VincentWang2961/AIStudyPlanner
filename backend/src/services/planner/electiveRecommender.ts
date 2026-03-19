import { askLLM } from "../llm/llmService";

export async function recommendElectives(
  interests: string[],
  units: any[]
) {

  const prompt = `
A student is interested in:

${interests.join(", ")}

Available units:
${JSON.stringify(units)}

Recommend 3 electives based on the descriptions.
Return unit codes only.
`;

  const response = await askLLM(prompt);

  return response;
}