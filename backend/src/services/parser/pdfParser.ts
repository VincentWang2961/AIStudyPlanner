import * as fs from "fs";

export type ParsedPdfCourse = {
  raw_text: string;
  course_code: string | null;
  title: string | null;
  points: {
    minimum: number | null;
    maximum: number | null;
  };
  specialisations: string[];
  extracted_rules: string[];
};

function extractFirstNumber(text: string, regex: RegExp): number | null {
  const match = text.match(regex);
  if (!match) return null;
  const num = Number(match[1]);
  return Number.isNaN(num) ? null : num;
}

function collectLinesContaining(text: string, patterns: RegExp[]): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => patterns.some((pattern) => pattern.test(line)));
}

function extractSpecialisations(text: string, courseCode: string | null): string[] {
  if (courseCode === "62510") {
    const result: string[] = [];

    if (/Applied Computing/i.test(text)) result.push("Applied Computing");
    if (/Artificial Intelligence/i.test(text)) result.push("Artificial Intelligence");
    if (/Software Systems/i.test(text)) result.push("Software Systems");

    return result;
  }

  if (courseCode === "41680") {
    const known = [
      "Accounting",
      "Business Information and Logistics Management",
      "Economics",
      "Employment Relations",
      "Finance",
      "Human Resource Management",
      "International Business",
      "Management",
      "Marketing",
    ];

    return known.filter((name) => new RegExp(name, "i").test(text));
  }

  return [];
}

export async function parsePDF(filePath: string): Promise<ParsedPdfCourse> {
  const { CanvasFactory } = require("pdf-parse/worker");
  const { PDFParse } = require("pdf-parse");

  const buffer = fs.readFileSync(filePath);

  const parser = new PDFParse({
    data: buffer,
    CanvasFactory,
  });

  const textResult = await parser.getText();
  const text =
    typeof textResult === "string" ? textResult : textResult?.text ?? "";

  const courseCodeMatch = text.match(/Course code\s+([A-Z0-9]+)/i);
  const titleMatch = text.match(/Title\s+([^\n]+)/i);

  const courseCode = courseCodeMatch?.[1] ?? null;

  const minPoints = extractFirstNumber(
    text,
    /Minimum volume of\s+learning\s+(\d+)\s*points/i
  );

  const maxPoints = extractFirstNumber(
    text,
    /Maximum volume of\s+learning\s+(\d+)\s*points/i
  );

  const specialisations = extractSpecialisations(text, courseCode);

  const extracted_rules = collectLinesContaining(text, [
    /Take all units/i,
    /Take unit\(s\) to the value/i,
    /Take units to the value/i,
    /Students must complete/i,
    /Students may complete/i,
    /choose either/i,
    /at least \d+ points/i,
    /at most \d+ points/i,
    /successful completion of/i,
    /must complete/i,
  ]);

  return {
    raw_text: text,
    course_code: courseCode,
    title: titleMatch?.[1]?.trim() ?? null,
    points: {
      minimum: minPoints,
      maximum: maxPoints,
    },
    specialisations,
    extracted_rules,
  };
}