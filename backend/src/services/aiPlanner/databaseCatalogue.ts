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
  }

  return constraints;
}

async function getCoreUnitCodes(groups: DbGroup[]): Promise<Set<string>> {
  const coreCodes = new Set<string>();

  for (const group of groups) {
    const label = `${group.group_code} ${group.name}`.toLowerCase();

    if (!label.includes('core') && !label.includes('take all')) {
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
  const prerequisites = collectUnitCodesFromRule(unit.prerequisites_parsed);

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

  // Attempt to read specialisations from course data if available
  const courseSpecialisations: SpecialisationInfo[] = [];
  if (typeof (course as any).specialisations !== 'undefined') {
    try {
      const specs = JSON.parse(JSON.stringify((course as any).specialisations)) as any[];
      for (const spec of specs) {
        if (spec && spec.name) {
          courseSpecialisations.push({
            code: spec.code || spec.name,
            name: spec.name,
            coreUnits: [],
            electiveOptions: [],
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
    units: units.map((unit) => toPlannerUnit(unit, coreUnitCodes)),
    specialisations: courseSpecialisations,
    sequenceData: [],
    prerequisiteChains: [],
  };
}
