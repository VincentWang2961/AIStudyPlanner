import * as XLSX from "xlsx";
import { parseRule } from "./ruleParser";

export type ParsedUnit = {
  curriculumType: string | null;
  id: string | null;
  code: string | null;
  title: string | null;
  status: string | null;
  availabilities: string | null;

  prerequisites_raw: string | null;
  prerequisites_parsed: any | null;

  corequisites_raw: string | null;
  corequisites_parsed: any | null;

  incompatibilities_raw: string | null;
  incompatibilities_parsed: any | null;
};

function cleanCell(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.toLowerCase() === "nil" || text.toLowerCase() === "nil.") return null;
  return text;
}

function parseDate(value: string): Date | null {
  const match = value.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function daysInclusive(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
}

function classifyDateRangeAsSemester(start: Date, end: Date): string[] {
  if (end < start) return [];

  const year = end.getFullYear();

  const s1Start = new Date(year, 0, 1);
  const s1End = new Date(year, 5, 30);
  const s2Start = new Date(year, 6, 1);
  const s2End = new Date(year, 11, 31);

  const overlapDays = (rangeStart: Date, rangeEnd: Date): number => {
    const overlapStart = new Date(Math.max(start.getTime(), rangeStart.getTime()));
    const overlapEnd = new Date(Math.min(end.getTime(), rangeEnd.getTime()));

    if (overlapEnd < overlapStart) return 0;

    return daysInclusive(overlapStart, overlapEnd);
  };

  const s1Days = overlapDays(s1Start, s1End);
  const s2Days = overlapDays(s2Start, s2End);

  if (s1Days > s2Days) return ["S1"];
  if (s2Days > s1Days) return ["S2"];
  if (s1Days > 0 && s2Days > 0 && s1Days === s2Days) return ["S1", "S2"];

  return [];
}

function extractNonStandardSemesters(value: string): string[] {
  const result = new Set<string>();

  const matches = value.matchAll(
    /Attendance start:\s*(\d{2}-\d{2}-\d{4})\]\s*\[Attendance end:\s*(\d{2}-\d{2}-\d{4})/gi
  );

  for (const match of matches) {
    const start = parseDate(match[1]);
    const end = parseDate(match[2]);

    if (!start || !end) continue;

    for (const semester of classifyDateRangeAsSemester(start, end)) {
      result.add(semester);
    }
  }

  return Array.from(result);
}

function normalizeAvailability(value: string | null): string {
  if (!value) return "N/A";

  const text = value.toLowerCase();

  if (text.includes("not available")) {
    return "N/A";
  }

  const result = new Set<string>();

  if (/semester\s*1/i.test(value)) {
    result.add("S1");
  }

  if (/semester\s*2/i.test(value)) {
    result.add("S2");
  }

  if (/non-standard/i.test(value)) {
    for (const semester of extractNonStandardSemesters(value)) {
      result.add(semester);
    }
  }

  const ordered = ["S1", "S2"].filter((semester) => result.has(semester));

  return ordered.length > 0 ? ordered.join(",") : "N/A";
}

function shouldIgnoreQualifiedRule(text: string | null, courseCode?: string): boolean {
  if (!text) return false;

  const clean = text.trim();

  if (
    /master of applied finance students\s*:/i.test(clean) &&
    courseCode !== "41690"
  ) {
    return true;
  }

  if (
    /for Juris Doctor students\s*:/i.test(clean) &&
    courseCode !== "20820"
  ) {
    return true;
  }

  return false;
}

function shouldIgnorePrerequisite(text: string | null, courseCode?: string): boolean {
  if (!text) return false;

  const clean = text.trim();

  if (
    courseCode === "BP059" &&
    /MATH1722 Mathematics Foundations:\s*Specialist/i.test(clean)
  ) {
    return true;
  }

  if (
    courseCode === "41680" &&
    /Enrolment in\s+41680 Master of Commerce/i.test(clean) &&
    !/\band\s+Successful completion/i.test(clean)
  ) {
    return true;
  }

  return false;
}

function shouldSkipUnitForCourse(unitCode: string | null, courseCode?: string): boolean {
  if (!unitCode) return false;

  if (courseCode === "62510") {
    return ["CITS4419", "CITS4402"].includes(unitCode);
  }

  return false;
}

export function parseExcel(filePath: string, courseCode?: string): ParsedUnit[] {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, {
    header: 1,
    defval: null,
  });

  if (rawRows.length < 4) {
    throw new Error(`Unexpected spreadsheet structure in ${filePath}`);
  }

  const headers = rawRows[2].map((h: unknown) => String(h ?? "").trim());
  const dataRows = rawRows.slice(3);

  const units: ParsedUnit[] = dataRows
    .map((row) => {
      const record: Record<string, any> = {};

      headers.forEach((header: string, index: number) => {
        record[header] = row[index];
      });

      const curriculumType = cleanCell(record["CurriculumType"]);
      const id = cleanCell(record["ID"]);
      const code = cleanCell(record["Code"]);
      const title = cleanCell(record["Title"]);
      const status = cleanCell(record["Status"]);
      const availabilities = normalizeAvailability(cleanCell(record["Availabilities"]));

      const prereq = cleanCell(record["Prerequisites"]);
      const coreq = cleanCell(record["Corequisites"]);
      const incompat = cleanCell(record["Incompatibilities"]);

      return {
        curriculumType,
        id,
        code,
        title,
        status,
        availabilities,

        prerequisites_raw: prereq,
        prerequisites_parsed: shouldIgnorePrerequisite(prereq, courseCode)
          ? null
          : parseRule(prereq, { courseCode }),

        corequisites_raw: coreq,
        corequisites_parsed: shouldIgnoreQualifiedRule(coreq, courseCode)
          ? null
          : parseRule(coreq, { courseCode }),

        incompatibilities_raw: incompat,
        incompatibilities_parsed: shouldIgnoreQualifiedRule(incompat, courseCode)
          ? null
          : parseRule(incompat, { courseCode }),
      };
    })
    .filter((unit) => unit.code !== null)
    .filter((unit) => !shouldSkipUnitForCourse(unit.code, courseCode));

  return units;
}