"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateStudyPlan = generateStudyPlan;
const openai_1 = __importDefault(require("openai"));
const promptBuilder_1 = require("./promptBuilder");
const responseParser_1 = require("./responseParser");
const mockCatalogue_1 = require("./mockCatalogue");
const databaseCatalogue_1 = require("./databaseCatalogue");
const planSchema_1 = require("./planSchema");
const fallbackPlans_1 = require("./fallbackPlans");
const planValidationService_1 = require("../validation/planValidationService");
const abuseDetector_1 = require("./abuseDetector");
const tokenTracker_1 = require("./tokenTracker");
const DEFAULT_MODEL = 'deepseek-chat';
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1000;
function getApiKey() {
    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
    if (!apiKey) {
        throw new Error('Missing API key. Set DEEPSEEK_API_KEY or OPENAI_API_KEY in your environment.');
    }
    return apiKey;
}
function createClient() {
    return new openai_1.default({
        apiKey: getApiKey(),
        baseURL: 'https://api.deepseek.com/v1',
        timeout: 120000,
        maxRetries: 2,
    });
}
function getModelName() {
    return process.env.DEEPSEEK_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL;
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function requestPlanFromModel(systemPrompt, userPrompt) {
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
    });
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
function fixPrerequisiteSemesters(response) {
    const semesters = response.plan.semesters;
    if (semesters.length <= 1)
        return response;
    // Build a map: unitCode → sequence number
    const unitSemester = new Map();
    for (const sem of semesters) {
        for (const unit of sem.units) {
            unitSemester.set(unit.code, sem.sequence);
        }
    }
    const unitPrereqs = new Map();
    // Minimum semester sequence per unit (for point-based or other non-unit prereqs)
    const minSequence = { 'CITS4009': 3 };
    let fixed = false;
    const MAX_UNITS_PER_SEMESTER = 4;
    const MAX_ITERATIONS = 10;
    let iterations = 0;
    // Repeat until all violations are fixed or max iterations reached
    while (!fixed && iterations < MAX_ITERATIONS) {
        fixed = true;
        iterations++;
        for (const sem of semesters) {
            const unitsToMove = [];
            const keptUnits = [];
            for (const unit of sem.units) {
                const prereqs = unitPrereqs.get(unit.code) ?? [];
                let hasViolation = false;
                for (const prereqCode of prereqs) {
                    const prereqSeq = unitSemester.get(prereqCode);
                    if (prereqSeq === undefined)
                        continue;
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
                }
                else {
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
const UNIT_AVAILABILITY = {
    'CITS1003': ['S1', 'S2'], 'CITS1401': ['S1', 'S2'], 'CITS1402': ['S1', 'S2'],
    'CITS5014': ['S1', 'S2'], 'CITS5015': ['S1', 'S2'], 'CITS5206': ['S1', 'S2'],
    'INMT5518': ['S1', 'S2'], 'INMT5526': ['S1', 'S2'], 'MGMT5504': ['S1', 'S2'],
    'PHIL4100': ['S1', 'S2'], 'SVLG5001': ['S1', 'S2'],
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
function fixAvailability(semesters, response) {
    // Swap-based: find S1-only units in S2 semesters and swap with S2-only units in S1 semesters
    for (const sem of semesters) {
        const termInLabel = sem.label.includes('S1') ? 'S1' : sem.label.includes('S2') ? 'S2' : null;
        if (!termInLabel)
            continue;
        const oppositeTerm = termInLabel === 'S1' ? 'S2' : 'S1';
        for (const unit of [...sem.units]) {
            const avail = UNIT_AVAILABILITY[unit.code];
            if (!avail || avail.length >= 2)
                continue; // both or unknown = fine
            if (avail.includes(termInLabel))
                continue; // correctly placed
            // Unit is in wrong term, find a swap candidate
            for (const target of semesters) {
                if (target.sequence === sem.sequence)
                    continue;
                const targetLabel = target.label.includes('S1') ? 'S1' : target.label.includes('S2') ? 'S2' : null;
                if (targetLabel !== oppositeTerm)
                    continue;
                for (const targetUnit of [...target.units]) {
                    const tAvail = UNIT_AVAILABILITY[targetUnit.code];
                    if (!tAvail || tAvail.length >= 2)
                        continue;
                    if (!tAvail.includes(termInLabel))
                        continue;
                    // Swap units
                    sem.units = sem.units.filter(u => u.code !== unit.code);
                    target.units = target.units.filter(u => u.code !== targetUnit.code);
                    sem.units.push(targetUnit);
                    target.units.push(unit);
                    break;
                }
            }
        }
    }
}
/** Post-generation sanitise: dedup, research pair validation. */
function sanitizePlan(response) {
    // Dedup: remove duplicate unit codes
    const seenCodes = new Set();
    let dedupCount = 0;
    for (const sem of response.plan.semesters) {
        const kept = [];
        for (const unit of sem.units) {
            if (!seenCodes.has(unit.code)) {
                seenCodes.add(unit.code);
                kept.push(unit);
            }
            else {
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
        response.warnings.push(`Dropped research project: CITS5014 placed in semester ${semWith5014.sequence} (needs ≥3). Both CITS5014 and CITS5015 removed.`);
    }
    // Research pair: all-or-nothing
    const has5014 = response.plan.semesters.some(s => s.units.some(u => u.code === 'CITS5014'));
    const has5015 = response.plan.semesters.some(s => s.units.some(u => u.code === 'CITS5015'));
    if (has5014 !== has5015) {
        for (const sem of response.plan.semesters) {
            sem.units = sem.units.filter(u => u.code !== 'CITS5014' && u.code !== 'CITS5015');
        }
        response.warnings.push(`Dropped research project: only one of CITS5014/CITS5015 included (bound pair required). Both removed.`);
    }
}
async function generateStudyPlan(input) {
    // Abuse detection
    const abuseResult = (0, abuseDetector_1.detectAbuse)(input.userMessage);
    if (abuseResult.isAbuse) {
        throw Object.assign(new Error(abuseResult.reason), { status: 400, abuseCategory: abuseResult.category });
    }
    // Fast path: use precomputed official plan for standard requests (< 1 second)
    const hasCustomRequest = /easy|hard|difficult|light|heavy|challeng|specific|want|need|prefer|avoid|only|custom/i.test(input.userMessage);
    if (!hasCustomRequest) {
        const fastPlan = (0, fallbackPlans_1.getFallbackPlan)(input.programCode, input.specialisation);
        if (fastPlan) {
            // Adjust semester count to match user request if needed
            const requestedSemesters = input.preferredSemesterCount || 4;
            if (requestedSemesters !== 4 && fastPlan.plan.semesters.length !== requestedSemesters) {
                // Fall through to AI for non-standard semester counts
            }
            else {
                fastPlan.generatedAt = new Date().toISOString();
                fastPlan.warnings.push('⚡ Instant plan — generated from official UWA template.');
                return fastPlan;
            }
        }
    }
    let catalogue = await (0, databaseCatalogue_1.getProgrammeCatalogueFromDb)(input.programCode)
        ?? (0, mockCatalogue_1.getMockProgrammeCatalogue)(input.programCode);
    if (!catalogue) {
        throw new Error(`No catalogue configured for programme ${input.programCode}`);
    }
    // Build a rich user message that includes all context
    const userMessage = buildRichUserMessage(input);
    const { system, user } = (0, promptBuilder_1.buildPlannerPrompt)(userMessage, catalogue, input.specialisation);
    // DEBUG: dump prompt to inspect prerequisite data quality
    const fs = require('fs');
    fs.writeFileSync('/tmp/last_ai_prompt.txt', `=== SYSTEM PROMPT ===
${system}

=== USER PROMPT ===
${user}`);
    console.log('[aiPlanner] Prompt saved to /tmp/last_ai_prompt.txt, system:', system.length, 'chars, user:', user.length, 'chars');
    // Rate limiting: estimate tokens conservatively
    const estimatedTokens = userMessage.length + user.length + system.length;
    const rateCheck = await (0, tokenTracker_1.checkRateLimit)(estimatedTokens + 8000);
    if (!rateCheck.allowed && catalogue) {
        console.warn(`[aiPlanner] Rate limited (${rateCheck.reason}) — using deterministic fallback`);
        try {
            const fallback = (0, fallbackPlans_1.buildDeterministicPlan)(catalogue, input.specialisation);
            fallback.warnings.push(`AI skipped due to rate limit: ${rateCheck.reason}`);
            (0, fallbackPlans_1.registerFallbackPlan)(input.programCode, fallback);
            return fallback;
        }
        catch (fbErr) {
            console.error('[aiPlanner] Fallback also failed:', fbErr);
        }
    }
    if (!rateCheck.allowed) {
        throw Object.assign(new Error(rateCheck.reason ?? 'Daily rate limit reached.'), {
            status: 429,
            dailyTokensRemaining: rateCheck.dailyTokensRemaining,
            dailyRequestsRemaining: rateCheck.dailyRequestsRemaining,
        });
    }
    let lastErrorMessage = 'No response produced.';
    let totalTokensUsed = 0;
    const startTime = Date.now();
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
            const { content: raw, usage } = await requestPlanFromModel(system, user);
            if (usage) {
                totalTokensUsed = usage.totalTokens;
            }
            const jsonText = (0, responseParser_1.extractJsonFromModelOutput)(raw);
            console.log('[aiPlanner] Raw response (first 2000 chars):', raw.substring(0, 2000));
            console.log('[aiPlanner] Extracted JSON (last 200 chars):', jsonText.substring(Math.max(0, jsonText.length - 200)));
            // Save full JSON for debugging
            const fs = require('fs');
            fs.writeFileSync('/tmp/last_ai_plan.json', jsonText);
            console.log('[aiPlanner] Saved JSON to /tmp/last_ai_plan.json, length:', jsonText.length);
            let parsed;
            try {
                parsed = JSON.parse(jsonText);
            }
            catch (parseErr) {
                console.error('[aiPlanner] JSON parse failed:', parseErr instanceof Error ? parseErr.message : parseErr);
                console.error('[aiPlanner] JSON text (first 500):', jsonText.substring(0, 500));
                throw new Error(`JSON parse error: ${parseErr instanceof Error ? parseErr.message : 'Unknown'}`);
            }
            if (!(0, planSchema_1.validateStudyPlanShape)(parsed)) {
                console.error('[aiPlanner] Schema validation failed. Keys:', Object.keys(parsed));
                const p = parsed;
                if (p.plan) {
                    console.error('[aiPlanner] explanation.overview:', typeof p.explanation?.overview, p.explanation?.overview?.substring?.(0, 50));
                    console.error('[aiPlanner] explanation.electiveRationales is array:', Array.isArray(p.explanation?.electiveRationales));
                    if (Array.isArray(p.explanation?.electiveRationales)) {
                        console.error('[aiPlanner] electiveRationales types:', p.explanation.electiveRationales.map((x) => typeof x));
                    }
                    console.error('[aiPlanner] constraintsAcknowledged is array:', Array.isArray(p.constraintsAcknowledged));
                    if (Array.isArray(p.constraintsAcknowledged)) {
                        console.error('[aiPlanner] constraintsAcknowledged types:', p.constraintsAcknowledged.map((x) => typeof x).slice(0, 5));
                    }
                    console.error('[aiPlanner] warnings is array:', Array.isArray(p.warnings));
                    if (Array.isArray(p.warnings)) {
                        console.error('[aiPlanner] warnings types:', p.warnings.map((x) => typeof x).slice(0, 5));
                    }
                    // Check unit types in first semester
                    if (p.plan.semesters?.[0]?.units) {
                        const u = p.plan.semesters[0].units[0];
                        console.error('[aiPlanner] First unit:', JSON.stringify(u));
                    }
                }
                throw new Error('Generated JSON does not match the expected study plan schema.');
            }
            const response = parsed;
            sanitizePlan(response);
            // Enhance with metadata
            response.generatedAt = new Date().toISOString();
            // Post-generation validation: if AI plan has failures, use deterministic fallback
            if (catalogue) {
                try {
                    const plannedUnits = response.plan.semesters.flatMap(s => s.units.map(u => u.code));
                    const validationResult = await (0, planValidationService_1.validatePlan)({
                        courseCode: input.programCode,
                        completedUnits: input.completedUnits || [],
                        selectedSpecialisations: input.specialisation ? [input.specialisation] : [],
                        plan: response.plan.semesters.map((s, i) => ({
                            sequence: s.sequence || i + 1,
                            year: 2026 + Math.floor((i) / 2),
                            term: i % 2 === 0 ? 'S1' : 'S2',
                            units: s.units.map(u => u.code),
                        })),
                    });
                    const failCount = validationResult.issues.filter(i => i.severity === 'fail').length;
                    const warnCount = validationResult.issues.filter(i => i.severity === 'warning').length;
                    if (failCount > 2) {
                        console.warn(`[aiPlanner] AI plan has ${failCount} failures + ${warnCount} warnings — using fallback`);
                        const fallback = (0, fallbackPlans_1.buildDeterministicPlan)(catalogue, input.specialisation);
                        sanitizePlan(fallback);
                        fallback.warnings.push(`AI-generated plan had ${failCount} validation failures and was replaced by a deterministic fallback.`);
                        (0, fallbackPlans_1.registerFallbackPlan)(input.programCode, fallback);
                        await (0, tokenTracker_1.recordTokenUsage)(totalTokensUsed || (userMessage.length + user.length + system.length));
                        return fallback;
                    }
                }
                catch (valErr) {
                    console.warn('[aiPlanner] Post-validation error, keeping AI plan:', valErr);
                }
            }
            // Apply post-generation prerequisite fixes
            await (0, tokenTracker_1.recordTokenUsage)(totalTokensUsed || (userMessage.length + user.length + system.length));
            return response;
        }
        catch (error) {
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
            const fallback = (0, fallbackPlans_1.buildDeterministicPlan)(catalogue, input.specialisation);
            sanitizePlan(fallback);
            fallback.warnings.push(`AI generation failed after ${MAX_ATTEMPTS} attempts (${elapsed}s): ${lastErrorMessage}`);
            fallback.warnings.push('This is a deterministically-generated FALLBACK plan.');
            (0, fallbackPlans_1.registerFallbackPlan)(input.programCode, fallback);
            return fallback;
        }
        catch (fallbackErr) {
            console.error('[aiPlanner] Fallback plan generation also failed:', fallbackErr);
        }
    }
    throw new Error(`Study plan generation failed after ${MAX_ATTEMPTS} attempts (${elapsed}s): ${lastErrorMessage}`);
}
function buildRichUserMessage(input) {
    const lines = [];
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
