import path from "path";
import { parseExcel } from "./parser/excelParser";
import { parsePDF } from "./parser/pdfParser";

type LocalUnit = {
  code: string;
  title: string;
  curriculum_type: string | null;
  source_id: string | null;
  status: string | null;
  availabilities: string | null;
  prerequisites_raw: string | null;
  prerequisites_parsed: unknown | null;
  corequisites_raw: string | null;
  corequisites_parsed: unknown | null;
  incompatibilities_raw: string | null;
  incompatibilities_parsed: unknown | null;
};

type LocalGroup = {
  id: number;
  course_code: string;
  group_code: string;
  name: string;
  rule_text: string | null;
  rule_json: unknown | null;
  unitCodes: string[];
};

type LocalCourse = {
  code: string;
  title: string;
  major_code: string | null;
  min_points: number | null;
  max_points: number | null;
  time_limit_years: number | null;
  specialisations: string[];
  extracted_rules: unknown;
  units: LocalUnit[];
  groups: LocalGroup[];
};

const catalogFiles = [
  {
    code: "62510",
    pdf: "62510 Master of Information Technology.pdf",
    xlsx: "62510 Master of Information Technology.xlsx",
    major: null,
  },
  {
    code: "BP059",
    pdf: "BP059 Bachelor of Mathematics.pdf",
    xlsx: "BP059 Bachelor of Mathematics.xlsx",
    major: "MJD-EMATH",
  },
  {
    code: "41680",
    pdf: "41680 Master of Commerce.pdf",
    xlsx: "41680 Master of Commerce.xlsx",
    major: null,
  },
];

let catalogPromise: Promise<LocalCourse[]> | null = null;

function dataPath(fileName: string): string {
  return path.resolve(process.cwd(), "data", fileName);
}

function normalizeUnit(unit: ReturnType<typeof parseExcel>[number]): LocalUnit | null {
  if (!unit.code || !unit.title) {
    return null;
  }

  return {
    code: unit.code,
    title: unit.title,
    curriculum_type: unit.curriculumType,
    source_id: unit.id,
    status: unit.status,
    availabilities: unit.availabilities,
    prerequisites_raw: unit.prerequisites_raw,
    prerequisites_parsed: unit.prerequisites_parsed,
    corequisites_raw: unit.corequisites_raw,
    corequisites_parsed: unit.corequisites_parsed,
    incompatibilities_raw: unit.incompatibilities_raw,
    incompatibilities_parsed: unit.incompatibilities_parsed,
  };
}

function normalizeUnits(units: ReturnType<typeof parseExcel>, courseCode: string): LocalUnit[] {
  return units
    .map((unit) => {
      if (courseCode === "BP059" && unit.code === "MATH3031") {
        return normalizeUnit({
          ...unit,
          prerequisites_raw: "MATH1014 OR MATH1012",
          prerequisites_parsed: {
            type: "OR",
            children: [
              { type: "UNIT", code: "MATH1014" },
              { type: "UNIT", code: "MATH1012" },
            ],
          },
        });
      }

      return normalizeUnit(unit);
    })
    .filter((unit): unit is LocalUnit => unit !== null);
}

async function buildLocalCatalog(): Promise<LocalCourse[]> {
  const courses = await Promise.all(
    catalogFiles.map(async (file, index) => {
      const pdf = await parsePDF(dataPath(file.pdf));
      const units = normalizeUnits(parseExcel(dataPath(file.xlsx), file.code), file.code);

      return {
        code: file.code,
        title: pdf.title ?? file.code,
        major_code: file.major,
        min_points: pdf.points.minimum,
        max_points: pdf.points.maximum,
        time_limit_years: pdf.time_limit_years,
        specialisations: pdf.specialisations,
        extracted_rules: pdf.extracted_rules,
        units,
        groups: pdf.groups.map((group, groupIndex) => ({
          id: index * 1000 + groupIndex + 1,
          course_code: file.code,
          group_code: group.code,
          name: group.name,
          rule_text: group.rule_text,
          rule_json: group.rule_json,
          unitCodes: group.unit_codes,
        })),
      };
    })
  );

  return courses.sort((left, right) => left.code.localeCompare(right.code));
}

async function getCatalog(): Promise<LocalCourse[]> {
  catalogPromise ??= buildLocalCatalog();
  return catalogPromise;
}

export async function fetchLocalAllCourses() {
  const catalog = await getCatalog();

  return catalog.map(({ code, title, specialisations }) => ({
    code,
    title,
    specialisations,
  }));
}

export async function fetchLocalCourseByCode(code: string) {
  const catalog = await getCatalog();
  const course = catalog.find((item) => item.code === code);

  if (!course) {
    return null;
  }

  const { units: _units, groups: _groups, ...summary } = course;
  return summary;
}

export async function fetchLocalUnitsForCourse(code: string) {
  const catalog = await getCatalog();
  return catalog.find((course) => course.code === code)?.units ?? [];
}

export async function fetchLocalAllUnits() {
  const catalog = await getCatalog();
  const unitsByCode = new Map<string, LocalUnit>();

  for (const unit of catalog.flatMap((course) => course.units)) {
    unitsByCode.set(unit.code, unit);
  }

  return Array.from(unitsByCode.values()).sort((left, right) => left.code.localeCompare(right.code));
}

export async function fetchLocalUnitByCode(code: string) {
  const units = await fetchLocalAllUnits();
  return units.find((unit) => unit.code === code) ?? null;
}

export async function fetchLocalGroupsForCourse(code: string) {
  const catalog = await getCatalog();

  return (
    catalog.find((course) => course.code === code)?.groups.map(({ unitCodes: _unitCodes, ...group }) => group) ??
    []
  );
}

export async function fetchLocalUnitsForGroup(groupId: number) {
  const catalog = await getCatalog();
  const group = catalog.flatMap((course) => course.groups).find((item) => item.id === groupId);

  if (!group) {
    return [];
  }

  const unitLookup = new Map(
    catalog
      .find((course) => course.code === group.course_code)
      ?.units.map((unit) => [unit.code, unit]) ?? []
  );

  return group.unitCodes
    .map((unitCode) => unitLookup.get(unitCode))
    .filter((unit): unit is LocalUnit => unit !== undefined);
}
