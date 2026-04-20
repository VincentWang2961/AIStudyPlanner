import OpenAI from 'openai';
import { buildPlannerPrompt } from './promptBuilder';
import { extractJsonFromModelOutput } from './responseParser';
import { getMockProgrammeCatalogue } from './mockCatalogue';
import { validateStudyPlanShape } from './planSchema';
import { GeneratePlanInput, StudyPlanResponse } from './types';

const DEFAULT_MODEL = 'gpt-5.4';
const MAX_ATTEMPTS = 2;

function getApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;

  if (!apiKey) {
    throw new Error('Missing OpenAI API key. Set OPENAI_API_KEY in your environment.');
  }

  return apiKey;
}

function createClient(): OpenAI {
  return new OpenAI({
    apiKey: getApiKey(),
  });
}

function getModelName(): string {
  return process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

async function requestPlanFromModel(prompt: string): Promise<string> {
  const client = createClient();

  const response = await client.chat.completions.create({
    model: getModelName(),
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  return response.choices[0]?.message?.content || '';
}

export async function generateStudyPlan(input: GeneratePlanInput): Promise<StudyPlanResponse> {
  const catalogue = getMockProgrammeCatalogue(input.programCode);

  if (!catalogue) {
    throw new Error(`No catalogue configured for programme ${input.programCode}`);
  }

  const prompt = buildPlannerPrompt(input.userMessage, catalogue);

  let lastErrorMessage = 'No response produced.';

  // Run at most twice: initial generation and one retry on invalid JSON/shape.
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const raw = await requestPlanFromModel(prompt);
      const jsonText = extractJsonFromModelOutput(raw);
      const parsed: unknown = JSON.parse(jsonText);

      if (!validateStudyPlanShape(parsed)) {
        throw new Error('Generated JSON does not match the expected study plan schema.');
      }

      return parsed;
    } catch (error) {
      lastErrorMessage = error instanceof Error ? error.message : 'Unknown generation error.';
    }
  }

  throw new Error(`Study plan generation failed after ${MAX_ATTEMPTS} attempts: ${lastErrorMessage}`);
}
