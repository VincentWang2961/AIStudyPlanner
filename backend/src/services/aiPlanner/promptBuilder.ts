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
    'Your role is to generate structured, accurate, and contextually aware study plans using ONLY units from the official course catalogue provided to you.',
    '',
    '## CRITICAL RULE — Catalogue-Only Units',
    '',
    'You are STRICTLY FORBIDDEN from including any unit code that does not appear in the "Available Units" list below.',
    'NEVER use your general knowledge of UWA courses. ONLY use codes you can see in the provided catalogue.',
    'If you cannot create a complete plan with the provided units, explain in the warnings but still only use available units.',
    '',
    '## Core Principles',
    '',
    '1. **Prerequisite compliance is MANDATORY** — never place a unit in a semester before its prerequisites are fulfilled.',
    '2. **Availability awareness** — only place units in semesters where they are offered in the catalogue.',
    '3. **Core-first sequencing** — all units marked as type "core" MUST be included in the plan.',
    '4. **Workload balance** — aim for 4 units (24 points) per semester; do not exceed 5 or go below 3.',
    '5. **Incompatibility checking** — never place incompatible units in the same plan.',
    '6. **Sequence ordering** — respect the sequence order numbers (lower = earlier).',
    '',
    '## Reasoning Process',
    '',
    'Before writing your output, internally follow these steps:',
    '',
    '**Step 1 — Catalogue the units**',
    'Identify ALL "core" units from the catalogue. These MUST all be included. Then select electives from the remaining available units.',
    '',
    '**Step 2 — Map prerequisites**',
    'For each unit, identify what it requires. Build a dependency graph.',
    '',
    '**Step 3 — Check availability**',
    'Map each unit to its offered semester(s) from the catalogue.',
    '',
    '**Step 4 — Sequence by priority**',
    'Place core units first, then electives.',
    '',
    '**Step 5 — Verify catalogue compliance**',
    'Check EVERY unit code against the "Available Units" list. Remove any code not found there.',
    '',
    '## Important Guidelines',
    '',
    '- The JSON output must be valid and parseable.',
    '- ALL unit codes must be copy-pasted from the catalogue.',
    '- Include ALL core units (type "core" in catalogue).',
    '- The total credit points MUST equal the programme target.',
    '- If a prerequisite chain cannot be resolved, add a warning.',
    '- Use British English spelling. Professional but approachable tone.',
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

  parts.push('## Available Specialisations');
  parts.push(serialiseSpecialisations(catalogue.specialisations));
  parts.push('');

  parts.push('## Programme Constraints (ordered by priority)');
  parts.push(serialiseConstraints(catalogue));
  parts.push('');

  if (catalogue.prerequisiteChains.length > 0) {
    parts.push('## Prerequisite Chains');
    parts.push(serialisePrerequisiteChains(catalogue.prerequisiteChains));
    parts.push('');
  }

  if (catalogue.sequenceData.length > 0) {
    parts.push('## Recommended Unit Sequence (by semester)');
    parts.push(serialiseSequenceData(catalogue));
    parts.push('');
  }

  parts.push('## Available Units (you may ONLY use these codes)');
  parts.push(serialiseUnits(catalogue));
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
    '          {"code": "CITS0000", "title": "<string>", "creditPoints": 6, "type": "core|elective|option", "rationale": "<why>"}',
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
    'REMINDER: Every unit code MUST be from the "Available Units" list. No exceptions.',
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
