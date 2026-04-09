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

  // Row 0 => Unit list
  // Row 1 => metadata
  // Row 2 => headers
  // Row 3+ => actual rows
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
      const availabilities = cleanCell(record["Availabilities"]);

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
        prerequisites_parsed: parseRule(prereq, { courseCode }),

        corequisites_raw: coreq,
        corequisites_parsed: parseRule(coreq, { courseCode }),

        incompatibilities_raw: incompat,
        incompatibilities_parsed: parseRule(incompat),
      };
    })
    .filter((unit) => unit.code !== null);

  return units;
}