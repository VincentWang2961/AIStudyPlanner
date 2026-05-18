import { ProgramCatalogue, SpecialisationInfo } from './types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function serialiseUnits(catalogue: ProgramCatalogue, electivesOnly?: boolean): string {
  let units = electivesOnly
    ? catalogue.units.filter(u => u.type !== 'core')
    : catalogue.units;
  return units
    .sort((a, b) => (a.sequenceOrder ?? 999) - (b.sequenceOrder ?? 999))
    .map((unit) => {
      const prereqs = unit.prerequisites.length > 0 ? unit.prerequisites.join(', ') : 'None';
      const incs = unit.incompatibilities.length > 0 ? `Incompatible with: ${unit.incompatibilities.join(', ')}` : '';
      const coreqs = unit.corequisites.length > 0 ? `Corequisites: ${unit.corequisites.join(', ')}` : '';
      const seq = unit.sequenceOrder ? `[Seq #${unit.sequenceOrder}]` : '';
      const avail = unit.availability.length > 0 ? `Offered: ${unit.availability.join(', ')}` : 'Availability unknown';
      return [
        `- ${unit.code}: ${unit.title} (${unit.type}, ${unit.creditPoints}pts) ${seq}`,
        `  ${avail}`,
        `  Prerequisites: ${prereqs}`,
        coreqs ? `  ${coreqs}` : '',
        incs ? `  ${incs}` : '',
        `  ${unit.description}`,
      ].filter(Boolean).join('\n');
    })
    .join('\n\n');
}

/**
 * Build a compact availability matrix so the AI can SEE at a glance
 * which units are ONLY available in S1, ONLY in S2, or both.
 * This makes availability violations harder to miss.
 */
function serialiseAvailabilityMatrix(catalogue: ProgramCatalogue): string {
  const s1Only: string[] = [];
  const s2Only: string[] = [];
  const both: string[] = [];
  const unknown: string[] = [];

  for (const unit of catalogue.units) {
    const avail = new Set(unit.availability.map(a => a.toUpperCase()));
    const hasS1 = avail.has('S1');
    const hasS2 = avail.has('S2');

    if (hasS1 && hasS2) {
      both.push(unit.code);
    } else if (hasS1) {
      s1Only.push(unit.code);
    } else if (hasS2) {
      s2Only.push(unit.code);
    } else {
      unknown.push(unit.code);
    }
  }

  const lines: string[] = [];
  lines.push('## ⚠️  SEMESTER AVAILABILITY — DO NOT IGNORE');
  lines.push('');
  lines.push('YOU MUST place units ONLY in their allowed semesters. Double-check every placement.');
  lines.push('');

  if (s1Only.length > 0) {
    lines.push(`### S1 ONLY units (${s1Only.length} — do NOT place in S2):`);
    lines.push(s1Only.join(' | '));
    lines.push('');
  }

  if (s2Only.length > 0) {
    lines.push(`### S2 ONLY units (${s2Only.length} — do NOT place in S1):`);
    lines.push(s2Only.join(' | '));
    lines.push('');
  }

  if (both.length > 0) {
    lines.push(`### BOTH semesters (${both.length} — can go in either):`);
    lines.push(both.join(' | '));
    lines.push('');
  }

  if (unknown.length > 0) {
    lines.push(`### Unknown availability (${unknown.length} — treat as either):`);
    lines.push(unknown.join(' | '));
    lines.push('');
  }

  return lines.join('\n');
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

function serialisePrerequisiteChains(chains: string[][]): string {
  if (!chains || chains.length === 0) return 'No predefined prerequisite chains available.';
  return chains
    .map((chain, i) => `  Chain ${i + 1}: ${chain.join(' → ')}`)
    .join('\n');
}

function serialiseSequenceData(catalogue: ProgramCatalogue): string {
  if (!catalogue.sequenceData || catalogue.sequenceData.length === 0) {
    return 'Unit sequence data is integrated into the unit list above (see Seq #).';
  }
  const bySemester = new Map<string, string[]>();
  for (const entry of catalogue.sequenceData) {
    const existing = bySemester.get(entry.recommendedSemester) ?? [];
    existing.push(`${entry.unitCode} — ${entry.notes}`);
    bySemester.set(entry.recommendedSemester, existing);
  }
  return Array.from(bySemester.entries())
    .map(([sem, items]) => `  ${sem}:\n${items.map((i) => `    - ${i}`).join('\n')}`)
    .join('\n\n');
}

// ─── Main prompt builder ───────────────────────────────────────────────────

export function buildSystemPrompt(): string {
  return [
    'You are an academic planning assistant. Your ONLY data source is the course catalogue below.',
    '',
    '## ⚠️  CRITICAL: Catalogue Data Overrides ALL External Knowledge',
    '',
    'The catalogue below is the SOLE source of truth. It may differ from what you think you know about UWA.',
    'If you believe a unit should be available in a semester but the catalogue says otherwise — TRUST THE CATALOGUE.',
    'If you think a unit is core but the catalogue marks it elective — TRUST THE CATALOGUE.',
    'YOUR KNOWLEDGE OF UWA COURSES IS LIKELY OUTDATED. The catalogue is authoritative.',
    '',
    'DO NOT override catalogue data with your training knowledge. EVER.',
    '',
    '## Rules (in order of priority)',
    '',
    '1. **Catalogue-only units** — Every unit code must match EXACTLY a code in the catalogue.',
    '2. **Availability is HARD CONSTRAINT** — Check the semester availability matrix. If a unit is S1 ONLY, it CANNOT go in S2. No exceptions.',
    '3. **ALL core units required** — Every unit with type="core" in the catalogue MUST appear in the plan. For MIT 62510, mandatory cores are: CITS4401, CITS5206, CITS5505, PHIL4100.',
    '4. **Capstone in final semester** — CITS5206 (Capstone Project) MUST be placed in the LAST semester or second-to-last. It requires 66 completed points.',
    '5. **Research Project pairing** — If you select CITS5014 (Research Project Part 1), you MUST also include CITS5015 (Part 2) in the IMMEDIATELY following semester. They form a continuous project.',
    '6. **Prerequisites respected** — No unit before its prerequisites are completed.',
    '7. **STRICT even workload distribution** — EVERY semester must have EXACTLY the same number of units (unless the student explicitly requests otherwise).',
    '   If the student says "4 semesters, 4 units each": ALL four semesters must have exactly 4 units. No 2-6-4-4 or 5-3-4-4 patterns.',
    '   Calculate: N semesters × M units = N×M total units. Distribute them evenly so EVERY semester has exactly M units.',
    '   NEVER create semesters with 2 units next to semesters with 6 units. The workload must be UNIFORM.',
    '',
    '## Reasoning Process (follow this order)',
    '',
    'Step 1: Read the "CORE UNITS" list. EVERY core unit must be placed.',
    'Step 2: Read the "SEMESTER AVAILABILITY" matrix. Note which units are S1-only and S2-only.',
    'Step 3: Build a draft plan respecting availability and prerequisites.',
    'Step 4: VERIFY: Cross-check every unit placement against the availability matrix.',
    'Step 5: VERIFY: All core units are present.',
    '',
    '## Output Rules',
    '',
    '- Valid JSON only. No markdown fences.',
    '- British English spelling.',
    '- Include all required fields per the output spec.',
  ].join('\n');
}

function buildUserPromptPart(userMessage: string, catalogue: ProgramCatalogue, focusArea?: string): string {
  const parts: string[] = [];

  parts.push('## Student Request');
  parts.push(userMessage);
  parts.push('');

  parts.push('## Programme Context');
  parts.push(`- Programme: ${catalogue.programName} (${catalogue.programCode})`);
  parts.push(`- Target credit points: ${catalogue.totalCreditPoints}`);
  parts.push(`- Default load: ${catalogue.defaultUnitsPerSemester} units per semester`);
  parts.push(`- Available units in catalogue: ${catalogue.units.length}`);
  if (focusArea) {
    parts.push(`- Student focus area: ${focusArea}`);
  }
  parts.push('');

  // AVAILABILITY MATRIX FIRST — most important constraint
  parts.push(serialiseAvailabilityMatrix(catalogue));

  // CORE UNITS — second most important
  const coreUnits = catalogue.units.filter(u => u.type === 'core');
  if (coreUnits.length > 0) {
    parts.push('## ⚠️  CORE UNITS — ALL MUST BE INCLUDED');
    parts.push(coreUnits.map(u =>
      `- ${u.code}: ${u.title} — ONLY available: ${u.availability.join(', ')} — type: ${u.type}`
    ).join('\n'));
    parts.push('');
  }

  parts.push('## Available Specialisations');
  parts.push(serialiseSpecialisations(catalogue.specialisations));
  parts.push('');

  parts.push('## Programme Constraints');
  parts.push(serialiseConstraints(catalogue));
  parts.push('');

  if (catalogue.prerequisiteChains.length > 0) {
    parts.push('## Prerequisite Chains');
    parts.push(serialisePrerequisiteChains(catalogue.prerequisiteChains));
    parts.push('');
  }

  if (catalogue.sequenceData.length > 0) {
    parts.push('## Recommended Unit Sequence');
    parts.push(serialiseSequenceData(catalogue));
    parts.push('');
  }

  parts.push('## Available Electives (select from these only)');
  parts.push(serialiseUnits(catalogue, true));
  parts.push('');

  return parts.join('\n');
}

function buildOutputSpec(): string {
  return [
    '## Output Specification',
    '',
    'Return ONLY valid JSON — no markdown fences, no extra text:',
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
    '          {"code": "CITS0000", "title": "<string>", "creditPoints": 6, "type": "core|elective|option", "rationale": "<why this placement>"}',
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
    '  "warnings": ["<any concerns or caveats>"],',
    '  "reasoning": {',
    '    "prerequisiteAnalysis": ["..."],',
    '    "specialisationFulfillment": ["..."],',
    '    "workloadConsiderations": ["..."]',
    '  }',
    '}',
    '',
    'FINAL CHECKLIST before outputting:',
    '- [ ] All unit codes are copy-pasted from the catalogue',
    '- [ ] All S1-only units are in S1 semesters',
    '- [ ] All S2-only units are in S2 semesters',
    '- [ ] ALL core units are included',
    '- [ ] Prerequisites are satisfied',
    '- [ ] EVERY semester has EXACTLY the same number of units (unless student requested otherwise)',
  ].join('\n');
}

export function buildPlannerPrompt(userMessage: string, catalogue: ProgramCatalogue): { system: string; user: string } {
  return {
    system: buildSystemPrompt(),
    user: [
      buildUserPromptPart(userMessage, catalogue),
      '---',
      buildOutputSpec(),
    ].join('\n'),
  };
}
