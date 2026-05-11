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
1. Identify all core units: CITS4009, CITS4012, CITS4013, CITS5017, CITS5018
2. Check availability: CITS4009 (S1), CITS4012 (S1,S2), CITS4013 (S2), CITS5017 (S1,S2), CITS5018 (S1)
3. Prerequisite chain analysis:
   - CITS4009 → CITS4402, CITS4404, CITS4403
   - CITS4012 → CITS5205, CITS5553, CITS5020
   - CITS4013 → CITS5508, CITS5019
4. Place prerequisite-first units early, fill remaining slots with electives

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
          {"code": "CITS5018", "title": "IT Research Methods", "creditPoints": 6, "type": "core", "rationale": "Early completion of core requirement"},
          {"code": "CITS4402", "title": "Computer Vision", "creditPoints": 6, "type": "elective"}
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
    '1. **Prerequisite compliance is MANDATORY** — never place a unit in a semester before its prerequisites are fulfilled.',
    '2. **Availability awareness** — only place units in semesters where they are offered.',
    '3. **Core-first sequencing** — prioritise core/compulsory units in earlier semesters.',
    '4. **Workload balance** — aim for 4 units (24 points) per semester; do not exceed 5 units or go below 3.',
    '5. **Specialisation fidelity** — if a specialisation is specified, ensure all its core units are included.',
    '6. **Incompatibility checking** — never place incompatible units in the same plan.',
    '7. **Sequence ordering** — respect the UWA sequence order numbers (lower = earlier).',
    '8. **Foundation prerequisites** — ensure students complete foundational units before advanced ones.',
    '',
    '## Reasoning Process',
    '',
    'Before writing your output, internally follow these steps:',
    '',
    '**Step 1 — Catalogue the units**',
    'Separate units into: foundation/core units (compulsory), specialisation core units (if a focus area is given), and elective options.',
    '',
    '**Step 2 — Map prerequisites**',
    'For each unit, identify what it requires. Build a dependency graph. Identify which units can go in S1 (no prerequisites) and which are blocked.',
    '',
    '**Step 3 — Check availability**',
    'Map each unit to its offered semester(s). A unit offered only in S2 cannot be placed in S1.',
    '',
    '**Step 4 — Sequence by priority**',
    'Place units in order: (a) foundation units with no prereqs, (b) core units that can now be taken, (c) specialisation units, (d) electives. Follow the Seq # order within each tier.',
    '',
    '**Step 5 — Balance workload**',
    'Distribute units evenly across semesters. Avoid putting more than 2 heavy/technical units in one semester.',
    '',
    '**Step 6 — Verify**',
    'Double-check every semester against prerequisites, availability, and incompatibilities.',
    '',
    '## Important Guidelines',
    '',
    '- The JSON output must be valid and parseable.',
    '- All unit codes in the output must match codes from the catalogue exactly.',
    '- If a unit has an incompatibility, do NOT include the incompatible unit.',
    '- If the student has specified a specialisation, assign specialisation core units where appropriate.',
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
    parts.push(`- Student focus area: ${focusArea}`);
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
    '            "type": "core|elective|option",',
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

export function buildPlannerPrompt(userMessage: string, catalogue: ProgramCatalogue): { system: string; user: string } {
  return {
    system: buildSystemPrompt(),
    user: [
      buildUserPromptPart(userMessage, catalogue),
      '---',
      buildOutputSpec(),
      '',
      'Remember: Output ONLY the raw JSON object. Do not include markdown fences, code blocks, or any explanatory text outside the JSON.',
    ].join('\n'),
  };
}
