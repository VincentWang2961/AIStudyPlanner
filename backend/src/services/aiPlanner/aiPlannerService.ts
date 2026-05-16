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

// ─── Post-Generation Availability Fix ──────────────────────────────────────

/**
 * After AI generates a plan, programmatically fix availability violations.
 * The AI often places units in wrong semesters because its training data
 * overrides the catalogue's availability info. This function swaps mis-placed
 * units between semesters to respect the catalogue availability.
 */
function fixAvailabilityViolations(
  plan: StudyPlanResponse,
  catalogue: { units: { code: string; availability: string[] }[] },
): { plan: StudyPlanResponse; fixes: number; warnings: string[] } {
  const unitAvail = new Map(catalogue.units.map(u => [u.code, u.availability]));
  let fixes = 0;
  const warnings: string[] = [];

  for (const semester of plan.plan.semesters) {
    const termInLabel = semester.label.match(/S([12])/i);
    if (!termInLabel) continue;
    const expectedTerm = `S${termInLabel[1]}`;

    for (const unit of semester.units) {
      const avail = unitAvail.get(unit.code);
      if (!avail || avail.length === 0) continue;

      // Check if the unit is available in this semester
      if (avail.includes(expectedTerm)) continue;

      // Unit is in wrong semester — try to find a swap candidate
      const swapSemester = plan.plan.semesters.find(s => {
        const sLabel = s.label.match(/S([12])/i);
        if (!sLabel) return false;
        const sTerm = `S${sLabel[1]}`;
        return sTerm !== expectedTerm && avail.includes(sTerm);
      });

      if (!swapSemester) {
        warnings.push(`${unit.code} (${unit.title}) is only available in ${avail.join(', ')} but placed in ${semester.label} — cannot fix automatically`);
        continue;
      }

      // Find a unit in the swap semester that can go HERE instead
      const swapTermInLabel = swapSemester.label.match(/S([12])/i);
      if (!swapTermInLabel) continue;
      const swapExpectedTerm = `S${swapTermInLabel[1]}`;

      const candidateIdx = swapSemester.units.findIndex(u => {
        const uAvail = unitAvail.get(u.code);
        return uAvail && (uAvail.includes(expectedTerm) || uAvail.length === 0);
      });

      if (candidateIdx === -1) {
        warnings.push(`${unit.code} should be in ${avail.join(', ')} but placed in ${semester.label} — no swap candidate found`);
        continue;
      }

      // Swap!
      const movedFromSemester = semester.units[semester.units.indexOf(unit)];
      const movedFromSwap = swapSemester.units[candidateIdx];
      semester.units[semester.units.indexOf(unit)] = movedFromSwap;
      swapSemester.units[candidateIdx] = movedFromSemester;
      fixes++;
      console.log(`[aiPlanner] Availability fix: moved ${movedFromSemester.code} ${semester.label} → ${swapSemester.label}, ${movedFromSwap.code} ${swapSemester.label} → ${semester.label}`);
    }
  }

  return { plan, fixes, warnings };
}

/**
 * Fix unit types to match the catalogue. The AI often marks units with
 * incorrect types (e.g. core as elective) based on its training data.
 * This forces every unit's type to match the authoritative catalogue.
 */
function fixUnitTypes(
  plan: StudyPlanResponse,
  catalogue: { units: { code: string; type: string }[] },
): { plan: StudyPlanResponse; corrected: number } {
  const unitTypeMap = new Map(catalogue.units.map(u => [u.code, u.type]));
  let corrected = 0;

  for (const semester of plan.plan.semesters) {
    for (const unit of semester.units) {
      const catalogueType = unitTypeMap.get(unit.code);
      if (catalogueType && catalogueType !== unit.type) {
        console.log(`[aiPlanner] Type fix: ${unit.code} ${unit.type} → ${catalogueType}`);
        unit.type = catalogueType as typeof unit.type;
        corrected++;
      }
    }
  }

  return { plan, corrected };
}

/**
 * Fix prerequisite ordering: ensure no unit is in the same semester
 * (or earlier) than its prerequisites. Moves dependent units later.
 */
function fixPrerequisiteOrdering(
  plan: StudyPlanResponse,
  catalogue: { units: { code: string; prerequisites: string[] }[] },
): { plan: StudyPlanResponse; fixes: number; warnings: string[] } {
  const prereqMap = new Map(catalogue.units.map(u => [u.code, u.prerequisites]));
  let fixes = 0;
  const warnings: string[] = [];

  for (let iter = 0; iter < 5; iter++) {
    let changed = false;
    for (let i = 0; i < plan.plan.semesters.length; i++) {
      const semester = plan.plan.semesters[i];
      for (const unit of [...semester.units]) {
        const prereqs = prereqMap.get(unit.code) || [];
        for (const prereqCode of prereqs) {
          const prereqSemIdx = plan.plan.semesters.findIndex(s => s.units.some(u => u.code === prereqCode));
          if (prereqSemIdx === -1) continue;
          if (prereqSemIdx >= i) {
            // Try 1: Move the PREREQUISITE to an earlier semester first
            const prereqUnit = plan.plan.semesters[prereqSemIdx].units.find(u => u.code === prereqCode);
            if (prereqUnit && prereqSemIdx > 0) {
              const prevSem = plan.plan.semesters[prereqSemIdx - 1];
              const swapIdx = prevSem.units.findIndex(u => {
                // Find a unit that CAN move to the prereq's current semester
                // without creating its own prereq violations
                const up = prereqMap.get(u.code) || [];
                return up.length === 0 || up.every(p => {
                  const pi = plan.plan.semesters.findIndex(s => s.units.some(su => su.code === p));
                  return pi === -1 || pi < prereqSemIdx;
                });
              });
              if (swapIdx !== -1) {
                const curIdx = plan.plan.semesters[prereqSemIdx].units.indexOf(prereqUnit);
                const a = plan.plan.semesters[prereqSemIdx].units[curIdx];
                const b = prevSem.units[swapIdx];
                plan.plan.semesters[prereqSemIdx].units[curIdx] = b;
                prevSem.units[swapIdx] = a;
                fixes++; changed = true;
                console.log(`[aiPlanner] Prereq fix: moved ${a.code} S${prereqSemIdx+1}→S${prereqSemIdx}, ${b.code} S${prereqSemIdx}→S${prereqSemIdx+1}`);
                break;
              }
            }

            // Try 2: Move DEPENDENT unit to a LATER semester with compatible availability
            if (!changed) {
              // Find the next semester where this unit is available
              for (let j = i + 1; j < plan.plan.semesters.length; j++) {
                const targetLabel = plan.plan.semesters[j].label.match(/S([12])/i);
                const currentLabel = semester.label.match(/S([12])/i);
                if (!targetLabel || !currentLabel) continue;
                
                const swapIdx = plan.plan.semesters[j].units.findIndex(u => {
                  const up = prereqMap.get(u.code) || [];
                  return up.length === 0 || up.every(p => {
                    const pi = plan.plan.semesters.findIndex(s => s.units.some(su => su.code === p));
                    return pi === -1 || pi < i;
                  });
                });
                if (swapIdx !== -1) {
                  const curIdx = semester.units.indexOf(unit);
                  const a = semester.units[curIdx];
                  const b = plan.plan.semesters[j].units[swapIdx];
                  semester.units[curIdx] = b;
                  plan.plan.semesters[j].units[swapIdx] = a;
                  fixes++; changed = true;
                  console.log(`[aiPlanner] Prereq fix: ${a.code} S${i+1}→S${j+1}, ${b.code} S${j+1}→S${i+1}`);
                  break;
                }
              }
            }
          }
        }
      }
    }
    if (!changed) break;
  }
  return { plan, fixes, warnings };
}

/**
 * Check if all specialisation core units are present in the plan.
 * Returns validation issues for missing cores.
 */
function checkSpecialisationCores(
  plan: StudyPlanResponse,
  specialisationCode: string | undefined,
  catalogue: { specialisations: { code: string; name: string; coreUnits: string[] }[] },
): { issues: Array<{ category: string; severity: 'fail' | 'warning'; title: string; message: string }> } {
  const issues: Array<{ category: string; severity: 'fail' | 'warning'; title: string; message: string }> = [];

  if (!specialisationCode) return { issues };

  const specLower = specialisationCode.trim().toLowerCase();
  const spec = catalogue.specialisations.find(
    s => s.code.toLowerCase() === specLower || s.name.toLowerCase() === specLower
  );

  if (!spec) return { issues };

  const planCodes = new Set(plan.plan.semesters.flatMap(s => s.units.map(u => u.code)));
  const missingCores = spec.coreUnits.filter(core => !planCodes.has(core));

  if (missingCores.length > 0) {
    issues.push({
      category: 'specialisation',
      severity: 'fail',
      title: 'Missing specialisation core units',
      message: `The ${spec.name} specialisation requires the following core units that are missing from the plan: ${missingCores.join(', ')}. These must be included for the specialisation to be satisfied.`,
    });
  }

  return { issues };
}

/**
 * Check that mandatory program core units are ALL present.
 * These are non-negotiable for MIT 62510.
 */
function checkMandatoryCores(
  plan: StudyPlanResponse,
): { issues: Array<{ category: string; severity: 'fail' | 'warning'; title: string; message: string }> } {
  const issues: Array<{ category: string; severity: 'fail' | 'warning'; title: string; message: string }> = [];

  // Mandatory cores for MIT 62510 (from UWA Handbook 2026 "Take all units")
  const mandatoryCores = ['CITS4401', 'CITS5206', 'CITS5505', 'PHIL4100'];
  const planCodes = new Set(plan.plan.semesters.flatMap(s => s.units.map(u => u.code)));
  const missingCores = mandatoryCores.filter(core => !planCodes.has(core));

  if (missingCores.length > 0) {
    issues.push({
      category: 'mandatory-core',
      severity: 'fail',
      title: 'Missing mandatory core units',
      message: `The following mandatory core units are missing from the plan: ${missingCores.join(', ')}. These units are required for ALL Master of IT students per UWA Handbook 2026.`,
    });
  }

  // CITS5206 (Capstone) should be in the final semester (or second-to-last)
  const lastSemIdx = plan.plan.semesters.length - 1;
  for (let i = 0; i < plan.plan.semesters.length; i++) {
    const sem = plan.plan.semesters[i];
    const hasCapstone = sem.units.some(u => u.code === 'CITS5206');
    if (hasCapstone && i < lastSemIdx - 1) {
      issues.push({
        category: 'capstone-placement',
        severity: 'warning',
        title: 'Capstone placement',
        message: `CITS5206 (Capstone) is in semester ${sem.sequence} (${sem.label}) but should ideally be in the final semester(s).`,
      });
      break;
    }
  }

  return { issues };
}

/**
 * Check research project units are properly paired.
 * CITS5014 (Part 1) must be followed by CITS5015 (Part 2) in a consecutive semester.
 */
function checkResearchProjectPairing(
  plan: StudyPlanResponse,
): { issues: Array<{ category: string; severity: 'fail' | 'warning'; title: string; message: string }> } {
  const issues: Array<{ category: string; severity: 'fail' | 'warning'; title: string; message: string }> = [];

  const hasPart1 = plan.plan.semesters.some(s => s.units.some(u => u.code === 'CITS5014'));
  const hasPart2 = plan.plan.semesters.some(s => s.units.some(u => u.code === 'CITS5015'));

  if (hasPart1 && !hasPart2) {
    issues.push({
      category: 'research-project',
      severity: 'fail',
      title: 'Research project incomplete',
      message: 'CITS5014 (Research Project Part 1) is in the plan but CITS5015 (Part 2) is missing. The research project requires both parts in consecutive semesters.',
    });
  }

  if (hasPart2 && !hasPart1) {
    issues.push({
      category: 'research-project',
      severity: 'fail',
      title: 'Research project missing prerequisite',
      message: 'CITS5015 (Research Project Part 2) is in the plan but CITS5014 (Part 1) is missing. Part 1 is a prerequisite for Part 2.',
    });
  }

  // Check consecutive semesters
  if (hasPart1 && hasPart2) {
    const part1Idx = plan.plan.semesters.findIndex(s => s.units.some(u => u.code === 'CITS5014'));
    const part2Idx = plan.plan.semesters.findIndex(s => s.units.some(u => u.code === 'CITS5015'));
    if (part2Idx !== part1Idx + 1 && part1Idx >= 0) {
      issues.push({
        category: 'research-project',
        severity: 'warning',
        title: 'Research project not in consecutive semesters',
        message: `CITS5014 is in semester ${part1Idx + 1} but CITS5015 is in semester ${part2Idx + 1}. They should be in consecutive semesters.`,
      });
    }
  }

  return { issues };
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

      // ── Step 4.5: Fix AI Unit Types ────────────────────────────────
      // AI often mislabels unit types (core/elective) based on training
      // data. Force-correct to match the authoritative catalogue.
      const { corrected: typeFixes } = fixUnitTypes(aiPlan, catalogue);
      if (typeFixes > 0) {
        console.log(`[aiPlanner] Corrected ${typeFixes} unit type(s) to match catalogue`);
      }

      // Record token usage
      await recordTokenUsage(totalTokensUsed);

      // ── Step 5: Validate the AI-Generated Plan (Server-Side) ──────────
      let validation = await validateAiGeneratedPlan(
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

      // ── Step 5.5: Post-Generation Availability Fix ──────────────────
      // AI often places units in wrong semesters (training data overrides
      // catalogue availability). Programmatically fix before returning.
      const availabilityIssues = validation.issues.filter(
        i => i.severity === 'fail' && i.category === 'availability'
      );

      if (availabilityIssues.length > 0) {
        console.log(`[aiPlanner] Attempt ${attempt}: ${availabilityIssues.length} availability violations detected — applying programmatic fix...`);

        const { fixes, warnings: fixWarnings } = fixAvailabilityViolations(aiPlan, catalogue);

        if (fixes > 0) {
          console.log(`[aiPlanner] Fixed ${fixes} availability violations programmatically`);

          // Re-validate after fix
          validation = await validateAiGeneratedPlan(
            aiPlan,
            input.programCode,
            input.completedUnits || [],
            input.specialisation,
          );

          // Add fix notes to warnings
          if (fixWarnings.length > 0) {
            aiPlan.warnings = [...(aiPlan.warnings || []), ...fixWarnings];
          }
          aiPlan.warnings.push(`Programmatic fix applied: ${fixes} unit placement(s) corrected for semester availability.`);
        }
      }

      // ── Step 5.5b: Post-Generation Prerequisite Ordering Fix ─────
      // AI often places units alongside their prerequisites in the same
      // semester. Move dependent units to later semesters as needed.
      const prereqIssues = validation.issues.filter(
        i => i.severity === 'fail' && i.category === 'prerequisite'
      );

      if (prereqIssues.length > 0) {
        console.log(`[aiPlanner] Attempt ${attempt}: ${prereqIssues.length} prerequisite ordering violations — applying fix...`);
        const { fixes: prereqFixes } = fixPrerequisiteOrdering(aiPlan, catalogue);
        if (prereqFixes > 0) {
          console.log(`[aiPlanner] Fixed ${prereqFixes} prerequisite ordering violations`);
          // Prereq fix may create availability violations — re-run both fixes
          const { fixes: availFixes2 } = fixAvailabilityViolations(aiPlan, catalogue);
          if (availFixes2 > 0) console.log(`[aiPlanner] Re-fixed ${availFixes2} availability violations after prereq fix`);
          validation = await validateAiGeneratedPlan(aiPlan, input.programCode, input.completedUnits || [], input.specialisation);
          aiPlan.warnings.push(`Programmatic fix: ${prereqFixes} prerequisite ordering + ${availFixes2} availability corrections applied.`);
        }
      }

      // ── Step 5.6: Specialisation Core Unit Check ────────────────────
      // Verify all required core units for the selected specialisation
      // are present in the plan. This catches AI omissions.
      if (input.specialisation || catalogue.specialisations.length > 0) {
        const { issues: specIssues } = checkSpecialisationCores(
          aiPlan,
          input.specialisation,
          catalogue,
        );

        if (specIssues.length > 0) {
          validation.issues.push(...specIssues);
          if (specIssues.some(i => i.severity === 'fail')) {
            validation.overallStatus = 'fail';
          } else if (validation.overallStatus === 'pass' && specIssues.some(i => i.severity === 'warning')) {
            validation.overallStatus = 'warning';
          }
        }
      }

      // ── Step 5.7: Mandatory Core Check ──────────────────────────────
      // CITS4401, CITS5206, CITS5505, PHIL4100 must ALL be present
      // for every MIT 62510 plan regardless of specialisation.
      {
        const { issues: coreIssues } = checkMandatoryCores(aiPlan);
        if (coreIssues.length > 0) {
          validation.issues.push(...coreIssues);
          if (coreIssues.some(i => i.severity === 'fail')) {
            validation.overallStatus = 'fail';
          }
        }
      }

      // ── Step 5.8: Research Project Pairing Check ────────────────────
      // CITS5014 (Part 1) must be followed by CITS5015 (Part 2).
      {
        const { issues: researchIssues } = checkResearchProjectPairing(aiPlan);
        if (researchIssues.length > 0) {
          validation.issues.push(...researchIssues);
          if (researchIssues.some(i => i.severity === 'fail')) {
            validation.overallStatus = 'fail';
          }
        }
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
