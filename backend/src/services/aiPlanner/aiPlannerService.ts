import OpenAI from 'openai';
import { buildPlannerPrompt } from './promptBuilder';
import { extractJsonFromModelOutput } from './responseParser';
import { getMockProgrammeCatalogue } from './mockCatalogue';
import { getProgrammeCatalogueFromDb } from './databaseCatalogue';
import { validateStudyPlanShape } from './planSchema';
import {
  assertDailyTokenBudget,
  buildUsageKey,
  estimateTokenCount,
  recordTokenUsage,
} from './tokenUsageService';
import { GeneratePlanInput, StudyPlanResponse } from './types';

const DEFAULT_MODEL = 'gpt-5.4';
const MAX_ATTEMPTS = 2;
const MAX_COMPLETION_TOKENS = 3000;

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

async function requestPlanFromModel(prompt: string): Promise<{ content: string; tokensUsed: number }> {
  const client = createClient();

  const response = await client.chat.completions.create({
    model: getModelName(),
    max_completion_tokens: MAX_COMPLETION_TOKENS,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  return {
    content: response.choices[0]?.message?.content || '',
    tokensUsed: response.usage?.total_tokens ?? 0,
  };
}

export async function generateStudyPlan(input: GeneratePlanInput): Promise<StudyPlanResponse> {
  const catalogue = await getProgrammeCatalogueFromDb(input.programCode)
    ?? getMockProgrammeCatalogue(input.programCode);

  if (!catalogue) {
    throw new Error(`No catalogue configured for programme ${input.programCode}`);
  }

  const prompt = buildPlannerPrompt(input.userMessage, catalogue);
  const usageKey = input.usageKey ?? buildUsageKey([input.programCode, input.userMessage]);
  const estimatedRequestTokens = estimateTokenCount(prompt) + MAX_COMPLETION_TOKENS;

  await assertDailyTokenBudget(usageKey, estimatedRequestTokens);

  let lastErrorMessage = 'No response produced.';

  // Run at most twice: initial generation and one retry on invalid JSON/shape.
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await assertDailyTokenBudget(usageKey, estimatedRequestTokens);

      const { content: raw, tokensUsed } = await requestPlanFromModel(prompt);
      await recordTokenUsage(usageKey, tokensUsed || estimatedRequestTokens);

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
