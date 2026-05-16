/**
 * Mock Programme Catalogue — UWA Handbook 2026 Edition
 *
 * Sourced from data/courses.json (authoritative dataset).
 * Contains ALL 28 units for 62510 Master of IT.
 * Used as fallback when database catalogue is unavailable.
 */

import { ProgramCatalogue, SpecialisationInfo } from './types';

// ─── Specialisations ────────────────────────────────────────────────────────
// Derived from courses.json + UWA Handbook 2026 course structure

const specialisations: SpecialisationInfo[] = [
  {
    code: 'SP-APCMP',
    name: 'Applied Computing',
    coreUnits: ['CITS4009', 'CITS4012', 'CITS4401', 'CITS5505'],
    electiveOptions: [
      'CITS4402', 'CITS4403', 'CITS4404', 'CITS4407',
      'CITS5503', 'CITS5506', 'CITS5206', 'CITS5017',
    ],
    description: 'Focus on practical computing skills across software, data, and systems.',
  },
  {
    code: 'SP-ARTIN',
    name: 'Artificial Intelligence',
    coreUnits: ['CITS4009', 'CITS4012', 'CITS4404', 'CITS5017'],
    electiveOptions: [
      'CITS4402', 'CITS4403', 'CITS4419', 'CITS5506',
    ],
    description: 'Deep dive into AI, machine learning, and intelligent systems.',
  },
  {
    code: 'SP-SOFSY',
    name: 'Software Systems',
    coreUnits: ['CITS4401', 'CITS5503', 'CITS5206', 'CITS5017'],
    electiveOptions: [
      'CITS4403', 'CITS4407', 'CITS4419', 'CITS4505', 'CITS5506', 'CITS5014',
    ],
    description: 'Advanced software engineering, cloud systems, and cybersecurity.',
  },
];

// ─── Prerequisite Chains ────────────────────────────────────────────────────
// Extracted from course prerequisites in courses.json

const prerequisiteChains: string[][] = [
  // Foundation → Intermediate → Advanced chains
  ['CITS1401', 'CITS4401'],
  ['CITS1401', 'CITS5505'],
  ['CITS1401', 'CITS4012'],
  ['CITS1401', 'CITS4402'],
  ['CITS1401', 'CITS4403'],
  ['CITS1401', 'CITS5506'],
  ['CITS1401', 'CITS2002', 'CITS4404'],
  ['CITS1401', 'CITS2002', 'CITS5503'],
  ['CITS1401', 'CITS2002', 'CITS4505'],
  // Research project chain
  ['CITS5014', 'CITS5015'],
];

// ─── Constraints ────────────────────────────────────────────────────────────

const constraints: ProgramCatalogue['constraints'] = [
  {
    code: 'STRICT_PREREQUISITES',
    description: 'All prerequisite chains must be satisfied before enrolling in dependent units.',
    priority: 'mandatory',
  },
  {
    code: 'AVAILABILITY_ONLY',
    description: 'Units should only be placed in semesters where they are offered in the catalogue.',
    priority: 'preferred',
  },
  {
    code: 'CORE_COMPLETION',
    description: 'Core units (CITS4401, CITS5505, CITS5206, PHIL4100) are compulsory and should be prioritised.',
    priority: 'preferred',
  },
  {
    code: 'TOTAL_CREDIT_TARGET',
    description: 'The study plan should reach 96 credit points.',
    priority: 'informational',
  },
  {
    code: 'GROUP_REQUIREMENTS',
    description: 'Take ≥6 pts Group A, ≥6 pts Group B (incl. ≥6 pts Level 5), 12-36 pts Group C.',
    priority: 'informational',
  },
];

// ─── 62510 MIT — All 28 Units (from courses.json) ──────────────────────────

const mitUnits: ProgramCatalogue['units'] = [
  // ── Level 1 Conversion/Foundation Units ──
  {
    code: 'CITS1003', title: 'Introduction to Cybersecurity', creditPoints: 6,
    type: 'elective', availability: ['S1', 'S2'],
    prerequisites: [], incompatibilities: ['CITS3004'], corequisites: [],
    description: 'Foundational cybersecurity concepts. Incompatible with CITS3004 Cybersecurity.',
    isFoundationUnit: true, sequenceOrder: 0,
  },
  {
    code: 'CITS1401', title: 'Computational Thinking with Python', creditPoints: 6,
    type: 'core', availability: ['S1', 'S2'],
    prerequisites: [], incompatibilities: ['CITS2401'], corequisites: [],
    description: 'Computational problem-solving with Python. Foundation for most IT units.',
    isFoundationUnit: true, sequenceOrder: 0,
  },
  {
    code: 'CITS1402', title: 'Relational Database Management Systems', creditPoints: 6,
    type: 'elective', availability: ['S1', 'S2'],
    prerequisites: [], incompatibilities: ['CITS2232'], corequisites: [],
    description: 'Relational database design and SQL. Incompatible with CITS2232 Databases.',
    isFoundationUnit: true, sequenceOrder: 0,
  },

  // ── Level 2 Conversion Units ──
  {
    code: 'CITS2002', title: 'Systems Programming', creditPoints: 6,
    type: 'elective', availability: ['S2'],
    prerequisites: ['CITS1401'], incompatibilities: ['CITS1002'], corequisites: [],
    description: 'Systems-level programming with C. Prerequisite: CITS1401 or equivalent.',
    sequenceOrder: 1,
  },
  {
    code: 'CITS2005', title: 'Object Oriented Programming', creditPoints: 6,
    type: 'core', availability: ['S1'],
    prerequisites: [], incompatibilities: ['CITS1001', 'CITX1001'], corequisites: ['CITS1401'],
    description: 'Object-oriented programming with Java. Corequisite: CITS1401.',
    sequenceOrder: 1,
  },

  // ── Level 4 Postgraduate Core Units ──
  {
    code: 'CITS4009', title: 'Fundamentals of Data Science', creditPoints: 6,
    type: 'core', availability: ['S2'],
    prerequisites: [], incompatibilities: [], corequisites: [],
    description: 'Foundational data analysis and computational thinking for postgraduate IT students.',
    sequenceOrder: 2,
  },
  {
    code: 'CITS4012', title: 'Natural Language Processing', creditPoints: 6,
    type: 'core', availability: ['S2'],
    prerequisites: ['CITS1401'], incompatibilities: [], corequisites: [],
    description: 'Statistical and neural NLP techniques. Prerequisite: CITS1401 or equivalent.',
    sequenceOrder: 2,
  },
  {
    code: 'CITS4401', title: 'Software Requirements and Design', creditPoints: 6,
    type: 'core', availability: ['S1'],
    prerequisites: ['CITS1401'], incompatibilities: [], corequisites: [],
    description: 'Core unit. Software requirements engineering and design methodologies.',
    sequenceOrder: 2,
  },
  {
    code: 'CITS4402', title: 'Computer Vision', creditPoints: 6,
    type: 'elective', availability: ['S1'],
    prerequisites: ['CITS1401'], incompatibilities: ['CITS4240'], corequisites: [],
    description: 'Image processing and visual learning techniques.',
    sequenceOrder: 3,
  },
  {
    code: 'CITS4403', title: 'Computational Modelling', creditPoints: 6,
    type: 'elective', availability: ['S2'],
    prerequisites: ['CITS1401'], incompatibilities: [], corequisites: [],
    description: 'Computational simulation and modelling techniques.',
    sequenceOrder: 3,
  },
  {
    code: 'CITS4404', title: 'Artificial Intelligence and Adaptive Systems', creditPoints: 6,
    type: 'elective', availability: ['S1'],
    prerequisites: ['CITS2002', 'CITS1401'], incompatibilities: [], corequisites: [],
    description: 'Search, reasoning, and intelligent agent methods.',
    sequenceOrder: 3,
  },
  {
    code: 'CITS4407', title: 'Open Source Tools and Scripting', creditPoints: 6,
    type: 'elective', availability: ['S1'],
    prerequisites: [], incompatibilities: [], corequisites: [],
    description: 'Linux environments, shell scripting, and open source development workflows.',
    sequenceOrder: 3,
  },
  {
    code: 'CITS4419', title: 'Mobile and Wireless Computing', creditPoints: 6,
    type: 'elective', availability: ['S2'],
    prerequisites: ['CITS3002'], incompatibilities: [], corequisites: [],
    description: 'Mobile application development and wireless networking.',
    sequenceOrder: 3,
  },
  {
    code: 'CITS4505', title: 'Human Aspects of Cybersecurity', creditPoints: 6,
    type: 'elective', availability: ['S1'],
    prerequisites: ['CITS2002'], incompatibilities: [], corequisites: [],
    description: 'Human factors in cybersecurity including social engineering and usable security.',
    sequenceOrder: 3,
  },
  {
    code: 'PHIL4100', title: 'Ethics and Critical Thinking', creditPoints: 6,
    type: 'core', availability: ['S1', 'S2'],
    prerequisites: [], incompatibilities: [], corequisites: [],
    description: 'Core unit for MIT. Ethical reasoning and critical thinking for IT professionals.',
    sequenceOrder: 2,
  },

  // ── Level 5 Postgraduate Units ──
  {
    code: 'CITS5014', title: 'Data and Information Technologies Research Project Part 1', creditPoints: 6,
    type: 'elective', availability: ['S1', 'S2'],
    prerequisites: [], incompatibilities: ['CITS5011'], corequisites: [],
    description: 'Research project Part 1. Requires WAM ≥70% and 24 points of level 4/5 units completed.',
    sequenceOrder: 4,
  },
  {
    code: 'CITS5015', title: 'Data and Information Technologies Research Project Part 2', creditPoints: 6,
    type: 'elective', availability: ['S1', 'S2'],
    prerequisites: ['CITS5014'], incompatibilities: ['CITS5012'], corequisites: [],
    description: 'Research project Part 2. Continuation of CITS5014.',
    sequenceOrder: 5,
  },
  {
    code: 'CITS5017', title: 'Deep Learning', creditPoints: 6,
    type: 'elective', availability: ['S2'],
    prerequisites: [], incompatibilities: [], corequisites: [],
    description: 'Neural network architectures and deep learning workflows.',
    sequenceOrder: 4,
  },
  {
    code: 'CITS5206', title: 'Information Technology Capstone Project', creditPoints: 6,
    type: 'core', availability: ['S1', 'S2'],
    prerequisites: [], incompatibilities: [], corequisites: [],
    description: 'Core unit. Capstone project integrating technical design and professional practice.',
    sequenceOrder: 5,
  },
  {
    code: 'CITS5503', title: 'Cloud Computing', creditPoints: 6,
    type: 'elective', availability: ['S2'],
    prerequisites: ['CITS2002', 'CITS1401'], incompatibilities: [], corequisites: [],
    description: 'Distributed systems, cloud architecture, and scalable services.',
    sequenceOrder: 4,
  },
  {
    code: 'CITS5505', title: 'Agile Web Development', creditPoints: 6,
    type: 'core', availability: ['S1'],
    prerequisites: ['CITS1401'], incompatibilities: ['CITS3403'], corequisites: [],
    description: 'Core unit. Modern web development with agile methodologies.',
    sequenceOrder: 3,
  },
  {
    code: 'CITS5506', title: 'The Internet of Things', creditPoints: 6,
    type: 'elective', availability: ['S1'],
    prerequisites: ['CITS1401'], incompatibilities: [], corequisites: [],
    description: 'IoT systems, sensors, and embedded programming.',
    sequenceOrder: 4,
  },

  // ── Interdisciplinary Electives (Group C) ──
  {
    code: 'AUTO4508', title: 'Mobile Robots', creditPoints: 6,
    type: 'elective', availability: ['S1'],
    prerequisites: [], incompatibilities: [], corequisites: [],
    description: 'Robotics and autonomous systems.',
    sequenceOrder: 4,
  },
  {
    code: 'ENVT4411', title: 'Geographic Information Systems Applications', creditPoints: 6,
    type: 'elective', availability: ['S1'],
    prerequisites: [], incompatibilities: [], corequisites: [],
    description: 'GIS techniques and spatial data analysis.',
    sequenceOrder: 4,
  },
  {
    code: 'INMT5518', title: 'Supply Chain Management', creditPoints: 6,
    type: 'elective', availability: ['S2'],
    prerequisites: [], incompatibilities: [], corequisites: [],
    description: 'Supply chain and logistics management.',
    sequenceOrder: 4,
  },
  {
    code: 'INMT5526', title: 'Business Intelligence', creditPoints: 6,
    type: 'elective', availability: ['S2'],
    prerequisites: [], incompatibilities: [], corequisites: [],
    description: 'Business intelligence and data-driven decision making.',
    sequenceOrder: 4,
  },
  {
    code: 'MGMT5504', title: 'Data Analysis and Decision Making', creditPoints: 6,
    type: 'elective', availability: ['S1', 'S2'],
    prerequisites: [], incompatibilities: [], corequisites: [],
    description: 'Statistical analysis for management decision making.',
    sequenceOrder: 4,
  },
  {
    code: 'SVLG5001', title: 'Wicked Problems', creditPoints: 6,
    type: 'elective', availability: ['S2'],
    prerequisites: [], incompatibilities: [], corequisites: [],
    description: 'Interdisciplinary approaches to complex societal challenges.',
    sequenceOrder: 4,
  },
];

// ─── Catalogue ──────────────────────────────────────────────────────────────

const mockProgrammes: Record<string, ProgramCatalogue> = {
  '62510': {
    programCode: '62510',
    programName: 'Master of Information Technology',
    totalCreditPoints: 96,
    defaultUnitsPerSemester: 4,
    specialisations,
    sequenceData: [],
    prerequisiteChains,
    constraints,
    units: mitUnits,
  },
};

export function getMockProgrammeCatalogue(programmeCode: string): ProgramCatalogue | null {
  return mockProgrammes[programmeCode] ?? null;
}
