import { ProgramCatalogue, SpecialisationInfo } from './types';

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
    '**Key insight for MIT:** S1 2027 is the busiest semester — CITS4401, CITS5505, and all AI units (CITS5508, CITS4404) are S1-only. You have only 4 slots in S1 2027. If the student requests more than 4 S1-only units, sacrifice the lowest-priority ones and explain the tradeoff.',
    '',
    '## Core Principles',
    '',
    '0. **UNIT LEVEL (Difficulty)**: Introductory (L1) < Intermediate (L2) < Advanced (L4) < Postgraduate (L5, hardest). If the student asks for easy units: (a) fill S1 with L1/L2 foundation units, (b) for remaining slots prefer L4 Advanced over L5 Postgraduate, (c) use INMT/MGMT/SVLG electives which are typically easier than CITS L5 units. MIT is a postgraduate degree so some L4/L5 units are unavoidable — just choose the lighter ones.',
    '1. ⛔ **PREREQUISITES ARE NON-NEGOTIABLE**: A unit and ALL of its prerequisites MUST be in EARLIER semesters. A prerequisite CANNOT be in the same semester as its dependent.',
    '2. **Availability STRICT compliance** — use the AVAILABILITY MAP. S1-only units MUST go in S1. S2-only units MUST go in S2. NO EXCEPTIONS.',
    '3. **Core-first sequencing** — prioritise core/compulsory units early IF available according to availability rules. PHIL4100 is COMPULSORY for MIT but available in BOTH S1 and S2 — it can be placed in ANY semester to free S1 slots for S1-only units.',
    '4. **Specialisation fidelity** — if a specialisation is specified, ensure all its core units are included.',
    '5. **Incompatibility checking** — never place incompatible units in the same plan.',
    '6. **Flexible units for slot optimisation** — PHIL4100 is available S1+S2, CITS4403 is S2-only, CITS5503 is S2-only, CITS5507 is S2-only. When S1 2027 is overloaded with S1-only units, move flexible units (like PHIL4100) to other semesters to free space.',
    '',
    '## ⛔ COMMON ERRORS — CHECK THESE BEFORE OUTPUTTING',
    '',
    '❌ CITS1401 + CITS2005 in same semester → WRONG. CITS2005 requires CITS1401.',
    '❌ CITS5508 in S2, CITS5017 in S1 → WRONG. CITS5017 requires CITS5508.',
    '❌ CITS2002 in S1 → WRONG. CITS2002 is S2-only.',
    '❌ Missing PHIL4100 → WRONG. PHIL4100 is COMPULSORY.',
    '❌ CITS5206 not in final semester → WRONG. Capstone must be LAST.',
    '❌ Missing CITS5505 → WRONG. CITS5505 is a MANDATORY core unit.',
    '❌ Including CITS4009 without request → WRONG. Rarely taken by real IT students.',
    '❌ Overloading S1 2027 with 5+ S1-only units → WRONG. Only 4 slots exist. Sacrifice lower-priority units.',
    '❌ ANY semester with >4 units → WRONG. Every semester MUST have EXACTLY 4 or FEWER units. Count every semester before outputting.',
    '❌ Duplicate unit code in plan → WRONG. Each unit code can appear AT MOST ONCE across all semesters.',
    '❌ CITS5015 without CITS5014 → WRONG. CITS5015 requires CITS5014 as prerequisite. All-or-nothing: if research doesn\'t fit, drop BOTH and fill slots with alternatives.',
    '❌ Partial Layer 3 fulfillment → WRONG. If a specific request cannot be fully satisfied, DROP IT COMPLETELY and replace with appropriate elective units. Do not include half.',
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
    'Each semester has EXACTLY 4 slots. NO EXCEPTIONS. You MUST count before placing.',
    '',
    'S1 2027 is the BOTTLENECK semester for MIT. These units are S1-only and compete for S1 2027:',
    '  🔒 Layer 1 (MUST): CITS4401, CITS5505 — 2 slots consumed',
    '  🎯 Layer 2 AI direction: CITS5508, CITS4404 — +2 = 4 slots total',
    '  💬 Layer 3 Research: CITS5014 — +1 = 5 slots → OVERFLOW! MUST DROP research.',
    '',
    '**GOLDEN RULE:** BEFORE writing ANY unit into S1 2027, list ALL S1-only candidates and their counts. If total > 4, sacrifice the lowest-priority ones. The count CANNOT exceed 4.',
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
    '- ⛔ **PHIL4100 is COMPULSORY for MIT but available BOTH semesters — move it freely to optimise slots.**',
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
