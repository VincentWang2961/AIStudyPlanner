import OpenAI from 'openai';
import { buildPlannerPrompt } from './promptBuilder';
import { extractJsonFromModelOutput } from './responseParser';
import { getMockProgrammeCatalogue } from './mockCatalogue';
import { getProgrammeCatalogueFromDb } from './databaseCatalogue';
import { validateStudyPlanShape } from './planSchema';
import { EnhanceCatalogueWithSequenceData } from './sequenceEnricher';
import { GeneratePlanInput, StudyPlanResponse } from './types';

const DEFAULT_MODEL = 'gpt-4o';
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1000;

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
    timeout: 60_000,
    maxRetries: 2,
  });
}

function getModelName(): string {
  return process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestPlanFromModel(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const client = createClient();

  const response = await client.chat.completions.create({
    model: getModelName(),
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
    max_tokens: 8192,
  });

  return response.choices[0]?.message?.content || '';
}

export async function generateStudyPlan(input: GeneratePlanInput): Promise<StudyPlanResponse> {
  let catalogue = await getProgrammeCatalogueFromDb(input.programCode)
    ?? getMockProgrammeCatalogue(input.programCode);

  if (!catalogue) {
    throw new Error(`No catalogue configured for programme ${input.programCode}`);
  }

  // Enrich catalogue with sequence data from the database/excel if available
  catalogue = await EnhanceCatalogueWithSequenceData(catalogue);

  // Build a rich user message that includes all context
  const userMessage = buildRichUserMessage(input);

  const { system, user } = buildPlannerPrompt(userMessage, catalogue);

  let lastErrorMessage = 'No response produced.';
  const startTime = Date.now();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const raw = await requestPlanFromModel(system, user);
      const jsonText = extractJsonFromModelOutput(raw);
      const parsed: unknown = JSON.parse(jsonText);

      if (!validateStudyPlanShape(parsed)) {
        throw new Error('Generated JSON does not match the expected study plan schema.');
      }

      const response = parsed as StudyPlanResponse;

      // Enhance with metadata
      response.generatedAt = new Date().toISOString();

      return response;
    } catch (error) {
      lastErrorMessage = error instanceof Error ? error.message : 'Unknown generation error.';
      console.warn(`[aiPlanner] Attempt ${attempt} failed: ${lastErrorMessage}`);

      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  throw new Error(
    `Study plan generation failed after ${MAX_ATTEMPTS} attempts (${elapsed}s): ${lastErrorMessage}`,
  );
}

function buildRichUserMessage(input: GeneratePlanInput): string {
  const lines: string[] = [];

  lines.push(`Create a study plan for ${input.programCode}.`);

  if (input.specialisation) {
    lines.push(`Focus area / specialisation: ${input.specialisation}.`);
  }

  if (input.preferredSemesterCount) {
    lines.push(`Preferred semester count: ${input.preferredSemesterCount}.`);
  }

  if (input.unitsPerSemester) {
    lines.push(`Preferred units per semester: ${input.unitsPerSemester}.`);
  }

  if (input.completedUnits && input.completedUnits.length > 0) {
    lines.push(`Already completed units: ${input.completedUnits.join(', ')}. These should be excluded from the plan.`);
  }

  if (input.preferences) {
    lines.push(`Student preferences: ${input.preferences}`);
  }

  if (input.userMessage && input.userMessage !== lines.join(' ')) {
    lines.push(`Additional context: ${input.userMessage}`);
  }

  return lines.join('\n');
}
