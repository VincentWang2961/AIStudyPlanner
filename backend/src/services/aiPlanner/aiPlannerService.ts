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

  if (input.preferredSemesterCount && input.unitsPerSemester) {
    const totalTarget = input.preferredSemesterCount * input.unitsPerSemester;
    lines.push(`IMPORTANT — Workload distribution: ${input.preferredSemesterCount} semesters × ${input.unitsPerSemester} units each = ${totalTarget} total units.`);
    lines.push(`EVERY semester must have exactly ${input.unitsPerSemester} units. Even distribution is MANDATORY unless the student explicitly asks for uneven load.`);
  } else if (input.preferredSemesterCount) {
    lines.push(`Preferred semester count: ${input.preferredSemesterCount}.`);
  } else if (input.unitsPerSemester) {
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
  catalogue: { units: { code: string; prerequisites: string[]; availability: string[] }[] },
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

            // Try 2: Move DEPENDENT unit to a LATER semester where it IS available
            if (!changed) {
              for (let j = i + 1; j < plan.plan.semesters.length; j++) {
                const targetLabel = plan.plan.semesters[j].label.match(/S([12])/i);
                if (!targetLabel) continue;
                const targetTerm = `S${targetLabel[1]}`;
                
                // Only consider semesters where this dependent unit is available
                const unitCatEntry = catalogue.units.find(cu => cu.code === unit.code);
                if (unitCatEntry && unitCatEntry.availability.length > 0 && !unitCatEntry.availability.includes(targetTerm)) {
                  continue;
                }
                
                // First try swap
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
                  console.log(`[aiPlanner] Prereq fix: swapped ${a.code} S${i+1}→S${j+1} ↔ ${b.code} S${j+1}→S${i+1}`);
                  break;
                }
                
                // Fallback: just move (no swap), accept workload imbalance
                if (swapIdx === -1) {
                  const curIdx = semester.units.indexOf(unit);
                  const moved = semester.units.splice(curIdx, 1)[0];
                  plan.plan.semesters[j].units.push(moved);
                  fixes++; changed = true;
                  console.log(`[aiPlanner] Prereq fix: moved ${moved.code} S${i+1}→S${j+1} (no swap, workload may be imbalanced)`);
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
 * Fix uneven workload distribution across semesters.
 * If the student specifies N semesters at M units each, every semester
 * should have exactly M units. The AI often creates unbalanced plans
 * (e.g. 2-6-4-4 instead of 4-4-4-4), so we programmatically rebalance.
 *
 * This is ONLY applied when:
 * 1. The user specified both semester count and units-per-semester
 * 2. The user did NOT explicitly request uneven distribution
 */
function fixWorkloadBalance(
  plan: StudyPlanResponse,
  input: GeneratePlanInput,
  catalogue: {
    units: { code: string; availability: string[]; prerequisites: string[]; type: string }[];
  },
): { plan: StudyPlanResponse; fixes: number; warnings: string[] } {
  const warnings: string[] = [];
  let fixes = 0;

  const numSemesters = input.preferredSemesterCount;
  const targetPerSem = input.unitsPerSemester;

  if (!targetPerSem || !numSemesters) {
    return { plan, fixes, warnings };
  }

  // Check if the user explicitly asked for uneven/custom distribution
  const userPrefs = (input.preferences || '').toLowerCase() + (input.userMessage || '').toLowerCase();
  const userWantsCustom = userPrefs.match(
    /lighter|heavier|fewer|more units|uneven|specific load|different per semester|balance/i,
  );
  // "balance" should NOT block balancing — skip it
  const userBlocksBalancing = userPrefs.match(
    /lighter|heavier|fewer units|more units|uneven|different per semester/i,
  );
  if (userBlocksBalancing) {
    return { plan, fixes, warnings };
  }

  // Build lookup maps
  const unitAvail = new Map(catalogue.units.map(u => [u.code, u.availability]));
  const unitPrereqs = new Map(catalogue.units.map(u => [u.code, u.prerequisites]));

  // Units that must stay in their current position
  const immovableUnits = new Set<string>();
  // Capstone must stay in the LAST semester only — if it's already there, don't move it.
  // If it's in a wrong semester, the capstone fixer (fixCapstonePosition) handles it separately.
  const lastSem = plan.plan.semesters[plan.plan.semesters.length - 1];
  if (lastSem && lastSem.units.some(u => u.code === 'CITS5206')) {
    immovableUnits.add('CITS5206');
  }

  // Research project parts must stay together and consecutive
  const part1Idx = plan.plan.semesters.findIndex(s => s.units.some(u => u.code === 'CITS5014'));
  const part2Idx = plan.plan.semesters.findIndex(s => s.units.some(u => u.code === 'CITS5015'));
  if (part1Idx >= 0 && part2Idx === part1Idx + 1) {
    immovableUnits.add('CITS5014');
    immovableUnits.add('CITS5015');
  }

  for (let iter = 0; iter < 15; iter++) {
    let changed = false;

    // Find overloaded (> target) and underloaded (< target) semesters
    const overloaded: { idx: number; count: number }[] = [];
    const underloaded: { idx: number; count: number }[] = [];

    for (let i = 0; i < plan.plan.semesters.length; i++) {
      const count = plan.plan.semesters[i].units.length;
      if (count > targetPerSem) {
        overloaded.push({ idx: i, count });
      } else if (count < targetPerSem) {
        underloaded.push({ idx: i, count });
      }
    }

    if (overloaded.length === 0 || underloaded.length === 0) break;

    // Process overloaded semesters in order of most → least excess
    overloaded.sort((a, b) => b.count - a.count);

    for (const over of overloaded) {
      const sem = plan.plan.semesters[over.idx];
      const currentCount = sem.units.length;
      if (currentCount <= targetPerSem) continue;

      const overLabel = sem.label.match(/S([12])/i);
      if (!overLabel) continue;

      // Find movable units: prefer electives, skip immovable/protected units
      const movableUnits = sem.units
        .map((u, idx) => ({ unit: u, idx }))
        .filter(({ unit }) => !immovableUnits.has(unit.code));

      // Score: electives first (prefer moving electives over cores)
      movableUnits.sort((a, b) => {
        const aIsElective = a.unit.type === 'elective' || a.unit.type === 'option';
        const bIsElective = b.unit.type === 'elective' || b.unit.type === 'option';
        if (aIsElective && !bIsElective) return -1;
        if (!aIsElective && bIsElective) return 1;
        return 0;
      });

      for (const { unit, idx } of movableUnits) {
        if (sem.units.length <= targetPerSem) break;

        // Try each underloaded semester as a target
        for (const under of underloaded) {
          const targetSem = plan.plan.semesters[under.idx];
          if (targetSem.units.length >= targetPerSem) continue;

          const targetLabel = targetSem.label.match(/S([12])/i);
          if (!targetLabel) continue;
          const targetTerm = `S${targetLabel[1]}`;

          // Check availability: unit must be available in target semester
          const avail = unitAvail.get(unit.code);
          if (avail && avail.length > 0 && !avail.includes(targetTerm)) continue;

          // Check prerequisites: unit's prereqs must all be in earlier semesters
          const prereqs = unitPrereqs.get(unit.code) || [];
          const allPrereqsEarlier = prereqs.every(p => {
            const pi = plan.plan.semesters.findIndex(s =>
              s.units.some(su => su.code === p),
            );
            return pi === -1 || pi < under.idx;
          });
          if (!allPrereqsEarlier) continue;

          // Check reverse: no unit in the target semester (or earlier) depends on this unit
          const depConflict = plan.plan.semesters.some((s, si) => {
            if (si > under.idx) return false;
            return s.units.some(u => {
              const up = unitPrereqs.get(u.code) || [];
              return up.includes(unit.code);
            });
          });
          if (depConflict) continue;

          // Move!
          const moved = sem.units.splice(idx, 1)[0];
          targetSem.units.push(moved);
          fixes++;
          changed = true;
          console.log(
            `[aiPlanner] Workload balance: moved ${moved.code} S${over.idx + 1}→S${under.idx + 1} (${targetSem.units.length}/${targetPerSem})`,
          );
          break; // move to next unit
        }
      }
    }

    if (!changed) break;
  }

  // Report final state
  for (let i = 0; i < plan.plan.semesters.length; i++) {
    const count = plan.plan.semesters[i].units.length;
    if (count !== targetPerSem) {
      warnings.push(
        `Semester ${i + 1} has ${count} units (target: ${targetPerSem}) — could not fully balance due to availability/prerequisite constraints.`,
      );
    }
  }

  return { plan, fixes, warnings };
}

/**
 * Fix capstone position: CITS5206 MUST be in the very last semester.
 * The AI frequently ignores the prompt instruction and places it in S1.
 * This function ensures CITS5206 is always moved to the final semester,
 * swapping with a compatible unit if possible, or forcibly moving it.
 */
function fixCapstonePosition(
  plan: StudyPlanResponse,
  catalogue: {
    units: { code: string; title: string; creditPoints: number; availability: string[]; prerequisites: string[]; type: string }[];
  },
): { plan: StudyPlanResponse; fixed: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const lastSemIdx = plan.plan.semesters.length - 1;
  if (lastSemIdx < 0) return { plan, fixed: false, warnings };

  // Find where CITS5206 currently sits
  let capstoneSemIdx = -1;
  let capstoneUnitIdx = -1;
  for (let i = 0; i < plan.plan.semesters.length; i++) {
    const idx = plan.plan.semesters[i].units.findIndex(u => u.code === 'CITS5206');
    if (idx >= 0) {
      capstoneSemIdx = i;
      capstoneUnitIdx = idx;
      break;
    }
  }

  // If CITS5206 is not in the plan at all, add it to the last semester
  if (capstoneSemIdx === -1) {
    const capstoneEntry = catalogue.units.find(u => u.code === 'CITS5206');
    if (capstoneEntry) {
      plan.plan.semesters[lastSemIdx].units.push({
        code: 'CITS5206',
        title: capstoneEntry.title,
        creditPoints: capstoneEntry.creditPoints,
        type: capstoneEntry.type as 'core' | 'elective' | 'option',
        rationale: 'Mandatory capstone — placed in final semester.',
      });
      console.log('[aiPlanner] Capstone fix: CITS5206 was MISSING — added to final semester');
      return { plan, fixed: true, warnings };
    }
    warnings.push('CITS5206 (Capstone) is missing from the plan entirely and could not be found in the catalogue.');
    return { plan, fixed: false, warnings };
  }

  // If CITS5206 is already in the last semester — nothing to do
  if (capstoneSemIdx === lastSemIdx) {
    return { plan, fixed: false, warnings };
  }

  // CITS5206 is in the wrong semester — we MUST fix this
  const lastSem = plan.plan.semesters[lastSemIdx];
  const capstoneUnit = plan.plan.semesters[capstoneSemIdx].units[capstoneUnitIdx];

  // Build lookup maps
  const unitAvail = new Map(catalogue.units.map(u => [u.code, u.availability]));
  const unitPrereqs = new Map(catalogue.units.map(u => [u.code, u.prerequisites]));
  const lastSemLabel = lastSem.label.match(/S([12])/i);
  const lastTerm = lastSemLabel ? `S${lastSemLabel[1]}` : 'S2';

  // Try 1: Find a unit in the last semester that can swap to the capstone's position
  const swapCandidateIdx = lastSem.units.findIndex(u => {
    if (u.code === 'CITS5206') return false;
    const avail = unitAvail.get(u.code);
    // Check availability in capstone's original semester
    const capSemLabel = plan.plan.semesters[capstoneSemIdx].label.match(/S([12])/i);
    const capTerm = capSemLabel ? `S${capSemLabel[1]}` : 'S1';
    if (avail && avail.length > 0 && !avail.includes(capTerm)) return false;
    // Check prereqs: unit's prereqs must be before capstone's original semester
    const prereqs = unitPrereqs.get(u.code) || [];
    return prereqs.every(p => {
      const pi = plan.plan.semesters.findIndex(s => s.units.some(su => su.code === p));
      return pi === -1 || pi < capstoneSemIdx;
    });
  });

  if (swapCandidateIdx >= 0) {
    const swapUnit = lastSem.units[swapCandidateIdx];
    plan.plan.semesters[capstoneSemIdx].units[capstoneUnitIdx] = swapUnit;
    lastSem.units[swapCandidateIdx] = capstoneUnit;
    console.log(`[aiPlanner] Capstone fix: swapped CITS5206 S${capstoneSemIdx + 1}→S${lastSemIdx + 1} ↔ ${swapUnit.code} S${lastSemIdx + 1}→S${capstoneSemIdx + 1}`);
    return { plan, fixed: true, warnings };
  }

  // Try 2: No compatible swap — forcibly move CITS5206 to last semester, move a unit back
  const forceSwapIdx = lastSem.units.findIndex(u => u.code !== 'CITS5206' && u.code !== 'CITS5015');
  if (forceSwapIdx >= 0) {
    const forceSwapUnit = lastSem.units[forceSwapIdx];
    plan.plan.semesters[capstoneSemIdx].units[capstoneUnitIdx] = forceSwapUnit;
    lastSem.units[forceSwapIdx] = capstoneUnit;
    warnings.push(`CITS5206 was in S${capstoneSemIdx + 1} — forcibly moved to S${lastSemIdx + 1}. ${forceSwapUnit.code} moved to S${capstoneSemIdx + 1}.`);
    console.log(`[aiPlanner] Capstone fix (forced): swapped CITS5206 S${capstoneSemIdx + 1}→S${lastSemIdx + 1} ↔ ${forceSwapUnit.code}`);
    return { plan, fixed: true, warnings };
  }

  // Try 3: Last resort — just move CITS5206, don't swap
  const moved = plan.plan.semesters[capstoneSemIdx].units.splice(capstoneUnitIdx, 1)[0];
  lastSem.units.push(moved);
  warnings.push(`CITS5206 was in S${capstoneSemIdx + 1} — forcibly moved to S${lastSemIdx + 1} without swap (last semester now has ${lastSem.units.length} units).`);
  console.log(`[aiPlanner] Capstone fix (last resort): moved CITS5206 S${capstoneSemIdx + 1}→S${lastSemIdx + 1}`);
  return { plan, fixed: true, warnings };
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

      // ── Step 5.5c: Capstone Position Fix ─────────────────────────────
      // CITS5206 MUST be in the very last semester. AI often ignores this.
      // Run BEFORE workload balance since moving capstone changes per-semester counts.
      const { fixed: capstoneFixed, warnings: capstoneWarnings } = fixCapstonePosition(aiPlan, catalogue);
      if (capstoneFixed) {
        console.log('[aiPlanner] CITS5206 capstone repositioned to final semester');
        if (capstoneWarnings.length > 0) {
          aiPlan.warnings.push(...capstoneWarnings);
        }
        // Capstone move may affect availability — re-check
        const { fixes: availFixesCap } = fixAvailabilityViolations(aiPlan, catalogue);
        if (availFixesCap > 0) console.log(`[aiPlanner] Fixed ${availFixesCap} availability issues after capstone repositioning`);
        validation = await validateAiGeneratedPlan(aiPlan, input.programCode, input.completedUnits || [], input.specialisation);
        aiPlan.warnings.push('Capstone (CITS5206) programmatically repositioned to final semester.');
      }

      // ── Step 5.5d: Workload Balance Fix ──────────────────────────────
      // AI often creates uneven semesters (e.g. 2-6-4-4 instead of 4-4-4-4).
      // Redistribute units to match the requested units-per-semester target.
      const { fixes: balanceFixes, warnings: balanceWarnings } = fixWorkloadBalance(
        aiPlan, input, catalogue,
      );
      if (balanceFixes > 0) {
        console.log(`[aiPlanner] Fixed ${balanceFixes} workload imbalance(s) — redistributed across ${input.preferredSemesterCount} semesters`);
        // Balancing may create availability or prereq violations — re-fix
        const { fixes: availFixes3 } = fixAvailabilityViolations(aiPlan, catalogue);
        if (availFixes3 > 0) console.log(`[aiPlanner] Re-fixed ${availFixes3} availability violations after workload balance`);
        validation = await validateAiGeneratedPlan(aiPlan, input.programCode, input.completedUnits || [], input.specialisation);
        if (balanceWarnings.length > 0) {
          aiPlan.warnings.push(...balanceWarnings);
        }
        aiPlan.warnings.push(`Workload balanced: ${balanceFixes} unit(s) redistributed for even ${input.unitsPerSemester}-per-semester distribution.`);
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
