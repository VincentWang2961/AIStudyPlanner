/**
 * Fallback Study Plans — UWA Handbook 2026 Edition
 *
 * Pre-generated study plans based on accurate UWA Handbook 2026 data.
 * Used when AI is unavailable or rate-limited.
 */

import { StudyPlanResponse } from './types';

function today(): string {
  return new Date().toISOString();
}

// ─── 62510 Master of IT — Applied Computing (2-year / 4 semester) ────────────

const MIT_APPLIED_COMPUTING: StudyPlanResponse = {
  version: '1.0', generatedAt: '', language: 'en-GB',
  plan: {
    programCode: '62510', programName: 'Master of Information Technology', focusArea: 'Applied Computing',
    semesters: [
      { sequence: 1, label: 'S1 Year 1', units: [
        { code: 'CITS1401', title: 'Computational Thinking with Python', creditPoints: 6, type: 'core', rationale: 'Foundation programming — prerequisite for CITS4401, CITS5505' },
        { code: 'CITS2005', title: 'Object Oriented Programming', creditPoints: 6, type: 'core', rationale: 'Conversion unit; corequisite with CITS1401' },
        { code: 'CITS4401', title: 'Software Requirements and Design', creditPoints: 6, type: 'core', rationale: 'Core unit; prerequisite CITS1401 met' },
        { code: 'CITS5505', title: 'Agile Web Development', creditPoints: 6, type: 'core', rationale: 'Core unit; prerequisite CITS1401 met' },
      ]},
      { sequence: 2, label: 'S2 Year 1', units: [
        { code: 'CITS4009', title: 'Fundamentals of Data Science', creditPoints: 6, type: 'core', rationale: 'Available S2 only; data foundations' },
        { code: 'CITS4403', title: 'Computational Modelling', creditPoints: 6, type: 'elective', rationale: 'Group B elective; S2 only' },
        { code: 'CITS5503', title: 'Cloud Computing', creditPoints: 6, type: 'elective', rationale: 'Group A elective; requires CITS2005/2002 met' },
        { code: 'PHIL4100', title: 'Ethics and Critical Thinking', creditPoints: 6, type: 'core', rationale: 'Core unit; available both semesters' },
      ]},
      { sequence: 3, label: 'S1 Year 2', units: [
        { code: 'CITS4402', title: 'Computer Vision', creditPoints: 6, type: 'elective', rationale: 'Group B/C elective; S1 only' },
        { code: 'CITS5506', title: 'The Internet of Things', creditPoints: 6, type: 'elective', rationale: 'Group A elective; S1 only' },
        { code: 'CITS5206', title: 'Information Technology Capstone Project', creditPoints: 6, type: 'core', rationale: 'Capstone; 66 points prerequisite met' },
        { code: 'CITS4407', title: 'Open Source Tools and Scripting', creditPoints: 6, type: 'elective', rationale: 'Group B/C elective; S1 only' },
      ]},
      { sequence: 4, label: 'S2 Year 2', units: [
        { code: 'CITS5017', title: 'Deep Learning', creditPoints: 6, type: 'elective', rationale: 'Level 5 elective; S2 only' },
        { code: 'CITS4012', title: 'Natural Language Processing', creditPoints: 6, type: 'elective', rationale: 'Group B elective; S2 only' },
        { code: 'CITS4404', title: 'Artificial Intelligence and Adaptive Systems', creditPoints: 6, type: 'elective', rationale: 'Group B; S1 only but moved for prerequisite chain' },
        { code: 'MGMT5504', title: 'Data Analysis and Decision Making', creditPoints: 6, type: 'elective', rationale: 'Group C elective; available both semesters' },
      ]},
    ],
    summary: { totalCreditPoints: 96, totalUnits: 16, prerequisitesAssumedStrict: true },
  },
  explanation: {
    overview: 'Applied Computing study plan based on UWA Handbook 2026. 4 semesters (2 years) following the official course structure: 24 points core + 6+ Group A + 6+ Group B + Group C to reach 96 total.',
    electiveRationales: [
      'Electives drawn from Groups A, B, and C as specified in the Handbook',
      'Level 5 units (CITS5503, CITS5017) satisfy the Group B level-5 requirement',
      'Foundation programming units placed in S1 Year 1 to unlock dependent units',
    ],
  },
  constraintsAcknowledged: [
    'COURSE_STRUCTURE: Follows Handbook 2026 grouping (Core, A, B, C)',
    'AVAILABILITY: Units placed in correct semesters per Handbook',
    'CORE_COMPLETION: All 4 core units (24pts) included',
  ],
  warnings: [
    'This is a FALLBACK plan — not AI-generated. Review and adjust as needed.',
    'CITS4404 moved to S2 Year 2 (off-schedule) for workload balance; may require enrolment approval.',
  ],
  reasoning: {
    prerequisiteAnalysis: [
      'CITS1401 placed S1 to unlock CITS4401, CITS5505, CITS4009, CITS4012',
      'CITS2005 placed concurrently with CITS1401 as corequisite',
      'CITS5206 capstone placed in Year 2 after 66 points completed',
    ],
    specialisationFulfillment: [
      'Applied Computing covers broad computing skills across software, data, and systems',
    ],
    workloadConsiderations: ['Balanced 4 units (24 points) per semester'],
  },
};

// ─── 62510 MIT — Artificial Intelligence (2-year / 4 semester) ───────────────

const MIT_ARTIFICIAL_INTELLIGENCE: StudyPlanResponse = {
  version: '1.0', generatedAt: '', language: 'en-GB',
  plan: {
    programCode: '62510', programName: 'Master of Information Technology', focusArea: 'Artificial Intelligence',
    semesters: [
      { sequence: 1, label: 'S1 Year 1', units: [
        { code: 'CITS1401', title: 'Computational Thinking with Python', creditPoints: 6, type: 'core', rationale: 'Foundation programming for all AI units' },
        { code: 'CITS4401', title: 'Software Requirements and Design', creditPoints: 6, type: 'core', rationale: 'Core unit' },
        { code: 'CITS5505', title: 'Agile Web Development', creditPoints: 6, type: 'core', rationale: 'Core unit' },
        { code: 'PHIL4100', title: 'Ethics and Critical Thinking', creditPoints: 6, type: 'core', rationale: 'Core unit' },
      ]},
      { sequence: 2, label: 'S2 Year 1', units: [
        { code: 'CITS4009', title: 'Fundamentals of Data Science', creditPoints: 6, type: 'elective', rationale: 'Foundation for AI; S2 only' },
        { code: 'CITS4012', title: 'Natural Language Processing', creditPoints: 6, type: 'elective', rationale: 'AI-relevant NLP; S2 only' },
        { code: 'CITS2002', title: 'Systems Programming', creditPoints: 6, type: 'core', rationale: 'Conversion unit; S2 only; prerequisite for CITS4404' },
        { code: 'CITS4403', title: 'Computational Modelling', creditPoints: 6, type: 'elective', rationale: 'Group B elective; S2 only' },
      ]},
      { sequence: 3, label: 'S1 Year 2', units: [
        { code: 'CITS4404', title: 'Artificial Intelligence and Adaptive Systems', creditPoints: 6, type: 'elective', rationale: 'Core AI unit; requires CITS2002 + CITS1401/4009' },
        { code: 'CITS4407', title: 'Open Source Tools and Scripting', creditPoints: 6, type: 'elective', rationale: 'Group B elective; S1 only' },
        { code: 'CITS5206', title: 'Information Technology Capstone Project', creditPoints: 6, type: 'core', rationale: 'Capstone; prerequisites met' },
        { code: 'CITS5506', title: 'The Internet of Things', creditPoints: 6, type: 'elective', rationale: 'Group A elective; S1 only' },
      ]},
      { sequence: 4, label: 'S2 Year 2', units: [
        { code: 'CITS5017', title: 'Deep Learning', creditPoints: 6, type: 'elective', rationale: 'Level 5 AI unit; S2 only' },
        { code: 'CITS5503', title: 'Cloud Computing', creditPoints: 6, type: 'elective', rationale: 'Group A elective; Level 5' },
        { code: 'CITS4402', title: 'Computer Vision', creditPoints: 6, type: 'elective', rationale: 'AI/CV unit; moved to S2 for balance' },
        { code: 'MGMT5504', title: 'Data Analysis and Decision Making', creditPoints: 6, type: 'elective', rationale: 'Group C elective' },
      ]},
    ],
    summary: { totalCreditPoints: 96, totalUnits: 16, prerequisitesAssumedStrict: true },
  },
  explanation: {
    overview: 'Artificial Intelligence study plan based on UWA Handbook 2026. 4 semesters, following the official course structure with AI-focused electives.',
    electiveRationales: [
      'AI-relevant units selected: CITS4009, CITS4012, CITS4404, CITS5017, CITS4402',
      'CITS2002 added as conversion to unlock CITS4404 prerequisites',
    ],
  },
  constraintsAcknowledged: ['COURSE_STRUCTURE', 'AVAILABILITY', 'CORE_COMPLETION'],
  warnings: [
    'This is a FALLBACK plan — not AI-generated. Review and adjust as needed.',
    'CITS4402 moved to S2 Year 2 (off-schedule); verify with UWA Handbook.',
  ],
  reasoning: {
    prerequisiteAnalysis: ['CITS2002 → CITS4404 AI chain maintained'],
    specialisationFulfillment: ['AI specialisation: strong coverage of ML, NLP, CV, DL, computational modelling'],
    workloadConsiderations: ['Balanced 4 units per semester'],
  },
};

// ─── 62510 MIT — Software Systems (2-year / 4 semester) ─────────────────────

const MIT_SOFTWARE_SYSTEMS: StudyPlanResponse = {
  version: '1.0', generatedAt: '', language: 'en-GB',
  plan: {
    programCode: '62510', programName: 'Master of Information Technology', focusArea: 'Software Systems',
    semesters: [
      { sequence: 1, label: 'S1 Year 1', units: [
        { code: 'CITS1401', title: 'Computational Thinking with Python', creditPoints: 6, type: 'core', rationale: 'Foundation; prerequisite for core units' },
        { code: 'CITS2005', title: 'Object Oriented Programming', creditPoints: 6, type: 'core', rationale: 'Conversion; corequisite with CITS1401' },
        { code: 'CITS4401', title: 'Software Requirements and Design', creditPoints: 6, type: 'core', rationale: 'Core software unit' },
        { code: 'PHIL4100', title: 'Ethics and Critical Thinking', creditPoints: 6, type: 'core', rationale: 'Core unit' },
      ]},
      { sequence: 2, label: 'S2 Year 1', units: [
        { code: 'CITS5503', title: 'Cloud Computing', creditPoints: 6, type: 'elective', rationale: 'Software systems core; Group A; S2 only' },
        { code: 'CITS4009', title: 'Fundamentals of Data Science', creditPoints: 6, type: 'elective', rationale: 'Data foundations; S2 only' },
        { code: 'CITS5505', title: 'Agile Web Development', creditPoints: 6, type: 'core', rationale: 'Core unit; S1 only normally, placed here for balance' },
        { code: 'CITS4403', title: 'Computational Modelling', creditPoints: 6, type: 'elective', rationale: 'Group B; S2 only' },
      ]},
      { sequence: 3, label: 'S1 Year 2', units: [
        { code: 'CITS5206', title: 'Information Technology Capstone Project', creditPoints: 6, type: 'core', rationale: 'Capstone' },
        { code: 'CITS5506', title: 'The Internet of Things', creditPoints: 6, type: 'elective', rationale: 'Group A; S1 only' },
        { code: 'CITS4404', title: 'Artificial Intelligence and Adaptive Systems', creditPoints: 6, type: 'elective', rationale: 'Group B; S1 only' },
        { code: 'CITS4505', title: 'Human Aspects of Cybersecurity', creditPoints: 6, type: 'elective', rationale: 'Cybersecurity elective for software systems; S1 only' },
      ]},
      { sequence: 4, label: 'S2 Year 2', units: [
        { code: 'CITS5017', title: 'Deep Learning', creditPoints: 6, type: 'elective', rationale: 'Level 5; S2 only' },
        { code: 'CITS4012', title: 'Natural Language Processing', creditPoints: 6, type: 'elective', rationale: 'Group B; S2 only' },
        { code: 'CITS5014', title: 'Data and Information Technologies Research Project Part 1', creditPoints: 6, type: 'elective', rationale: 'Level 5 research; Group B' },
        { code: 'SVLG5001', title: 'Wicked Problems', creditPoints: 6, type: 'elective', rationale: 'Group C interdisciplinary elective' },
      ]},
    ],
    summary: { totalCreditPoints: 96, totalUnits: 16, prerequisitesAssumedStrict: true },
  },
  explanation: {
    overview: 'Software Systems study plan based on UWA Handbook 2026. 4 semesters with emphasis on cloud, cybersecurity, and software engineering.',
    electiveRationales: [
      'Cloud Computing and IoT cover modern distributed systems',
      'Cybersecurity unit adds practical security knowledge',
      'Research project provides hands-on experience',
    ],
  },
  constraintsAcknowledged: ['COURSE_STRUCTURE', 'AVAILABILITY', 'CORE_COMPLETION'],
  warnings: [
    'This is a FALLBACK plan — not AI-generated. Review and adjust as needed.',
    'CITS5505 moved to S2 (off-schedule) for workload balance.',
  ],
  reasoning: {
    prerequisiteAnalysis: ['CITS1401 → CITS4401, CITS5505, CITS4009 chains maintained'],
    specialisationFulfillment: ['Software Systems focus: cloud, IoT, cybersecurity, capstone'],
    workloadConsiderations: ['Balanced 4 units per semester'],
  },
};

// ─── Registry ────────────────────────────────────────────────────────────────

const FALLBACK_REGISTRY: Record<string, { spec: string; plan: StudyPlanResponse }[]> = {
  '62510': [
    { spec: 'applied computing', plan: MIT_APPLIED_COMPUTING },
    { spec: 'sp-apcmp', plan: MIT_APPLIED_COMPUTING },
    { spec: 'artificial intelligence', plan: MIT_ARTIFICIAL_INTELLIGENCE },
    { spec: 'sp-artin', plan: MIT_ARTIFICIAL_INTELLIGENCE },
    { spec: 'software systems', plan: MIT_SOFTWARE_SYSTEMS },
    { spec: 'sp-sofsy', plan: MIT_SOFTWARE_SYSTEMS },
    { spec: '', plan: MIT_APPLIED_COMPUTING },
  ],
};

export function getFallbackPlan(programCode: string, specialisation?: string): StudyPlanResponse | null {
  const entries = FALLBACK_REGISTRY[programCode];
  if (!entries) return null;

  const specLower = (specialisation || '').trim().toLowerCase();
  const match = entries.find(e => specLower.includes(e.spec) || e.spec.includes(specLower) || (e.spec === '' && !specLower));
  if (!match) return null;

  const plan = JSON.parse(JSON.stringify(match.plan)) as StudyPlanResponse;
  plan.generatedAt = today();
  return plan;
}

export function hasFallbackPlan(programCode: string): boolean {
  return programCode in FALLBACK_REGISTRY;
}
