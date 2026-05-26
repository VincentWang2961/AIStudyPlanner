import { ProgramCatalogue, SpecialisationInfo } from './types';
import * as fs from 'fs';
import * as path from 'path';

// ─── Helpers ────────────────────────────────────────────────────────────────

function serialiseUnits(catalogue: ProgramCatalogue): string {
  return catalogue.units
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((unit) => {
      const level = unit.code.match(/^[A-Z]{4}(\d)/)?.[1] ?? '?';
      const difficulty = { '1': 'Introductory', '2': 'Intermediate', '4': 'Advanced', '5': 'Postgraduate' }[level] || `Level ${level}`;
      const prereqs = unit.prerequisites.length > 0 ? unit.prerequisites.join(', ') : 'None';
      const incs = unit.incompatibilities.length > 0 ? `Incompatible with: ${unit.incompatibilities.join(', ')}` : '';
      const coreqs = unit.corequisites.length > 0 ? `Corequisites: ${unit.corequisites.join(', ')}` : '';
      const avail = unit.availability.length > 0 ? `Offered: ${unit.availability.join(', ')}` : 'Availability unknown';
      return [
        `- ${unit.code}: ${unit.title} (${unit.type}, ${unit.creditPoints}pts, ${difficulty})`,
        `  ${avail}`,
        `  Prerequisites: ${prereqs}`,
        coreqs ? `  ${coreqs}` : '',
        incs ? `  ${incs}` : '',
        `  ${unit.description}`,
      ].filter(Boolean).join('\n');
    })
    .join('\n\n');
}

function serialiseConstraints(catalogue: ProgramCatalogue): string {
  return catalogue.constraints
    .sort((a, b) => {
      const order = { mandatory: 0, preferred: 1, informational: 2 };
      return order[a.priority] - order[b.priority];
    })
    .map((c) => `  [${c.priority.toUpperCase()}] ${c.code}: ${c.description}`)
    .join('\n');
}

function serialiseSpecialisations(specs: SpecialisationInfo[]): string {
  if (specs.length === 0) return 'No specialisations available for this programme.';
  return specs
    .map((spec) => {
      const cores = spec.coreUnits.length > 0
        ? `    Core units: ${spec.coreUnits.join(', ')}`
        : '    No specific core units assigned';
      const electives = spec.electiveOptions.length > 0
        ? `    Elective options: ${spec.electiveOptions.join(', ')}`
        : '    No elective options listed';
      return [
        `- ${spec.name} (${spec.code})`,
        `  ${spec.description}`,
        cores,
        electives,
      ].join('\n');
    })
    .join('\n\n');
}

function serialiseAvailabilityMap(catalogue: ProgramCatalogue): string {
  const s1Only: string[] = [];
  const s2Only: string[] = [];
  const both: string[] = [];
  const unknown: string[] = [];

  for (const unit of catalogue.units) {
    if (unit.availability.length === 0) {
      unknown.push(unit.code);
    } else if (unit.availability.length === 1) {
      if (unit.availability[0].toUpperCase() === 'S1') s1Only.push(unit.code);
      else if (unit.availability[0].toUpperCase() === 'S2') s2Only.push(unit.code);
      else unknown.push(unit.code);
    } else {
      both.push(unit.code);
    }
  }

  const lines: string[] = [];
  lines.push('## ⚠️ AVAILABILITY MAP — SEMESTER PLACEMENT RULES');
  lines.push('');
  lines.push('**These units can ONLY be placed in S1:**');
  lines.push(s1Only.length > 0 ? `  ${s1Only.join(', ')}` : '  (none)');
  lines.push('');
  lines.push('**These units can ONLY be placed in S2:**');
  lines.push(s2Only.length > 0 ? `  ${s2Only.join(', ')}` : '  (none)');
  lines.push('');
  lines.push('**These units are offered in BOTH S1 and S2:**');
  lines.push(both.length > 0 ? `  ${both.join(', ')}` : '  (none)');
  if (unknown.length > 0) {
    lines.push('');
    lines.push(`**Unknown availability** (assume both S1/S2): ${unknown.join(', ')}`);
  }
  lines.push('');
  lines.push('**CRITICAL: You MUST NOT place an S1-only unit in an S2 semester, or an S2-only unit in an S1 semester. Check EVERY unit in EVERY semester against this map.**');
  lines.push('');

  return lines.join('\n');
}

// ─── Few-shot example ──────────────────────────────────────────────────────


// ─── Official UWA MIT study plan templates ─────────────────────────────────
// These are real UWA-recommended 2-year plans (S1 start).

const OFFICIAL_PLAN_TEMPLATES = [
  { specialisation: "None", semesters: [
    { label: "S1 2026", units: ["CITS1401", "CITS1003", "CITS1402", "PHIL4100"] },
    { label: "S2 2026", units: ["CITS2002", "CITS4009", "CITS4012", "CITS4403"] },
    { label: "S1 2027", units: ["CITS4401", "CITS5505", "CITS5508", "CITS4402"] },
    { label: "S2 2027", units: ["CITS5206", "CITS5017", "CITS5503", "CITS5501"] },
  ]},
  { specialisation: "Applied Computing", semesters: [
    { label: "S1 2026", units: ["CITS1401", "CITS1003", "CITS1402", "PHIL4100"] },
    { label: "S2 2026", units: ["CITS2002", "CITS4012", "CITS4009", "CITS4403"] },
    { label: "S1 2027", units: ["CITS4401", "CITS5505", "CITS5508", "CITS5506"] },
    { label: "S2 2027", units: ["CITS5206", "CITS5507", "CITS5503", "SVLG5001"] },
  ]},
  { specialisation: "Artificial Intelligence", semesters: [
    { label: "S1 2026", units: ["CITS1401", "CITS1003", "CITS1402", "PHIL4100"] },
    { label: "S2 2026", units: ["CITS2002", "CITS4012", "CITS4403", "MGMT5504"] },
    { label: "S1 2027", units: ["CITS4401", "CITS5505", "CITS5508", "CITS4404"] },
    { label: "S2 2027", units: ["CITS5206", "CITS5017", "CITS5503", "CITS5507"] },
  ]},
  { specialisation: "Software Systems", semesters: [
    { label: "S1 2026", units: ["CITS1401", "CITS1003", "CITS1402", "PHIL4100"] },
    { label: "S2 2026", units: ["CITS2002", "CITS4009", "CITS4403", "MGMT5504"] },
    { label: "S1 2027", units: ["CITS4401", "CITS5505", "CITS5506", "CITS5504"] },
    { label: "S2 2027", units: ["CITS5206", "CITS5507", "CITS5501", "CITS5503"] },
  ]},
];

function buildOfficialPlanReference(focusArea?: string): string {
  const lines: string[] = [];
  lines.push("## Official UWA MIT Study Plan Reference (2-year, S1 start)");
  lines.push("");
  lines.push("Real UWA-recommended structures. Follow these patterns:");
  lines.push("⚠️ NOTE: Many units in these templates are Postgraduate (L5) level. If the student asks for EASY/LIGHT units, DEVIATE from this template and prefer Advanced (L4) alternatives and INMT/MGMT/SVLG electives.");
  lines.push("- S1 2026 ALWAYS: CITS1401 + CITS1003 + CITS1402 + PHIL4100");
  lines.push("- S2 2026 ALWAYS includes CITS2002 (conversion, ONLY one)");
  lines.push("- S1 2027 ALWAYS: CITS4401 + CITS5505");
  lines.push("- S2 2027 ALWAYS: CITS5206 capstone (LAST semester)");
  lines.push("- PHIL4100 is COMPULSORY in S1 2026");
  lines.push("");
  const matching = OFFICIAL_PLAN_TEMPLATES.filter(t =>
    !focusArea || t.specialisation.toLowerCase() === focusArea.toLowerCase()
  );
  for (const tpl of matching.slice(0, 2)) {
    lines.push("### " + tpl.specialisation);
    for (const sem of tpl.semesters) {
      lines.push("  " + sem.label + ": " + sem.units.join(", "));
    }
    lines.push("");
  }
  return lines.join("\n");
}


// ─── Main prompt builder ───────────────────────────────────────────────────

export function buildSystemPrompt(): string {
  return [
    'You are an expert university academic planning assistant specialising in UWA (University of Western Australia) course advisement.',
    'Your role is to generate structured, accurate, and contextually aware study plans using official course catalogue data.',
    '',
    '## ⭐ CONSTRAINT PRIORITY SYSTEM (MUST FOLLOW)',
    '',
    'When student requirements conflict (not all can fit within semester/availability constraints), resolve conflicts using this LAYERED priority:',
    '',
    '**🔒 Layer 1 — GRADUATION CORE (NON-NEGOTIABLE):** Mandatory core units required to graduate. These MUST be included in EVERY plan, no exceptions. Includes: all CORE-typed units, milestone units (PHIL4100), capstone (CITS5206).',
    '',
    '**🎯 Layer 2 — BROAD INTERESTS (SHOULD satisfy):** Vague/general student preferences like "study AI", "focus on cloud", "prefer easy units". These describe a DIRECTION — fill remaining slots with units aligned to this interest. If a specialisation is selected, include its core units here.',
    '',
    '**💬 Layer 3 — SPECIFIC REQUESTS (BEST-EFFORT, ALL-OR-NOTHING):** Explicit unit requests like "do research" (→ CITS5014/CITS5015), "take CITS5508", or named electives. These are NICE-TO-HAVE. If they conflict with Layer 1 or Layer 2 constraints, DROP them COMPLETELY and fill the freed slots with appropriate alternative units. **CRITICAL: ALL-OR-NOTHING rule — if a request involves MULTIPLE units (e.g. CITS5014+CITS5015 research pair, or a unit+its prerequisite), either include ALL of them or NONE of them. NEVER include only half of a paired requirement. NEVER include a dependent without its prerequisite.**',
    '',
    '**🔴 UNREASONABLE REQUESTS (IGNORE + WARN):** Requests that violate basic rules (capstone in S1, unit without prerequisite, wrong availability semester) must be IGNORED. Add a warning: "Dropped [request]: [reason]."',
    '',
    '**Resolution rule:** Layer 1 ALWAYS wins. Try to satisfy Layer 2 fully, then Layer 3 with remaining slots. If Layer 3 requests conflict with Layer 1 or Layer 2, **completely drop Layer 3** and fill the freed slots with appropriate electives — do NOT partially satisfy Layer 3. If Layer 2 conflicts with Layer 1, sacrifice Layer 2 and warn. Always warn about what was dropped and why.',
    '',
    '**Key insight:** The 3rd semester is typically the busiest — many core and specialisation units become available after foundation prerequisites are met. Count S1-only and S2-only units for that semester carefully. If more candidates than slots, sacrifice lowest-priority ones and explain the tradeoff.',
    '',
    '## Core Principles',
    '',
    '0. **UNIT LEVEL (Difficulty)**: Introductory (L1) < Intermediate (L2) < Advanced (L4) < Postgraduate (L5, hardest). If the student asks for easy units: (a) fill S1 with L1/L2 foundation units, (b) for remaining slots prefer L4 Advanced over L5 Postgraduate, (c) use INMT/MGMT/SVLG electives which are typically easier than CITS L5 units. MIT is a postgraduate degree so some L4/L5 units are unavoidable — just choose the lighter ones.',
    '1. ⛔ **PREREQUISITES ARE NON-NEGOTIABLE**: A unit and ALL of its prerequisites MUST be in EARLIER semesters. A prerequisite CANNOT be in the same semester as its dependent.',
    '2. **Availability STRICT compliance** — use the AVAILABILITY MAP. S1-only units MUST go in S1. S2-only units MUST go in S2. NO EXCEPTIONS.',
    '3. **Core-first sequencing** — prioritise core/compulsory units early IF available according to availability rules. Some core units are available in BOTH S1 and S2 — place them in the less congested semester to free slots.',
    '4. **Specialisation fidelity** — if a specialisation is specified, ensure all its core units are included.',
    '5. **Incompatibility checking** — never place incompatible units in the same plan.',
    '6. **Flexible unit placement** — units available in BOTH semesters can be moved freely to balance load and free space for single-semester-only units.',
    '',
    '## ⛔ COMMON ERRORS — CHECK THESE BEFORE OUTPUTTING',
    '',
    '❌ Prerequisite in same semester as dependent → WRONG. Prerequisites MUST be in EARLIER semesters.',
    '❌ Unit placed in wrong availability semester → WRONG. S1-only → S1, S2-only → S2. No exceptions.',
    '❌ Overloading a semester with 5+ units → WRONG. Only 4 slots exist per semester.',
    '❌ ANY semester with >4 units → WRONG. Every semester MUST have EXACTLY 4 or FEWER units. Count before outputting.',
    '❌ Duplicate unit code in plan → WRONG. Each unit code can appear AT MOST ONCE across all semesters.',
    '❌ Missing mandatory core unit → WRONG. Check programme constraints for required units.',
    '❌ Partial Layer 3 fulfillment → WRONG. Drop conflicting requests COMPLETELY, do not include half.',
    '❌ Bound pair broken (e.g. research project, capstone, prerequisite chains) → WRONG. All-or-nothing.',
    '⛔ **NO EXTRA SEMESTERS:** Do NOT create additional semesters to squeeze in Layer 3 requests. Drop and warn instead.',
    '',
    '## Reasoning Process',
    '',
    '**Step 1 — Identify mandatory Layer 1 units**',
    'List all CORE-typed units, PHIL4100, CITS5206. These WILL be in the plan.',
    '',
    '**Step 2 — Map prerequisites for ALL candidate units**',
    'Build a dependency graph. Every prerequisite must go in an EARLIER semester.',
    '',
    '**Step 3 — CAPACITY PLANNING (MANDATORY — DO THE MATH)**',
    '',
    'Each semester has EXACTLY 4 slots. NO EXCEPTIONS. Count EVERY semester before outputting.',
    '',
    'For the busiest semester (usually the 3rd), list ALL candidates. Sort by priority: 🔒 Layer 1 first, then 🎯 Layer 2, then 💬 Layer 3. Take the top 4. Drop the rest. Add warnings for dropped items.',
    '',
    '**GENERAL RULE:** For EVERY semester, list ALL candidates BEFORE placing. Sort by priority layer. Take the top 4. Drop the rest. Add warnings for dropped items.',
    '',
    '**Step 4 — Apply priority layers with explicit slot counting**',
    'For EACH semester, count slots as you fill them. Start with Layer 1 (count → 2-3 slots). Then Layer 2 (count → 3-4 slots). If count reaches 4, STOP. All Layer 3 requests that cannot fit are DROPPED.',
    '',
    '**Step 5 — Balance with flexible units**',
    'Use PHIL4100 (S1+S2), CITS5507 (S2), CITS4403 (S2), CITS5503 (S2) as flexible fillers. Move PHIL4100 to S2 if S1 needs all 4 slots for S1-only units.',
    '',
    '**Step 6 — FINAL VERIFICATION (DO NOT SKIP)**',
    'For EVERY semester, count the units. If ANY semester has > 4 units, your plan is INVALID — go back and fix it. Also verify: (1) each unit code appears AT MOST ONCE across all semesters, (2) prerequisites satisfied, (3) no incompatibilities, (4) availability correct.',
    '',
    '**Step 7 — Tradeoff warnings**',
    'If Layer 2 or Layer 3 items were dropped, ADD a warning explaining the tradeoff: "Could not include [unit/interest] due to [reason]. Prioritised [what was kept] instead. Consider extending to 5 semesters if you need all requirements."',
    '',
    '## Important Guidelines',
    '',
    '- The JSON output must be valid and parseable.',
    '- All unit codes in the output must match codes from the catalogue exactly.',
    '- ⛔ **PREREQUISITE RULE: prerequisite CANNOT be in the same semester as its dependent.**',
    '- ⛔ **Mandatory core units CANNOT be skipped — check programme constraints for the full list.**',
    '- **CHECK AVAILABILITY MAP. S1-only → S1. S2-only → S2. No exceptions.**',
    '- If a unit has an incompatibility, do NOT include the incompatible unit.',
    '- **CAPSTONE (CITS5206): MUST be in the FINAL semester. Fill remaining 3 slots normally.**',
    '- **When conflicts arise, use the CONSTRAINT PRIORITY SYSTEM above.**',
    '- **ALWAYS add warnings for dropped requirements — transparency to the student is essential.**',
    '- Use British English spelling throughout.',
    '- Write in a professional but approachable academic advising tone.',
  ].join('\n');
}

function buildUserPromptPart(userMessage: string, catalogue: ProgramCatalogue, focusArea?: string): string {
  const parts: string[] = [];

  // Student request
  parts.push('## Student Request');
  parts.push(userMessage);
  parts.push('');

  // Programme context
  parts.push('## Programme Context');
  parts.push(`- Programme: ${catalogue.programName} (${catalogue.programCode})`);
  parts.push(`- Target credit points: ${catalogue.totalCreditPoints}`);
  parts.push(`- Default load: ${catalogue.defaultUnitsPerSemester} units per semester`);
  parts.push(`- Available units in catalogue: ${catalogue.units.length}`);
  if (focusArea) {
    parts.push(`- **Selected specialisation: ${focusArea}**`);
  }
  parts.push('');

  // ── Specialisation Lock (when a focus area is selected) ──
  if (focusArea) {
    const matchedSpec = catalogue.specialisations.find(
      (s) => s.name.toLowerCase() === focusArea.toLowerCase() || s.code.toLowerCase() === focusArea.toLowerCase()
    );
    if (matchedSpec) {
      parts.push('## 🔒 SPECIALISATION LOCK — READ CAREFULLY');
      parts.push('');
      parts.push(`The student has selected: **${matchedSpec.name}** (${matchedSpec.code}).`);
      parts.push('');
      if (matchedSpec.coreUnits.length > 0) {
        parts.push(`**Specialisation core units (MUST include all):** ${matchedSpec.coreUnits.join(', ')}`);
      }
      if (matchedSpec.electiveOptions.length > 0) {
        parts.push(`**Specialisation elective options (choose from these):** ${matchedSpec.electiveOptions.join(', ')}`);
      }
      parts.push('');
      parts.push('**CRITICAL RULES:**');
      parts.push('1. You MUST include ALL specialisation core units in the plan.');
      parts.push('2. For elective slots beyond core/specialisation requirements, choose units that ALIGN with this specialisation.');
      parts.push('3. DO NOT include units that are core units of OTHER specialisations unless they are also general core units.');
      parts.push('4. If the student requests a focus (e.g. cloud, DevOps, software architecture), prioritise specialisation electives that match that focus.');
      parts.push('5. Avoid units that are clearly designed for a different specialisation track (e.g. no NLP/Deep Learning for Software Systems unless it is a general elective).');
      parts.push('6. **CAPSTONE (CITS5206): MUST be in the final semester. Fill the remaining 3 slots with regular units — do NOT leave the final semester with only the capstone.**');
      parts.push('');
    }
  }
  parts.push('');

  // Official UWA plan reference
  parts.push(buildOfficialPlanReference(focusArea));

  // Specialisations
  parts.push('## Available Specialisations');
  parts.push(serialiseSpecialisations(catalogue.specialisations));
  parts.push('');

  // Constraints
  parts.push('## Programme Constraints (ordered by priority)');
  parts.push(serialiseConstraints(catalogue));
  parts.push('');

  // ── Availability Map ──
  parts.push(serialiseAvailabilityMap(catalogue));

  // Full unit catalogue
  parts.push('## Available Units');
  parts.push(serialiseUnits(catalogue));
  parts.push('');

  return parts.join('\n');
}

function buildOutputSpec(): string {
  return [
    '## Output Specification',
    '',
    'Return ONLY valid JSON with this exact structure — no markdown fences, no additional text outside the JSON object:',
    '',
    '{',
    '  "version": "1.0",',
    '  "generatedAt": "<ISO-8601 timestamp>",',
    '  "language": "en-GB",',
    '  "plan": {',
    '    "programCode": "<string>",',
    '    "programName": "<string>",',
    '    "focusArea": "<string>",',
    '    "semesters": [',
    '      {',
    '        "sequence": 1,',
    '        "label": "S1 2026",',
    '        "units": [',
    '          {',
    '            "code": "CITS0000",',
    '            "title": "<string>",',
    '            "creditPoints": 6,',
    '            "type": "core|elective|option",  // use EXACTLY one of: core, elective, option. Do NOT use "specialisation core" or other variations.',
    '            "rationale": "<why this unit goes here>"',
    '          }',
    '        ]',
    '      }',
    '    ],',
    '    "summary": {',
    '      "totalCreditPoints": <number>,',
    '      "totalUnits": <number>,',
    '      "prerequisitesAssumedStrict": true',
    '    }',
    '  },',
    '  "explanation": {',
    '    "overview": "<brief plan summary>",',
    '    "electiveRationales": ["<reason for elective choices>"]',
    '  },',
    '  "constraintsAcknowledged": ["<constraints considered>"],',
    '  "warnings": ["<REQUIRED: if any Layer 2 or Layer 3 requirements were dropped due to conflicts, add warnings like \"Could not include X due to Y. Consider extending to 5 semesters.\">"],',
    '  "reasoning": {',
    '    "prerequisiteAnalysis": ["<prerequisite chain decisions>"],',
    '    "specialisationFulfillment": ["<how specialisation requirements are met>"],',
    '    "workloadConsiderations": ["<semester load notes>"]',
    '  }',
    '}',
  ].join('\n');
}

export function buildPlannerPrompt(userMessage: string, catalogue: ProgramCatalogue, focusArea?: string): { system: string; user: string } {
  // Commerce (41680): feed raw UWA Handbook data directly to AI
  if (catalogue.programCode === '41680') {
    return buildRawCommercePrompt(userMessage, catalogue, focusArea);
  }

  return {
    system: buildSystemPrompt(),
    user: [
      buildUserPromptPart(userMessage, catalogue, focusArea),
      '---',
      buildOutputSpec(),
      '',
      'Remember: Output ONLY the raw JSON object. Do not include markdown fences, code blocks, or any explanatory text outside the JSON.',
    ].join('\n'),
  };
}

// ─── Raw Commerce Handbook Prompt ─────────────────────────────────────────

function loadCommerceRawData(focusArea?: string): string {
  try {
    const filePath = path.join(process.cwd(), 'ai_data', 'master-of-commerce', 'handbook_raw.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    const rules = data.rules || [];

    // Always include core rules (Rule 0 = conversion + core units)
    const filtered: string[] = [rules[0]];

    if (focusArea) {
      // Match the specialisation rule and its following group table
      const specLower = focusArea.toLowerCase();
      for (let i = 1; i < rules.length; i++) {
        if (rules[i].toLowerCase().includes(specLower)) {
          filtered.push(rules[i]); // Specialisation rule
          if (i + 1 < rules.length && rules[i + 1].startsWith('Group ')) {
            filtered.push(rules[i + 1]); // Group table
          }
          break;
        }
      }
    }
    // If no focus area or not found, include all rules
    if (filtered.length <= 1) {
      return rules.join('\n\n');
    }

    return filtered.join('\n\n');
  } catch {
    return '';
  }
}

function buildRawCommercePrompt(
  userMessage: string,
  catalogue: ProgramCatalogue,
  focusArea?: string
): { system: string; user: string } {
  const rawRules = loadCommerceRawData(focusArea);

  const system = [
    'You are a UWA academic planning assistant. You receive the RAW UWA Handbook course structure for the Master of Commerce (41680) and must generate a valid study plan directly from it.',
    '',
    'CRITICAL RULES — READ THESE FIRST:',
    '',
    'AVAILABILITY (MOST IMPORTANT — CHECK FOR EVERY UNIT):',
    '- The handbook tables have an AVAILABILITY column. This is NOT optional.',
    '- S1 means the unit is ONLY offered in Semester 1. It CANNOT go in S2.',
    '- S2 means the unit is ONLY offered in Semester 2. It CANNOT go in S1.',
    '- "S1, S2" means the unit is offered in BOTH semesters.',
    '- N/A means NOT AVAILABLE in 2026. DO NOT include N/A units.',
    '- NS means non-standard teaching period — treat as available but verify prerequisites.',
    '- BEFORE placing ANY unit, check its availability column against the target semester.',
    '- WRONG: placing an S1-only unit in S2. RIGHT: S1-only units go in S1 semesters ONLY.',
    '',
    'MANDATORY VERIFICATION (DO NOT SKIP):',
    'For EVERY unit you place, write down: (1) its availability, (2) the semester you\'re placing it in, (3) whether they match. If they don\'t match, choose a DIFFERENT unit or a DIFFERENT semester.',
    '',
    'GENERAL RULES:',
    '1. Read the raw handbook data CAREFULLY — ALL unit codes and rules are in the tables.',
    '2. Units are organised into GROUPS (Group 1,2,3 = core; Groups A-I = specialisations).',
    '3. Each specialisation states how many units to take from which groups.',
    '4. Prerequisites MUST be in earlier semesters — check EVERY unit\'s prerequisites column.',
    '5. Target: 4 units per semester, 16 total. Do NOT exceed 4 per semester. Before finalising, count units: if total is not 16, add more units until it is.',
    '8. Conversion units: MGMT5511 (S1,S2), MGMT5526 (S1) are MANDATORY.',
    '9. Group 1: BUSN5100 (S1,S2), MGMT5504 (S1,S2) — include one. Group 2: SVLG5001 or equivalent.',
    '10. Output ONLY the JSON plan — no commentary outside the JSON.',
  ].join('\n');

  const user = [
    '## Student Request',
    userMessage || `Create a study plan for Master of Commerce (41680)${focusArea ? ` with ${focusArea} specialisation` : ''}.`,
    '',
    `Programme: ${catalogue.programName} (${catalogue.programCode})`,
    `Target: 96 credit points (16 units).`,
    focusArea ? `Selected specialisation: ${focusArea}` : '',
    '',
    '## UWA Handbook 2026 — Master of Commerce Course Structure (RAW)',
    '',
    'Below is the COMPLETE UWA Handbook course structure. Read it carefully:',
    '',
    rawRules,
    '',
    '---',
    buildOutputSpec(),
    '',
    'Remember: Output ONLY the raw JSON object.',
  ].filter(Boolean).join('\n');

  return { system, user };
}
