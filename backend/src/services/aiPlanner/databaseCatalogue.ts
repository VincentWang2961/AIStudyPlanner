import {
  fetchCourseByCode,
  fetchGroupsForCourse,
  fetchUnitsForCourse,
  fetchUnitsForGroup,
} from '../courseService';
import { PlannerUnit, ProgramCatalogue, UnitType, SpecialisationInfo } from './types';

type DbCourse = {
  code: string;
  title: string;
  min_points: number | null;
  max_points: number | null;
  time_limit_years: number | null;
};

type DbGroup = {
  id: string | number;
  group_code: string;
  name: string;
  rule_text: string | null;
};

type DbUnit = {
  code: string;
  title: string;
  curriculum_type: string | null;
  availabilities: string | null;
  prerequisites_parsed: unknown;
  prerequisites_raw: string | null;
  description?: string | null;
};

function parseAvailability(value: string | null): string[] {
  if (!value || value === 'N/A') {
    return ['N/A'];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function collectUnitCodesFromRule(rule: unknown): string[] {
  if (!rule || typeof rule !== 'object') {
    return [];
  }

  const data = rule as Record<string, unknown>;
  const type = typeof data.type === 'string' ? data.type.toUpperCase() : '';
  const code = typeof data.code === 'string' ? data.code : null;
  const children = Array.isArray(data.children) ? data.children : [];
  const rules = Array.isArray(data.rules) ? data.rules : [];

  const nestedCodes = [...children, ...rules].flatMap(collectUnitCodesFromRule);

  if ((type === 'UNIT' || type === 'UNIT_CODE') && code) {
    return Array.from(new Set([code, ...nestedCodes]));
  }

  return Array.from(new Set(nestedCodes));
}

function inferUnitType(unitCode: string, coreUnitCodes: Set<string>): UnitType {
  return coreUnitCodes.has(unitCode) ? 'core' : 'elective';
}

function buildConstraints(course: DbCourse, groups: DbGroup[]) {
  const constraints: { code: string; description: string; priority: 'mandatory' | 'preferred' | 'informational' }[] = [
    {
      code: 'STRICT_PREREQUISITES',
      description: 'All prerequisite chains must be satisfied before dependent units are scheduled.',
      priority: 'mandatory',
    },
  ];

  if (course.max_points || course.min_points) {
    constraints.push({
      code: 'CREDIT_POINTS',
      description: `The programme requires ${course.min_points ?? course.max_points} to ${course.max_points ?? course.min_points} credit points.`,
      priority: 'informational',
    });
  }

  if (course.time_limit_years) {
    constraints.push({
      code: 'TIME_LIMIT',
      description: `The programme must be completed within ${course.time_limit_years} years.`,
      priority: 'informational',
    });
  }

  for (const group of groups) {
    if (!group.rule_text) continue;

    constraints.push({
      code: `GROUP_${group.group_code}`,
      description: `${group.name}: ${group.rule_text}`,
      priority: 'preferred',
    });
  }

  // Capstone constraint for MIT (62510)
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
      description: 'CITS5014 and CITS5015 are a two-part research project. If selected, BOTH must be taken with CITS5014 before CITS5015. CITS5014 requires at least 2 semesters of prior study (earliest start: semester 3).',
      priority: 'mandatory',
    });
    constraints.push({
      code: 'CONVERSION_MUTUALLY_EXCLUSIVE',
      description: 'CITS2002 (Systems Programming) and CITS2005 (Object Oriented Programming) are conversion units. You ONLY need ONE of them, NOT BOTH. Including both wastes a slot. Choose the one that best fits the plan.',
      priority: 'mandatory',
    });
  }

  return constraints;
}

async function getCoreUnitCodes(groups: DbGroup[]): Promise<Set<string>> {
  const coreCodes = new Set<string>();

  for (const group of groups) {
    // Only the course-level CORE group (not spec-specific groups like SP-ARTIN_CORE)
    if (group.group_code !== 'CORE') {
      continue;
    }

    const groupUnits = await fetchUnitsForGroup(Number(group.id));

    for (const unit of groupUnits as DbUnit[]) {
      coreCodes.add(unit.code);
    }
  }

  return coreCodes;
}

function toPlannerUnit(unit: DbUnit, coreUnitCodes: Set<string>): PlannerUnit {
  const prerequisites = collectUnitCodesFromRule(unit.prerequisites_parsed)
    // Filter out self-references (e.g. CITS5206 requiring itself)
    .filter((code) => code !== unit.code);

  return {
    code: unit.code,
    title: unit.title,
    creditPoints: 6,
    type: inferUnitType(unit.code, coreUnitCodes),
    availability: parseAvailability(unit.availabilities),
    prerequisites,
    incompatibilities: [],
    corequisites: [],
    description: unit.description?.trim() || `Programme unit. ${unit.prerequisites_raw ? `Prerequisites: ${unit.prerequisites_raw}` : ''}`.trim(),
  };
}

export async function getProgrammeCatalogueFromDb(programCode: string): Promise<ProgramCatalogue | null> {
  const course = await fetchCourseByCode(programCode) as DbCourse | null;

  if (!course) {
    return null;
  }

  const groups = await fetchGroupsForCourse(programCode) as DbGroup[];
  const units = await fetchUnitsForCourse(programCode) as DbUnit[];

  if (units.length === 0) {
    return null;
  }

  const coreUnitCodes = await getCoreUnitCodes(groups);

  // Filter out excluded units for this course
  const excludedUnits = course.code === '62510' ? ['CITS4009'] : [];
  const filteredUnits = units.filter((unit) => !excludedUnits.includes(unit.code));
  
  // Build specialisation info from DB groups
  const courseSpecialisations: SpecialisationInfo[] = [];
  const specCoreUnits = new Map<string, string[]>(); // spec_code → unit codes
  const specElectives = new Map<string, string[]>();
  
  for (const group of groups) {
    // Match spec core groups like SP-ARTIN_CORE
    const coreMatch = group.group_code.match(/^(SP-\w+)_CORE$/);
    if (coreMatch) {
      const specCode = coreMatch[1];
      const groupUnits = await fetchUnitsForGroup(Number(group.id));
      const codes = (groupUnits as DbUnit[]).map(u => u.code);
      specCoreUnits.set(specCode, codes);
    }
    // Match spec group rules like SP-APCMP_GROUP_A
    const groupMatch = group.group_code.match(/^(SP-\w+)_GROUP_/);
    if (groupMatch) {
      const specCode = groupMatch[1];
      const groupUnits = await fetchUnitsForGroup(Number(group.id));
      const codes = (groupUnits as DbUnit[]).map(u => u.code);
      const existing = specElectives.get(specCode) || [];
      specElectives.set(specCode, [...new Set([...existing, ...codes])]);
    }
  }

  // Try reading specialisations from course metadata
  if (typeof (course as any).specialisations !== 'undefined') {
    try {
      const specs = JSON.parse(JSON.stringify((course as any).specialisations)) as any[];
      for (const spec of specs) {
        if (spec && spec.name) {
          const specCode = spec.code || spec.name;
          courseSpecialisations.push({
            code: specCode,
            name: spec.name,
            coreUnits: specCoreUnits.get(specCode) || [],
            electiveOptions: specElectives.get(specCode) || [],
            description: spec.description || `${spec.name} specialisation`,
          });
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  return {
    programCode: course.code,
    programName: course.title,
    totalCreditPoints: course.max_points ?? course.min_points ?? units.length * 6,
    defaultUnitsPerSemester: 4,
    constraints: buildConstraints(course, groups),
    units: filteredUnits.map((unit) => toPlannerUnit(unit, coreUnitCodes)),
    specialisations: courseSpecialisations,
    sequenceData: [],
    prerequisiteChains: [],
  };
}
