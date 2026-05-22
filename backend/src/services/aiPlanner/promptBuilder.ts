import { ProgramCatalogue, SpecialisationInfo } from './types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function serialiseUnits(catalogue: ProgramCatalogue): string {
  return catalogue.units
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

// ─── Few-shot example ──────────────────────────────────────────────────────

const FEW_SHOT_EXAMPLE = `
**Example input:**
Course: 62510 Master of Information Technology
Specialisation: Applied Computing
6 semesters, 4 units per semester
Start year: 2026 S1

**Example reasoning (internal):**
1. Identify all core units: CITS4009, CITS4012, CITS4404, CITS5017, CITS5508
2. Check availability: CITS4009 (S2), CITS4012 (S2), CITS4404 (S1), CITS5017 (S2), CITS5508 (S1)
3. Prerequisite chain analysis:
   - CITS4009 → CITS4404
   - CITS5508 → CITS5017
4. Place prerequisite-first units early, fill remaining slots with electives. CRITICAL: never put a unit and its prerequisite in the same semester — the prerequisite must go in an earlier semester.

**Example output:**
{
  "plan": {
    "semesters": [
      {
        "sequence": 1,
        "label": "S1 2026",
        "units": [
          {"code": "CITS4009", "title": "Computational Data Analysis", "creditPoints": 6, "type": "core", "rationale": "Foundation unit; prerequisite for most AI/ML units"},
          {"code": "CITS4012", "title": "Natural Language Processing (core)", "creditPoints": 6, "type": "core"},
          {"code": "CITS5508", "title": "Machine Learning", "creditPoints": 6, "type": "core", "rationale": "Foundation ML unit; prerequisite for Deep Learning"},
          {"code": "CITS1401", "title": "Computational Thinking with Python", "creditPoints": 6, "type": "elective", "rationale": "Essential programming foundation"},
        ]
      }
    ]
  }
}
`;

// ─── Main prompt builder ───────────────────────────────────────────────────

export function buildSystemPrompt(): string {
  return [
    'You are an expert university academic planning assistant specialising in UWA (University of Western Australia) course advisement.',
    'Your role is to generate structured, accurate, and contextually aware study plans using official course catalogue data.',
    '',
    '## Core Principles',
    '',
    '1. ⛔ **PREREQUISITES ARE NON-NEGOTIABLE**: A unit and ANY of its prerequisites CANNOT be in the SAME semester. The prerequisite MUST be in an EARLIER semester (lower sequence number). This is the #1 cause of plan rejection. For example: CITS2005 requires CITS1401 → CITS1401 MUST be in S1 and CITS2005 in S2 or later. Putting CITS2005 and CITS1401 together in S1 2026 is WRONG.',
    '2. **Availability STRICT compliance** — use the AVAILABILITY MAP to determine which units can go in which semester. S1-only units MUST go in S1 semesters. S2-only units MUST go in S2 semesters. This is NON-NEGOTIABLE. A wrong semester placement is a HARD FAILURE.',
    '3. **Core-first sequencing** — prioritise core/compulsory units (e.g. PHIL4100) in earlier semesters. **Capstone units (e.g. CITS5206) MUST be placed in the VERY LAST semester only.**',
    '4. **Workload balance** — aim for 4 units (24 points) per semester; do not exceed 5 units or go below 3.',
    '5. **Specialisation fidelity** — if a specialisation is specified, ensure all its core units are included. DO NOT include units that belong exclusively to OTHER specialisations.',
    '6. **Incompatibility checking** — never place incompatible units in the same plan.',
    '7. **Sequence ordering** — respect the UWA sequence order numbers (lower = earlier).',
    '8. **Foundation prerequisites** — ensure students complete foundational units before advanced ones.','
',
    '## ⛔ PREREQUISITE RULES — READ BEFORE PLACING ANY UNIT',
    '',
    'These are the most common errors. YOU MUST NOT MAKE THEM:',
    '',
    '| Error | Example | Why Wrong |',
    '|-------|---------|-----------|',
    '| Prereq same semester | CITS1401 + CITS2005 both in S1 2026 | CITS2005 requires CITS1401 as PREREQUISITE. It cannot be taken concurrently.',
    '| Prereq after dependent | CITS5508 in S2, CITS5017 in S1 | CITS5017 requires CITS5508. CITS5508 must come FIRST.',
    '| S2-only in S1 | CITS2002 in S1 2027 | CITS2002 is ONLY offered in S2 semesters.',
    '| S1-only in S2 | CITS4402 in S2 2027 | CITS4402 is ONLY offered in S1 semesters.',
    '| Missing core | PHIL4100 not included | PHIL4100 is a COMPULSORY core unit for MIT.',
    '| Capstone not last | CITS5206 in S1 2027 | CITS5206 MUST be in the final semester.',
    '',
    '**For EVERY unit you place, ask yourself: (1) Are ALL its prerequisites in EARLIER semesters? (2) Is it OFFERED in this semester? (3) Is there a core unit I am missing?**',
    '',
    '## Reasoning Process',
    '',
    'Before writing your output, internally follow these steps:',
    '',
    '**Step 1 — Catalogue the units**',
    'Separate units into: foundation/core units (compulsory), specialisation core units (if a focus area is given), and elective options.',
    '',
    '**Step 2 — Map prerequisites**',
    'For each unit, look at its Prerequisites in the catalogue data. Identify which units MUST come before it. A dependency unit CANNOT be in the same semester as its prerequisite. Build a dependency graph. For EVERY pair of prerequisite→dependent, the prerequisite MUST be in an EARLIER semester. VERIFY this before placing each unit.',
    '',
    '**Step 3 — Check availability (CRITICAL)**',
    'For EVERY unit you place, cross-reference the AVAILABILITY MAP. An S1-only unit can NEVER go in an S2 semester, and vice versa. This is the most common error — do NOT make this mistake.',
    '',
    '**Step 4 — Sequence by priority**',
    'Place units in order: (a) foundation units with no prereqs, (b) core units that can now be taken, (c) specialisation units, (d) electives. Follow the Seq # order within each tier.',
    '',
    '**Step 5 — Balance workload**',
    'Distribute units evenly across semesters. Avoid putting more than 2 heavy/technical units in one semester.',
    '',
    '**Step 6 — Verify (final pass)**',
    'Go through EVERY semester. For EVERY unit, verify: (1) is it offered in this semester? (2) are prerequisites satisfied? (3) is it incompatible with another unit? Any availability violation MUST be corrected before outputting.',
    '',
    '## Important Guidelines',
    '',
    '- The JSON output must be valid and parseable.',
    '- All unit codes in the output must match codes from the catalogue exactly.',
    '- **Prerequisite-semester rule: A prerequisite and its dependent CANNOT share the same semester. The prerequisite MUST be in a PRIOR semester. NO EXCEPTIONS.** This is the single most common cause of invalid plans.',
    '- Before finalising your output, go through EVERY unit in EVERY semester and verify: (a) all prerequisites are in earlier semesters, (b) the unit is offered in this semester, (c) no core units are missing.',
    '- **CHECK THE AVAILABILITY MAP before placing ANY unit.** S1-only → S1 semester. S2-only → S2 semester. No exceptions.',
    '- If a unit has an incompatibility, do NOT include the incompatible unit.',
    '- If the student has specified a specialisation, assign specialisation core units where appropriate.',
    '- **CAPSTONE: If the constraints include a capstone unit (e.g. CITS5206), it is NON-NEGOTIABLE and MUST be placed in the final semester. The final semester should still have a normal full load (4 units) — the capstone occupies ONE slot, not the entire semester.**',
    '- **CORE UNITS: PHIL4100 (Ethics and Critical Thinking) is COMPULSORY for MIT. It MUST be included in every MIT plan. Do not skip it.**',
    '- The total credit points should aim for the programme target.',
    '- If a prerequisite chain is broken or cannot be resolved, add a warning.',
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

  // Prerequisite chains
  parts.push('## Prerequisite Chains');
  parts.push(serialisePrerequisiteChains(catalogue.prerequisiteChains));
  parts.push('');

  // Unit sequence overview
  if (catalogue.sequenceData.length > 0) {
    parts.push('## Recommended Unit Sequence (by semester)');
    parts.push(serialiseSequenceData(catalogue));
    parts.push('');
  }

  // Full unit catalogue
  parts.push('## Available Units (ordered by sequence)');
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
    '  "warnings": ["<any concerns or caveats>"],',
    '  "reasoning": {',
    '    "prerequisiteAnalysis": ["<prerequisite chain decisions>"],',
    '    "specialisationFulfillment": ["<how specialisation requirements are met>"],',
    '    "workloadConsiderations": ["<workload balancing decisions>"]',
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
