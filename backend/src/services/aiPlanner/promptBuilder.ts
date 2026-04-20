import { ProgramCatalogue } from './types';

function serialiseUnits(catalogue: ProgramCatalogue): string {
  return catalogue.units
    .map((unit) => {
      const prerequisites = unit.prerequisites.length > 0 ? unit.prerequisites.join(', ') : 'None';
      return [
        `- ${unit.code}: ${unit.title}`,
        `  Type: ${unit.type}`,
        `  Credit points: ${unit.creditPoints}`,
        `  Offered: ${unit.availability.join(', ')}`,
        `  Prerequisites: ${prerequisites}`,
        `  Description: ${unit.description}`,
      ].join('\n');
    })
    .join('\n');
}

function serialiseConstraints(catalogue: ProgramCatalogue): string {
  return catalogue.constraints.map((constraint) => `- ${constraint.code}: ${constraint.description}`).join('\n');
}

export function buildPlannerPrompt(userMessage: string, catalogue: ProgramCatalogue): string {
  return [
    'You are an academic planning assistant for university students.',
    'Generate a study plan in strict JSON only with no markdown and no additional prose.',
    'You must assume prerequisite compliance is mandatory and cannot be broken.',
    'If prerequisite timing is uncertain, add a warning and choose a safer unit order.',
    'Write in British English.',
    '',
    'Student request:',
    userMessage,
    '',
    'Programme context:',
    `- Programme code: ${catalogue.programCode}`,
    `- Programme name: ${catalogue.programName}`,
    `- Target credit points: ${catalogue.totalCreditPoints}`,
    `- Default units per semester: ${catalogue.defaultUnitsPerSemester}`,
    '',
    'Constraints provided by the institution:',
    serialiseConstraints(catalogue),
    '',
    'Available units:',
    serialiseUnits(catalogue),
    '',
    'Return JSON with this exact top-level structure:',
    '{',
    '  "version": "1.0",',
    '  "generatedAt": "ISO-8601 timestamp",',
    '  "language": "en-GB",',
    '  "plan": {',
    '    "programCode": "string",',
    '    "programName": "string",',
    '    "focusArea": "string",',
    '    "semesters": [',
    '      {',
    '        "sequence": 1,',
    '        "label": "S1 2026",',
    '        "units": [',
    '          {',
    '            "code": "CITS0000",',
    '            "title": "string",',
    '            "creditPoints": 6,',
    '            "type": "core|elective",',
    '            "rationale": "optional string, mainly for electives"',
    '          }',
    '        ]',
    '      }',
    '    ],',
    '    "summary": {',
    '      "totalCreditPoints": 96,',
    '      "totalUnits": 16,',
    '      "prerequisitesAssumedStrict": true',
    '    }',
    '  },',
    '  "explanation": {',
    '    "overview": "string",',
    '    "electiveRationales": ["string"]',
    '  },',
    '  "constraintsAcknowledged": ["string"],',
    '  "warnings": ["string"]',
    '}',
  ].join('\n');
}
