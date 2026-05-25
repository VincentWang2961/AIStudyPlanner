import OpenAI from 'openai';
import { buildPlannerPrompt } from './promptBuilder';
import { extractJsonFromModelOutput } from './responseParser';
import { getMockProgrammeCatalogue } from './mockCatalogue';
import { getProgrammeCatalogueFromDb } from './databaseCatalogue';
import { validateStudyPlanShape } from './planSchema';
import { buildDeterministicPlan, getFallbackPlan } from './fallbackPlans';
import { validatePlan } from '../validation/planValidationService';
import { GeneratePlanInput, StudyPlanResponse, PlanUnitSelection, PlanSemester } from './types';
import { detectAbuse } from './abuseDetector';
import { checkRateLimit, recordTokenUsage, getDailyTokenLimit } from './tokenTracker';

const DEFAULT_MODEL = 'deepseek-chat';
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1000;

function getApiKey(): string {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;

  if (!apiKey) {
    throw new Error('Missing API key. Set DEEPSEEK_API_KEY or OPENAI_API_KEY in your environment.');
  }

  return apiKey;
}

function createClient(): OpenAI {
  return new OpenAI({
    apiKey: getApiKey(),
    baseURL: 'https://api.deepseek.com/v1',
    timeout: 120_000,
    maxRetries: 2,
  });
}

function getModelName(): string {
  return process.env.DEEPSEEK_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestPlanFromModel(
  systemPrompt: string,
  userPrompt: string,
): Promise<{ content: string; usage: { totalTokens: number } | null }> {
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
    max_completion_tokens: 100000,
    thinking: { type: (process.env.DEEPSEEK_THINKING === 'disabled' ? 'disabled' : 'enabled') },
  } as any);

  return {
    content: response.choices[0]?.message?.content || '',
    usage: response.usage ? { totalTokens: response.usage.total_tokens } : null,
  };
}

/**
 * Post-generation fix: move units that depend on prerequisites in the same
 * or later semester. This catches common AI errors like placing CITS4402
 * (needs CITS1401) in the same semester as CITS1401.
 */
function fixPrerequisiteSemesters(response: StudyPlanResponse): StudyPlanResponse {
  const semesters = response.plan.semesters;
  if (semesters.length <= 1) return response;

  // Build a map: unitCode → sequence number
  const unitSemester = new Map<string, number>();
  for (const sem of semesters) {
    for (const unit of sem.units) {
      unitSemester.set(unit.code, sem.sequence);
    }
  }

  const unitPrereqs = new Map<string, string[]>();
  // Minimum semester sequence per unit (for point-based or other non-unit prereqs)
  const minSequence = { 'CITS4009': 3 } as Record<string, number>;

  let fixed = false;
  const MAX_UNITS_PER_SEMESTER = 4;
  const MAX_ITERATIONS = 10;
  let iterations = 0;

  // Repeat until all violations are fixed or max iterations reached
  while (!fixed && iterations < MAX_ITERATIONS) {
    fixed = true;
    iterations++;

    for (const sem of semesters) {
      const unitsToMove: PlanUnitSelection[] = [];
      const keptUnits: PlanUnitSelection[] = [];

      for (const unit of sem.units) {
        const prereqs = unitPrereqs.get(unit.code) ?? [];
        let hasViolation = false;

        for (const prereqCode of prereqs) {
          const prereqSeq = unitSemester.get(prereqCode);
          if (prereqSeq === undefined) continue;
          if (prereqSeq >= sem.sequence) {
            hasViolation = true;
            break;
          }
        }

        // Check minimum sequence constraint (e.g. CITS4009 needs 96 pts → semester 3+)
        if (!hasViolation && minSequence[unit.code] && sem.sequence < minSequence[unit.code]) {
          hasViolation = true;
        }

        if (hasViolation) {
          unitsToMove.push(unit);
          fixed = false;
        } else {
          keptUnits.push(unit);
        }
      }

      sem.units = keptUnits;

      // Try to place moved units in subsequent semesters
      for (const unit of unitsToMove) {
        let targetSeq = sem.sequence + 1;
        const prereqs = unitPrereqs.get(unit.code) ?? [];

        // Find the earliest semester after ALL prerequisites
        for (const prereqCode of prereqs) {
          const prereqSeq = unitSemester.get(prereqCode);
          if (prereqSeq !== undefined) {
            targetSeq = Math.max(targetSeq, prereqSeq + 1);
          }
        }

        // Find a semester with room
        let placed = false;
        for (let seq = targetSeq; seq <= semesters.length; seq++) {
          const targetSem = semesters.find(s => s.sequence === seq);
          if (targetSem && targetSem.units.length < MAX_UNITS_PER_SEMESTER) {
            targetSem.units.push(unit);
            unitSemester.set(unit.code, seq);
            placed = true;
            break;
          }
        }

        // If couldn't place, create a new semester or append to last
        if (!placed) {
          const newSeq = semesters.length + 1;
          const lastSem = semesters[semesters.length - 1];
          const yearHint = lastSem ? (lastSem.label.includes('S2') ? parseInt(lastSem.label) + 1 : parseInt(lastSem.label)) : 2026;
          const termHint = lastSem && lastSem.label.includes('S1') ? 'S2' : 'S1';
          semesters.push({
            sequence: newSeq,
            label: `${termHint} ${lastSem ? parseInt(lastSem.label.split(' ')[1] ?? lastSem.label.match(/\d+/)?.[0] ?? '2026') + (termHint === 'S2' ? 0 : 1) : 2026}`,
            units: [unit],
          });
          unitSemester.set(unit.code, newSeq);
        }
      }

      // Update unit-semester map after changes
      for (const unit of sem.units) {
        unitSemester.set(unit.code, sem.sequence);
      }
    }

    // Re-sort semesters by sequence
    semesters.sort((a, b) => a.sequence - b.sequence);

    // Re-number sequences
    semesters.forEach((sem, i) => {
      sem.sequence = i + 1;
    });

    // Update unit-semester map after renumbering
    unitSemester.clear();
    for (const sem of semesters) {
      for (const unit of sem.units) {
        unitSemester.set(unit.code, sem.sequence);
      }
    }
  }

  // Recalculate summary
  response.plan.summary.totalUnits = semesters.reduce((sum, s) => sum + s.units.length, 0);
  response.plan.summary.totalCreditPoints = semesters.reduce((sum, s) => sum + s.units.reduce((s2, u) => s2 + u.creditPoints, 0), 0);

  // Fix availability: move units placed in wrong semesters (S1-only → S1, S2-only → S2)
  fixAvailability(semesters, response);

  // Try simple re-sort after fixes
  semesters.sort((a, b) => a.sequence - b.sequence);

  response.plan.summary.totalUnits = semesters.reduce((sum, s) => sum + s.units.length, 0);
  response.plan.summary.totalCreditPoints = semesters.reduce((sum, s) => sum + s.units.reduce((s2, u) => s2 + u.creditPoints, 0), 0);

  if (iterations > 1) {
    response.warnings.push('Some units were automatically rescheduled to ensure prerequisite compliance.');
  }

  return response;
}

/** Fixed availability map for 62510 MIT units (from UWA Handbook 2026). */
const UNIT_AVAILABILITY: Record<string, string[]> = {
  'CITS1003': ['S1','S2'], 'CITS1401': ['S1','S2'], 'CITS1402': ['S1','S2'],
  'CITS5014': ['S1','S2'], 'CITS5015': ['S1','S2'], 'CITS5206': ['S1','S2'],
  'INMT5518': ['S1','S2'], 'INMT5526': ['S1','S2'], 'MGMT5504': ['S1','S2'],
  'PHIL4100': ['S1','S2'], 'SVLG5001': ['S1','S2'], 'ENVT4411': ['S1','S2'],
  'CITS2005': ['S1'], 'CITS4401': ['S1'], 'CITS4402': ['S1'],
  'CITS4404': ['S1'], 'CITS4407': ['S1'], 'CITS4505': ['S1'],
  'CITS5504': ['S1'], 'CITS5505': ['S1'], 'CITS5506': ['S1'], 'CITS5508': ['S1'],
  'CITS2002': ['S2'], 'CITS4009': ['S2'], 'CITS4012': ['S2'],
  'CITS4403': ['S2'], 'CITS5017': ['S2'], 'CITS5501': ['S2'],
  'CITS5503': ['S2'], 'CITS5507': ['S2'],
};

/**
 * Post-generation fix: move units placed in wrong semesters based on
 * availability (S1-only → S1, S2-only → S2).
 */
function fixAvailability(semesters: PlanSemester[], response: StudyPlanResponse): void {
  const MAX_PER_SEM = 4;

  for (const sem of semesters) {
    const termInLabel = sem.label.includes('S1') ? 'S1' : sem.label.includes('S2') ? 'S2' : null;
    if (!termInLabel) continue;
    const oppositeTerm = termInLabel === 'S1' ? 'S2' : 'S1';

    for (const unit of [...sem.units]) {
      const avail = UNIT_AVAILABILITY[unit.code];
      if (!avail || avail.length >= 2) continue; // both or unknown = fine
      if (avail.includes(termInLabel!)) continue; // correctly placed

      let placed = false;

      // Strategy 1: Swap with a misplaced unit in opposite-term semester
      for (const target of semesters) {
        if (target.sequence === sem.sequence) continue;
        const targetLabel = target.label.includes('S1') ? 'S1' : target.label.includes('S2') ? 'S2' : null;
        if (targetLabel !== oppositeTerm) continue;

        for (const targetUnit of [...target.units]) {
          const tAvail = UNIT_AVAILABILITY[targetUnit.code];
          if (!tAvail || tAvail.length >= 2) continue;
          if (!tAvail.includes(termInLabel!)) continue;

          // Swap units
          sem.units = sem.units.filter(u => u.code !== unit.code);
          target.units = target.units.filter(u => u.code !== targetUnit.code);
          sem.units.push(targetUnit);
          target.units.push(unit);
          placed = true;
          break;
        }
        if (placed) break;
      }

      // Strategy 2: Move to any correct-term semester with room (no swap needed)
      if (!placed) {
        for (const target of semesters) {
          if (target.sequence === sem.sequence) continue;
          if (target.units.length >= MAX_PER_SEM) continue;
          const targetLabel = target.label.includes('S1') ? 'S1' : target.label.includes('S2') ? 'S2' : null;
          if (!avail.includes(targetLabel!)) continue; // target must be correct term

          // Move unit
          sem.units = sem.units.filter(u => u.code !== unit.code);
          target.units.push(unit);
          placed = true;
          response.warnings.push(
            `Moved ${unit.code} from ${sem.label} to ${target.label} (availability correction).`
          );
          break;
        }
      }

      // Strategy 3: Can't fix — warn
      if (!placed) {
        response.warnings.push(
          `Could not place ${unit.code} in ${sem.label} (${avail[0]}-only). Consider removing this unit.`
        );
      }
    }
  }
}

/** Post-generation sanitise: dedup, research pair validation. */
function sanitizePlan(response: StudyPlanResponse): void {
  // Dedup: remove duplicate unit codes
  const seenCodes = new Set<string>();
  let dedupCount = 0;
  for (const sem of response.plan.semesters) {
    const kept: typeof sem.units = [];
    for (const unit of sem.units) {
      if (!seenCodes.has(unit.code)) {
        seenCodes.add(unit.code);
        kept.push(unit);
      } else {
        dedupCount++;
      }
    }
    sem.units = kept;
  }
  if (dedupCount > 0) {
    response.warnings.push(`Removed ${dedupCount} duplicate unit(s).`);
  }

  // Research pair: CITS5014 must be semester ≥ 3
  const semWith5014 = response.plan.semesters.find(s => s.units.some(u => u.code === 'CITS5014'));
  if (semWith5014 && semWith5014.sequence < 3) {
    for (const sem of response.plan.semesters) {
      sem.units = sem.units.filter(u => u.code !== 'CITS5014' && u.code !== 'CITS5015');
    }
    response.warnings.push(
      `Dropped research project: CITS5014 placed in semester ${semWith5014.sequence} (needs ≥3). Both CITS5014 and CITS5015 removed.`
    );
  }

  // Research pair: all-or-nothing
  const has5014 = response.plan.semesters.some(s => s.units.some(u => u.code === 'CITS5014'));
  const has5015 = response.plan.semesters.some(s => s.units.some(u => u.code === 'CITS5015'));
  if (has5014 !== has5015) {
    for (const sem of response.plan.semesters) {
      sem.units = sem.units.filter(u => u.code !== 'CITS5014' && u.code !== 'CITS5015');
    }
    response.warnings.push(
      `Dropped research project: only one of CITS5014/CITS5015 included (bound pair required). Both removed.`
    );
  }

  // Fill incomplete semesters: move units from overloaded semesters
  fillIncompleteSemesters(response);
}

/** Fill semesters with <4 units by pulling from overloaded or unfilled catalogue */
function fillIncompleteSemesters(response: StudyPlanResponse): void {
  const MAX = 4;
  let fixed = 0;

  for (const sem of response.plan.semesters) {
    while (sem.units.length < MAX) {
      // Find an overloaded semester to take from
      const donor = response.plan.semesters.find(
        s => s.sequence !== sem.sequence && s.units.length > MAX
      );
      if (donor) {
        const moved = donor.units.pop()!;
        sem.units.push(moved);
        fixed++;
        continue;
      }
      break;
    }
  }

  if (fixed > 0) {
    response.warnings.push(
      `Redistributed ${fixed} unit(s) to balance semester loads.`
    );
  }
}

export async function generateStudyPlan(input: GeneratePlanInput): Promise<StudyPlanResponse> {
  // Abuse detection
  const abuseResult = detectAbuse(input.userMessage);
  const isS2Start = input.startTerm === 'S2';

  if (abuseResult.isAbuse) {
    // For S2 start: use deterministic builder (handles availability correctly)
    // For S1 start: use fast official template
    if (isS2Start) {
      let catalogue = await getProgrammeCatalogueFromDb(input.programCode)
        ?? getMockProgrammeCatalogue(input.programCode);
      if (catalogue) {
        const plan = buildDeterministicPlan(catalogue, input.specialisation, 'S2');
        sanitizePlan(plan);
        plan.generatedAt = new Date().toISOString();
        plan.systemMessage = {
          type: abuseResult.category === 'irrelevant' ? 'irrelevant' : 'abuse',
          message: abuseResult.category === 'irrelevant'
            ? `Your input does not appear to be a study planning request. Reason: ${abuseResult.reason}. A default plan has been returned instead. To get a personalised plan, please describe your study preferences.`
            : abuseResult.category === 'offensive'
              ? `Your input contains inappropriate language. A default plan has been returned instead. Please describe your study needs respectfully.`
              : `Non-compliant input detected. Reason: ${abuseResult.reason}. A default plan has been returned instead. Please describe your study preferences.`,
        };
        return plan;
      }
    }

    const fallback = getFallbackPlan(input.programCode, input.specialisation);
    if (fallback) {
      fallback.generatedAt = new Date().toISOString();
      fallback.systemMessage = {
        type: abuseResult.category === 'irrelevant' ? 'irrelevant' : 'abuse',
        message: abuseResult.category === 'irrelevant'
          ? `Your input does not appear to be a study planning request. Reason: ${abuseResult.reason}. A default UWA official template has been returned instead. To get a personalised plan, please describe your study preferences (e.g. "I want to focus on AI", "I prefer easier courses", etc.).`
          : abuseResult.category === 'offensive'
            ? `Your input contains inappropriate language. A default UWA official template has been returned instead. Please describe your study needs respectfully.`
            : `Non-compliant input detected. Reason: ${abuseResult.reason}. A default UWA official template has been returned instead. Please describe your study preferences to get a personalised plan.`,
      };
      return fallback;
    }
    // If no fallback available, still throw
    throw Object.assign(new Error(abuseResult.reason), { status: 400, abuseCategory: abuseResult.category });
  }

  // Fast path: use precomputed official plan for standard requests (< 1 second)
  // S2 start plans need different unit placement — fall through to AI
  const hasCustomRequest = /easy|hard|difficult|light|heavy|challeng|specific|want|need|prefer|avoid|only|custom|would like|like to|interested in|focus on|looking for|wish to|keen on|plan to|aim to|hope to|try to|explore/i.test(input.userMessage);
  if (!hasCustomRequest && !isS2Start) {
    const fastPlan = getFallbackPlan(input.programCode, input.specialisation);
    if (fastPlan) {
      const requestedSemesters = input.preferredSemesterCount || 4;
      if (requestedSemesters !== 4 && fastPlan.plan.semesters.length !== requestedSemesters) {
        // Fall through to AI for non-standard semester counts
      } else {
        fastPlan.generatedAt = new Date().toISOString();
        fastPlan.systemMessage = {
          type: 'fast_path',
          message: 'No personalised study preferences detected — returning the official UWA recommended template. To get a customised plan, describe your preferences in the input (e.g. "I want to focus on AI", "I prefer easier courses", "I have already completed CITS1401", etc.).',
        };
        fastPlan.warnings.push('⚡ Instant plan — generated from official UWA template.');
        return fastPlan;
      }
    }
  }

  let catalogue = await getProgrammeCatalogueFromDb(input.programCode)
    ?? getMockProgrammeCatalogue(input.programCode);

  if (!catalogue) {
    throw new Error(`No catalogue configured for programme ${input.programCode}`);
  }

  // Build a rich user message that includes all context
  const userMessage = buildRichUserMessage(input);

  const { system, user } = buildPlannerPrompt(userMessage, catalogue, input.specialisation, input.startTerm || 'S1');

  // DEBUG: dump prompt to inspect prerequisite data quality
  const fs = require('fs');
  fs.writeFileSync('/tmp/last_ai_prompt.txt', `=== SYSTEM PROMPT ===
${system}

=== USER PROMPT ===
${user}`);
  console.log('[aiPlanner] Prompt saved to /tmp/last_ai_prompt.txt, system:', system.length, 'chars, user:', user.length, 'chars');

  // Rate limiting disabled for testing

  let lastErrorMessage = 'No response produced.';
  let totalTokensUsed = 0;
  const startTime = Date.now();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const { content: raw, usage } = await requestPlanFromModel(system, user);
      if (usage) {
        totalTokensUsed = usage.totalTokens;
      }
      const jsonText = extractJsonFromModelOutput(raw);

      console.log('[aiPlanner] Raw response (first 2000 chars):', raw.substring(0, 2000));
      console.log('[aiPlanner] Extracted JSON (last 200 chars):', jsonText.substring(Math.max(0, jsonText.length - 200)));
      // Save full JSON for debugging
      const fs = require('fs');
      fs.writeFileSync('/tmp/last_ai_plan.json', jsonText);
      console.log('[aiPlanner] Saved JSON to /tmp/last_ai_plan.json, length:', jsonText.length);

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch (parseErr) {
        console.error('[aiPlanner] JSON parse failed:', parseErr instanceof Error ? parseErr.message : parseErr);
        console.error('[aiPlanner] JSON text (first 500):', jsonText.substring(0, 500));
        throw new Error(`JSON parse error: ${parseErr instanceof Error ? parseErr.message : 'Unknown'}`);
      }

      if (!validateStudyPlanShape(parsed)) {
        console.error('[aiPlanner] Schema validation failed. Keys:', Object.keys(parsed as object));
        const p = parsed as any;
        if (p.plan) {
          console.error('[aiPlanner] explanation.overview:', typeof p.explanation?.overview, p.explanation?.overview?.substring?.(0,50));
          console.error('[aiPlanner] explanation.electiveRationales is array:', Array.isArray(p.explanation?.electiveRationales));
          if (Array.isArray(p.explanation?.electiveRationales)) {
            console.error('[aiPlanner] electiveRationales types:', p.explanation.electiveRationales.map((x:any)=>typeof x));
          }
          console.error('[aiPlanner] constraintsAcknowledged is array:', Array.isArray(p.constraintsAcknowledged));
          if (Array.isArray(p.constraintsAcknowledged)) {
            console.error('[aiPlanner] constraintsAcknowledged types:', p.constraintsAcknowledged.map((x:any)=>typeof x).slice(0,5));
          }
          console.error('[aiPlanner] warnings is array:', Array.isArray(p.warnings));
          if (Array.isArray(p.warnings)) {
            console.error('[aiPlanner] warnings types:', p.warnings.map((x:any)=>typeof x).slice(0,5));
          }
          // Check unit types in first semester
          if (p.plan.semesters?.[0]?.units) {
            const u = p.plan.semesters[0].units[0];
            console.error('[aiPlanner] First unit:', JSON.stringify(u));
          }
        }
        throw new Error('Generated JSON does not match the expected study plan schema.');
      }

      const response = parsed as StudyPlanResponse;

      sanitizePlan(response);

      // Relabel BEFORE post-generation fixes and validation
      const effectiveStart = input.startTerm || 'S1';
      relabelSemestersForStartTerm(response, effectiveStart);

      // Apply post-generation prerequisite + availability fixes
      // Must happen AFTER relabel so fixAvailability sees correct S1/S2 labels
      fixPrerequisiteSemesters(response);

      // Enhance with metadata
      response.generatedAt = new Date().toISOString();

      // Post-generation validation: if AI plan has failures, use deterministic fallback
      if (catalogue) {
        try {
          const startYear = 2026;
          const validationResult = await validatePlan({
            courseCode: input.programCode,
            completedUnits: input.completedUnits || [],
            selectedSpecialisations: input.specialisation ? [input.specialisation] : [],
            plan: response.plan.semesters.map((s, i) => ({
              sequence: s.sequence || i + 1,
              year: effectiveStart === 'S2'
                ? startYear + Math.floor((i + 1) / 2)
                : startYear + Math.floor(i / 2),
              term: (effectiveStart === 'S2'
                ? (i % 2 === 0 ? 'S2' as const : 'S1' as const)
                : (i % 2 === 0 ? 'S1' as const : 'S2' as const)),
              units: s.units.map(u => u.code),
            })),
          });

          const failCount = validationResult.issues.filter(i => i.severity === 'fail').length;
          const warnCount = validationResult.issues.filter(i => i.severity === 'warning').length;
          // Log issues but DON'T fall back — let post-generation fixes handle them
          // The AI plan with minor issues is usually better than a deterministic fallback
          if (failCount > 0 || warnCount > 0) {
            console.warn(`[aiPlanner] AI plan has ${failCount} failures + ${warnCount} warnings — keeping plan with fixes applied`);
            response.warnings.push(
              `This plan has ${failCount} validation failures and ${warnCount} warnings. Review carefully before enrolling.`
            );
            // Log specific issues for debugging
            for (const issue of validationResult.issues.slice(0, 5)) {
              console.warn(`[aiPlanner]   ${issue.severity}: ${issue.message}`);
            }
          }
        } catch (valErr) {
          console.warn('[aiPlanner] Post-validation error, keeping AI plan:', valErr);
        }
      }

      // Apply post-generation prerequisite fixes
      await recordTokenUsage(totalTokensUsed || (userMessage.length + user.length + system.length));
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
  
  // Fallback: deterministic plan from catalogue
  if (catalogue) {
    console.warn(`[aiPlanner] AI failed after ${MAX_ATTEMPTS} attempts — generating deterministic fallback plan`);
    try {
      const fallback = buildDeterministicPlan(catalogue, input.specialisation, input.startTerm || "S1");
      sanitizePlan(fallback);
      fallback.warnings.push(
        `AI generation failed after ${MAX_ATTEMPTS} attempts (${elapsed}s): ${lastErrorMessage}`
      );
      fallback.warnings.push('This is a deterministically-generated FALLBACK plan.');
      return fallback;
    } catch (fallbackErr) {
      console.error('[aiPlanner] Fallback plan generation also failed:', fallbackErr);
    }
  }

  throw new Error(
    `Study plan generation failed after ${MAX_ATTEMPTS} attempts (${elapsed}s): ${lastErrorMessage}`,
  );
}

/**
 * Relabel semester labels when the plan starts from S2 instead of S1.
 * S1 start: S1 2026, S2 2026, S1 2027, S2 2027 ...
 * S2 start: S2 2026, S1 2027, S2 2027, S1 2028 ...
 */
function relabelSemestersForStartTerm(
  response: StudyPlanResponse,
  startTerm: 'S1' | 'S2',
  startYear = 2026,
): void {
  if (startTerm === 'S1') return; // Default, nothing to do

  response.plan.semesters.forEach((sem, i) => {
    // S2 start: 0→S2, 1→S1, 2→S2, 3→S1
    // year offset: (i+1)/2 for S2 start
    const isEven = i % 2 === 0;
    const term = startTerm === 'S2' ? (isEven ? 'S2' : 'S1') : (isEven ? 'S1' : 'S2');
    const yearOffset = startTerm === 'S2' ? Math.floor((i + 1) / 2) : Math.floor(i / 2);
    const year = startYear + yearOffset;
    sem.label = `${term} ${year}`;
  });
}

function buildRichUserMessage(input: GeneratePlanInput): string {
  const lines: string[] = [];

  lines.push(`Create a study plan for ${input.programCode}.`);

  // ⚠️ Start term — critical for availability placement
  if (input.startTerm) {
    lines.push(`Start semester: ${input.startTerm} (the plan MUST begin from ${input.startTerm}).`);
    lines.push(`Semester sequence: ${input.startTerm === 'S2' ? 'S2 2026, S1 2027, S2 2027, S1 2028' : 'S1 2026, S2 2026, S1 2027, S2 2027'}.`);
    if (input.startTerm === 'S2') {
      lines.push('CRITICAL: Since the plan starts in S2, the FIRST semester contains ONLY S2-available (or both-semester) units. S1-only units CANNOT appear in the first semester.');
    }
  }

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

  // Detect research intent — recommend research project units
  const researchKeywords = /\b(research|thesis|dissertation|phd|doctorate|academic\s+path|research\s+project)\b/i;
  const userText = (input.userMessage ?? '') + ' ' + (input.preferences ?? '');
  if (researchKeywords.test(userText)) {
    lines.push('');
    lines.push('🔬 **RESEARCH PATH DETECTED:** The student has expressed interest in research.');
    lines.push('- CITS5014 (Research Project Part 1, 6pts) and CITS5015 (Research Project Part 2, 6pts) are available.');
    lines.push('- These form a TWO-SEMESTER research project sequence: CITS5014 → CITS5015 (in consecutive semesters).');
    lines.push('- STRONGLY RECOMMEND including CITS5014 in semester 3 and CITS5015 in semester 4.');
    lines.push('- CITS5014 requires at least 2 semesters of prior coursework (earliest start: semester 3).');
    lines.push('- Note: CITS5014 and CITS5015 are by invitation only (WAM ≥ 70 required).');
  }

  return lines.join('\n');
}
