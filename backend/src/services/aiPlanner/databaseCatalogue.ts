import { promises as fs } from 'fs';
import path from 'path';
import { PlannerUnit, ProgramCatalogue, UnitType, SpecialisationInfo } from './types';

type StaticCourse = {
  code: string;
  title: string;
  minimumPoints?: number | null;
  maximumPoints?: number | null;
  specialisations?: StaticSpecialisation[];
  units: StaticUnit[];
  groups?: StaticGroup[];
};

type StaticSpecialisation = {
  code: string;
  name: string;
  description?: string | null;
};

type StaticUnit = {
  code: string;
  title: string;
  availabilities?: string[];
  description?: string | null;
  prerequisiteRaw?: string | null;
  corequisiteRaw?: string | null;
  incompatibilityRaw?: string | null;
};

type StaticGroup = {
  groupCode: string;
  groupName: string;
  ruleText?: string | null;
  units?: { code: string; title: string }[];
};

const PROGRAM_SLUGS: Record<string, string> = {
  '62510': 'master-of-information-technology',
};

const MIT_CORE_UNITS = new Set([
  'CITS4401',
  'CITS5206',
  'CITS5505',
  'PHIL4100',
]);

const MIT_SPECIALISATION_CORE_UNITS: Record<string, string[]> = {
  SP_APCMP: [], // Applied Computing: no fixed core, pick 24CP from CITS electives
  SP_ARTIN: ['CITS4012', 'CITS4404', 'CITS5017', 'CITS5508'],
  SP_SOFSY: ['CITS5501', 'CITS5503', 'CITS5506', 'CITS5507'],
};

function getAiDataRoot(): string {
  return path.resolve(__dirname, '../../..', 'ai_data');
}

function parseAvailability(value: string[] | undefined): string[] {
  if (!value || value.length === 0) {
    return ['N/A'];
  }

  return value.map((item) => item.trim()).filter(Boolean);
}

function extractUnitCodes(value: string | null | undefined): string[] {
  if (!value) return [];
  return Array.from(new Set(value.match(/\b[A-Z]{4}\d{4}\b/g) ?? []));
}

function inferUnitType(unitCode: string, coreUnitCodes: Set<string>): UnitType {
  return coreUnitCodes.has(unitCode) ? 'core' : 'elective';
}

function buildConstraints(course: StaticCourse, groups: StaticGroup[]) {
  const constraints: { code: string; description: string; priority: 'mandatory' | 'preferred' | 'informational' }[] = [
    {
      code: 'STRICT_PREREQUISITES',
      description: 'All prerequisite chains must be satisfied before dependent units are scheduled.',
      priority: 'mandatory',
    },
  ];

  const minPoints = course.minimumPoints ?? course.maximumPoints ?? null;
  const maxPoints = course.maximumPoints ?? course.minimumPoints ?? null;
  if (minPoints || maxPoints) {
    constraints.push({
      code: 'CREDIT_POINTS',
      description: `The programme requires ${minPoints ?? maxPoints} to ${maxPoints ?? minPoints} credit points.`,
      priority: 'informational',
    });
  }

  for (const group of groups) {
    if (!group.ruleText) continue;

    constraints.push({
      code: `GROUP_${group.groupCode}`,
      description: `${group.groupName}: ${group.ruleText}`,
      priority: 'preferred',
    });
  }

  if (course.code === '62510') {
    constraints.push({
      code: 'CAPSTONE_LAST_SEMESTER',
      description: 'CITS5206 (IT Capstone Project) is MANDATORY and MUST be placed in the final semester. The final semester should still contain a normal full load of 4 units — CITS5206 takes only ONE slot.',
      priority: 'mandatory',
    });
    constraints.push({
      code: 'PREFER_CITS_UNITS',
      description: 'PREFER CITS-prefixed units (CITSxxxx) for elective slots. Non-CITS units (INMT, MGMT, PHIL, SVLG, AUTO, ENVT) are interdisciplinary electives and should only be used if no suitable CITS alternative exists.',
      priority: 'preferred',
    });
    constraints.push({
      code: 'RESEARCH_PROJECT_PAIR',
      description: 'CITS5014 (Research Project Part 1) and CITS5015 (Research Project Part 2) are a two-semester research sequence. RECOMMEND these when student mentions research/thesis. If included: CITS5014 in semester 3, CITS5015 in semester 4, consecutive semesters required. WAM ≥ 70 invitation-only.',
      priority: 'mandatory',
    });
    constraints.push({
      code: 'CONVERSION_MUTUALLY_EXCLUSIVE',
      description: 'CITS2002 (Systems Programming) and CITS2005 (Object Oriented Programming) are conversion units. You ONLY need ONE of them, NOT BOTH. Including both wastes a slot. Choose the one that best fits the plan.',
      priority: 'mandatory',
    });
    constraints.push({
      code: 'MIT_MANDATORY_CORE',
      description: 'MANDATORY core units that MUST be in EVERY MIT plan: CITS1003, CITS1401, CITS1402, PHIL4100, CITS4401, CITS5505, CITS4403, CITS5206, CITS5503, CITS5507. Conversion (pick ONE): CITS2002 or CITS2005. DO NOT skip CITS5505 (Agile Web Development) — it is a REQUIRED core unit.',
      priority: 'mandatory',
    });
    constraints.push({
      code: 'AVOID_CITS4009',
      description: 'WARNING: CITS4009 (Fundamentals of Data Science) is marked as an elective and is RARELY taken by real MIT students. DO NOT include CITS4009 in plans unless the student explicitly requests it or it is required by a specific specialisation (Applied Computing). Instead, fill elective slots with other CITS units.',
      priority: 'mandatory',
    });
    constraints.push({
      code: 'SVLG5001_MIN_SEMESTER',
      description: 'SVLG5001 (McCusker Internship) requires at least 2 semesters of prior study. Earliest placement: semester 3. Do NOT place SVLG5001 in semester 1 or 2.',
      priority: 'mandatory',
    });
  }

  return constraints;
}

function getCoreUnitCodes(course: StaticCourse): Set<string> {
  if (course.code === '62510') {
    return new Set(MIT_CORE_UNITS);
  }

  const coreGroup = course.groups?.find((group) => group.groupCode === 'CORE');
  return new Set(coreGroup?.units?.map((unit) => unit.code) ?? []);
}

function toPlannerUnit(unit: StaticUnit, coreUnitCodes: Set<string>): PlannerUnit {
  return {
    code: unit.code,
    title: unit.title,
    creditPoints: 6,
    type: inferUnitType(unit.code, coreUnitCodes),
    availability: parseAvailability(unit.availabilities),
    prerequisites: extractUnitCodes(unit.prerequisiteRaw).filter((code) => code !== unit.code),
    incompatibilities: extractUnitCodes(unit.incompatibilityRaw).filter((code) => code !== unit.code),
    corequisites: extractUnitCodes(unit.corequisiteRaw).filter((code) => code !== unit.code),
    description: unit.description?.trim() || `Programme unit. ${unit.prerequisiteRaw ? `Prerequisites: ${unit.prerequisiteRaw}` : ''}`.trim(),
  };
}

function buildSpecialisations(course: StaticCourse): SpecialisationInfo[] {
  const groupsByCode = new Map((course.groups ?? []).map((group) => [group.groupCode, group]));

  return (course.specialisations ?? []).map((specialisation) => {
    const group = groupsByCode.get(specialisation.code);
    const groupUnitCodes = group?.units?.map((unit) => unit.code) ?? [];
    const coreUnits = MIT_SPECIALISATION_CORE_UNITS[specialisation.code] ?? [];

    return {
      code: specialisation.code,
      name: specialisation.name,
      coreUnits,
      electiveOptions: groupUnitCodes.filter((code) => !coreUnits.includes(code)),
      description: specialisation.description || `${specialisation.name} specialisation`,
    };
  });
}

async function readStaticCourse(programCode: string): Promise<StaticCourse | null> {
  const slug = PROGRAM_SLUGS[programCode];
  if (!slug) {
    return null;
  }

  const filePath = path.join(getAiDataRoot(), slug, 'course_rules.json');
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as StaticCourse;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function getProgrammeCatalogueFromDb(programCode: string): Promise<ProgramCatalogue | null> {
  const course = await readStaticCourse(programCode);

  if (!course || course.units.length === 0) {
    return null;
  }

  const groups = course.groups ?? [];
  const coreUnitCodes = getCoreUnitCodes(course);

  return {
    programCode: course.code,
    programName: course.title,
    totalCreditPoints: course.maximumPoints ?? course.minimumPoints ?? course.units.length * 6,
    defaultUnitsPerSemester: 4,
    constraints: buildConstraints(course, groups),
    units: course.units.map((unit) => toPlannerUnit(unit, coreUnitCodes)),
    specialisations: buildSpecialisations(course),
    sequenceData: [],
    prerequisiteChains: [],
  };
}
