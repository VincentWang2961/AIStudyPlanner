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
  const constraints = [
    {
      code: 'STRICT_PREREQUISITES',
      description: 'All prerequisite chains must be satisfied before dependent units are scheduled.',
    },
  ];

  if (course.max_points || course.min_points) {
    constraints.push({
      code: 'CREDIT_POINTS',
      description: `The programme requires ${course.min_points ?? course.max_points} to ${course.max_points ?? course.min_points} credit points.`,
    });
  }

  if (course.time_limit_years) {
    constraints.push({
      code: 'TIME_LIMIT',
      description: `The programme must be completed within ${course.time_limit_years} years.`,
    });
  }

  for (const group of groups) {
    if (!group.rule_text) continue;

    constraints.push({
      code: `GROUP_${group.group_code}`,
      description: `${group.name}: ${group.rule_text}`,
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
    description: unit.prerequisites_raw
      ? `Prerequisites: ${unit.prerequisites_raw}`
      : unit.curriculum_type ?? 'Programme unit',
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
