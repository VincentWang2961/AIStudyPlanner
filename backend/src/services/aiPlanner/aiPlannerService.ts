import OpenAI from 'openai';
import { buildPlannerPrompt } from './promptBuilder';
import { extractJsonFromModelOutput } from './responseParser';
import { getMockProgrammeCatalogue } from './mockCatalogue';
import { getProgrammeCatalogueFromDb } from './databaseCatalogue';
import { validateStudyPlanShape } from './planSchema';
import { EnhanceCatalogueWithSequenceData } from './sequenceEnricher';
import { detectAbuse } from './abuseDetector';
import { checkRateLimit, recordTokenUsage, getDailyTokenLimit } from './tokenTracker';
import { getFallbackPlan } from './fallbackPlans';
import { validateAiGeneratedPlan } from './planValidator';
import {
  GeneratePlanInput,
  StudyPlanResponse,
  GeneratePlanResult,
} from './types';

const DEFAULT_MODEL = 'gpt-4o';
const MAX_AI_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// ─── OpenAI Client ──────────────────────────────────────────────────────────

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
    timeout: 90_000,
    maxRetries: 1,
  });
}

function getModelName(): string {
  return process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── AI Plan Request (returns raw completion for token tracking) ────────────

async function requestPlanFromModel(
  systemPrompt: string,
  userPrompt: string,
): Promise<{ content: string; tokensUsed: number }> {
  const client = createClient();

  const response = await client.chat.completions.create({
    model: getModelName(),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
    max_tokens: 8192,
  });

  const content = response.choices[0]?.message?.content || '';
  const tokensUsed = response.usage?.total_tokens ?? 0;

  return { content, tokensUsed };
}

// ─── Rich User Message Builder ──────────────────────────────────────────────

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

// ─── Main Generation Pipeline ───────────────────────────────────────────────

export async function generateStudyPlan(input: GeneratePlanInput): Promise<GeneratePlanResult> {
  const startTime = Date.now();

  // ── Step 1: Abuse Detection ──────────────────────────────────────────
  const abuseResult = detectAbuse(input.userMessage);
  if (abuseResult.isAbuse) {
    throw Object.assign(
      new Error(`Request rejected: ${abuseResult.reason}`),
      { status: 400, category: abuseResult.category },
    );
  }

  // ── Step 2: Rate Limiting ────────────────────────────────────────────
  const estimatedInputTokens = Math.ceil(input.userMessage.length / 4); // rough estimate
  const estimatedOutputTokens = 4000; // conservative estimate
  const estimatedTotal = estimatedInputTokens + estimatedOutputTokens; // prompt tokens are extra

  const rateCheck = await checkRateLimit(estimatedTotal + 4000); // add ~4k for system prompt
  if (!rateCheck.allowed) {
    // If rate-limited, try fallback
    const fallback = getFallbackPlan(input.programCode, input.specialisation);
    if (fallback) {
      return {
        plan: fallback,
        validation: {
          overallStatus: 'warning',
          issues: [{
            category: 'rate-limit',
            severity: 'warning',
            title: 'Daily limit reached — fallback plan provided',
            message: `${rateCheck.reason} A pre-generated plan is provided instead. This is NOT an AI-generated plan — please review it carefully.`,
          }],
        },
        metadata: {
          source: 'fallback',
          tokensUsed: 0,
          dailyTokensRemaining: rateCheck.dailyTokensRemaining,
          generationTimeMs: Date.now() - startTime,
        },
      };
    }

    throw Object.assign(
      new Error(`Rate limit exceeded: ${rateCheck.reason}`),
      { status: 429 },
    );
  }

  // ── Step 3: Load Catalogue ───────────────────────────────────────────
  let catalogue = await getProgrammeCatalogueFromDb(input.programCode)
    ?? getMockProgrammeCatalogue(input.programCode);

  if (!catalogue) {
    // No catalogue at all — use fallback if available
    const fallback = getFallbackPlan(input.programCode, input.specialisation);
    if (fallback) {
      return {
        plan: fallback,
        validation: {
          overallStatus: 'warning',
          issues: [{
            category: 'catalogue',
            severity: 'warning',
            title: 'Programme catalogue unavailable — fallback plan provided',
            message: `No course catalogue data available for ${input.programCode}. A pre-generated plan is provided instead.`,
          }],
        },
        metadata: {
          source: 'fallback',
          tokensUsed: 0,
          dailyTokensRemaining: rateCheck.dailyTokensRemaining,
          generationTimeMs: Date.now() - startTime,
        },
      };
    }

    throw new Error(`No catalogue configured for programme ${input.programCode}`);
  }

  // Enrich catalogue with sequence data
  catalogue = await EnhanceCatalogueWithSequenceData(catalogue);

  // ── Step 4: Build Prompt & Call AI ───────────────────────────────────
  const userMessage = buildRichUserMessage(input);
  const { system, user } = buildPlannerPrompt(userMessage, catalogue);

  let lastErrorMessage = 'No response produced.';
  let totalTokensUsed = 0;
  let catalogueViolationUnits: string[] = [];

  for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt += 1) {
    try {
      let currentSystem = system;
      let currentUser = user;

      // On retry, add explicit warning about previously hallucinated units
      if (catalogueViolationUnits.length > 0) {
        const bannedList = catalogueViolationUnits.join(', ');
        currentUser = `PREVIOUS ATTEMPT FAILED: You included units not in the catalogue (${bannedList}). These are NOT available for this programme. Use ONLY codes from the "Available Units" list below.\n\n` + currentUser;
      }

      const { content: raw, tokensUsed } = await requestPlanFromModel(currentSystem, currentUser);
      totalTokensUsed += tokensUsed;

      const jsonText = extractJsonFromModelOutput(raw);
      const parsed: unknown = JSON.parse(jsonText);

      if (!validateStudyPlanShape(parsed)) {
        throw new Error('Generated JSON does not match the expected study plan schema.');
      }

      const aiPlan = parsed as StudyPlanResponse;
      aiPlan.generatedAt = new Date().toISOString();

      // Record token usage
      await recordTokenUsage(totalTokensUsed);

      // ── Step 5: Validate the AI-Generated Plan (Server-Side) ──────────
      const validation = await validateAiGeneratedPlan(
        aiPlan,
        input.programCode,
        input.completedUnits || [],
        input.specialisation,
      );

      // Check for catalogue violations (non-catalogue units) and retry if possible
      catalogueViolationUnits = validation.issues
        .filter(i => i.severity === 'fail' && (i.category === 'unit-membership' || i.category === 'ai-quality'))
        .map(i => {
          const match = i.message.match(/\b([A-Z]{2,5}\d{3,5})\b/);
          return match ? match[1] : null;
        })
        .filter((c): c is string => c !== null);

      if (catalogueViolationUnits.length > 0 && attempt < MAX_AI_ATTEMPTS) {
        console.warn(`[aiPlanner] Attempt ${attempt} had ${catalogueViolationUnits.length} catalogue violations: ${catalogueViolationUnits.join(', ')}. Retrying...`);
        throw new Error(`Catalogue violation: ${catalogueViolationUnits.join(', ')}`);
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `[aiPlanner] Plan generated and validated in ${elapsed}s (${totalTokensUsed} tokens, status: ${validation.overallStatus})`,
      );

      return {
        plan: aiPlan,
        validation,
        metadata: {
          source: 'ai',
          tokensUsed: totalTokensUsed,
          dailyTokensRemaining: rateCheck.dailyTokensRemaining - totalTokensUsed,
          generationTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      lastErrorMessage = error instanceof Error ? error.message : 'Unknown generation error.';
      console.warn(`[aiPlanner] Attempt ${attempt} failed: ${lastErrorMessage}`);

      if (attempt < MAX_AI_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  // ── Step 6: AI Failed — Use Fallback Plan ────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.warn(`[aiPlanner] AI generation failed after ${MAX_AI_ATTEMPTS} attempts (${elapsed}s). Falling back to pre-generated plan.`);

  const fallback = getFallbackPlan(input.programCode, input.specialisation);
  if (fallback) {
    return {
      plan: fallback,
      validation: {
        overallStatus: 'warning',
        issues: [{
          category: 'ai-failure',
          severity: 'warning',
          title: 'AI generation failed — fallback plan provided',
          message: `AI plan generation failed after ${MAX_AI_ATTEMPTS} attempts: ${lastErrorMessage}. A pre-generated plan is provided instead. This is NOT an AI-generated plan — please review it carefully.`,
        }],
      },
      metadata: {
        source: 'fallback',
        tokensUsed: totalTokensUsed,
        dailyTokensRemaining: rateCheck.dailyTokensRemaining,
        generationTimeMs: Date.now() - startTime,
      },
    };
  }

  throw new Error(
    `Study plan generation failed after ${MAX_AI_ATTEMPTS} attempts (${elapsed}s): ${lastErrorMessage}. No fallback plan is available for ${input.programCode}.`,
  );
}

// ─── Exports for Testing ────────────────────────────────────────────────────

export { getDailyTokenLimit, detectAbuse };
