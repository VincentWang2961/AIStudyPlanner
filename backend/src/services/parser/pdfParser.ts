import * as fs from "fs";
import { parseGroupRule, GroupRuleNode } from "./groupRuleParser";

export type CourseGroup = {
  code: string;
  name: string;
  rule_text: string;
  rule_json: GroupRuleNode | null;
  unit_codes: string[];
};

export type ParsedPdfCourse = {
  raw_text: string;
  course_code: string | null;
  title: string | null;
  points: {
    minimum: number | null;
    maximum: number | null;
  };
  time_limit_years: number | null;
  specialisations: string[];
  groups: CourseGroup[];
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

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function extractUnitCodes(text: string): string[] {
  return uniqueStrings(text.match(/[A-Z]{4}\d{4}/g) ?? []);
}

function extractSection(text: string, startMarker: string, endMarkers: string[]): string {
  const startIndex = text.indexOf(startMarker);
  if (startIndex === -1) return "";

  let endIndex = text.length;

  for (const marker of endMarkers) {
    const idx = text.indexOf(marker, startIndex + startMarker.length);
    if (idx !== -1 && idx < endIndex) {
      endIndex = idx;
    }
  }

  return text.slice(startIndex, endIndex).trim();
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

function extract62510Groups(text: string): CourseGroup[] {
  const groups: CourseGroup[] = [];

  const conversionSection = extractSection(
    text,
    "Students who have completed degree studies in a non-cognate area",
    ["Take all units (24 points):"]
  );

  if (conversionSection) {
    groups.push({
      code: "CONVERSION",
      name: "Conversion units",
      rule_text:
        "Students who have completed degree studies in a non-cognate area must complete relevant conversion units up to the value of 24 points as determined by the School. Students choose either CITS2002 or CITS2005.",
      rule_json: null,
      unit_codes: extractUnitCodes(conversionSection),
    });
  }

  const coreSection = extractSection(
    text,
    "Take all units (24 points):",
    ["Group A:"]
  );

  if (coreSection) {
    groups.push({
      code: "CORE",
      name: "Core",
      rule_text: "Take all units (24 points).",
      rule_json: null,
      unit_codes: extractUnitCodes(coreSection),
    });
  }

  const groupASection = extractSection(
    text,
    "Group A:",
    ["Group B:"]
  );

  if (groupASection) {
    groups.push({
      code: "GROUP_A",
      name: "Group A",
      rule_text: "Take unit(s) to the value of at least 6 points from group A. Take units to a total of 24 points from groups A, B and C. Students in the Software Systems specialisation do not require units from group A.",
      rule_json: null,
      unit_codes: extractUnitCodes(groupASection),
    });
  }

  const groupBSection = extractSection(
    text,
    "Group B:",
    ["Group C:"]
  );

  if (groupBSection) {
    groups.push({
      code: "GROUP_B",
      name: "Group B",
      rule_text: "Take unit(s) to the value of at least 6 points from group B including at least 6 points of level 5 units. Take units to a total of 24 points from groups A, B and C.",
      rule_json: null,
      unit_codes: extractUnitCodes(groupBSection),
    });
  }

  const groupCSection = extractSection(
    text,
    "Group C:",
    ["Applied Computing Specialisation:"]
  );

  if (groupCSection) {
    groups.push({
      code: "GROUP_C",
      name: "Group C",
      rule_text: "Take units to the value of at most 12 points from group C. Take units to a total of 24 points from groups A, B and C.",
      rule_json: null,
      unit_codes: extractUnitCodes(groupCSection),
    });
  }

  const appliedSection = extractSection(
    text,
    "Applied Computing Specialisation:",
    ["Artificial Intelligence specialisation"]
  );

  if (appliedSection) {
    groups.push({
      code: "SP_APCMP",
      name: "Applied Computing specialisation",
      rule_text: "Take unit(s) to the value of 24 points from this group including at least 12 points of level 5 units.",
      rule_json: null,
      unit_codes: extractUnitCodes(appliedSection),
    });
  }

  const aiSection = extractSection(
    text,
    "Artificial Intelligence specialisation",
    ["Software Systems specialisation"]
  );

  if (aiSection) {
    groups.push({
      code: "SP_ARTIN",
      name: "Artificial Intelligence specialisation",
      rule_text: "Take all units (24 points).",
      rule_json: null,
      unit_codes: extractUnitCodes(aiSection),
    });
  }

  const softSection = extractSection(
    text,
    "Software Systems specialisation",
    ["marks a capstone"]
  );

  if (softSection) {
    groups.push({
      code: "SP_SOFSY",
      name: "Software Systems specialisation",
      rule_text: "Take all units (24 points).",
      rule_json: null,
      unit_codes: extractUnitCodes(softSection),
    });
  }

  return groups;
}

function extract41680Groups(text: string): CourseGroup[] {
  const groups: CourseGroup[] = [];

  const coreSection = extractSection(text, "Take all units (12 points):", ["Group 1:"]);
  if (coreSection) {
    groups.push({
      code: "CORE",
      name: "Core",
      rule_text:
        "Students who have not completed the Bachelor of Commerce, or equivalent as recognised by the Faculty, may be required to complete relevant conversion units up to the value of 24 points, as advised by the Faculty. Take all units (12 points).",
      rule_json: null,
      unit_codes: extractUnitCodes(coreSection),
    });
  }

  const group1Section = extractSection(text, "Group 1:", ["Group 2:"]);
  if (group1Section) {
    groups.push({
      code: "GROUP_1",
      name: "Group 1",
      rule_text:
        "Take units up to the value of 12 points from group 1 or 2 or options up to the value of 12 points chosen from groups A, B, C, D, E, F, G, H and I.",
      rule_json: null,
      unit_codes: extractUnitCodes(group1Section),
    });
  }

  const group2Section = extractSection(text, "Group 2:", ["Group 3:"]);
  if (group2Section) {
    groups.push({
      code: "GROUP_2",
      name: "Group 2",
      rule_text: "Take unit(s) to the value of 6 points.",
      rule_json: null,
      unit_codes: extractUnitCodes(group2Section),
    });
  }

  const group3Section = extractSection(text, "Group 3:", ["Accounting specialisation"]);
  if (group3Section) {
    groups.push({
      code: "GROUP_3",
      name: "Group 3",
      rule_text:
        "Take units to the value of 0-6 points, as advised by the Faculty. This unit is only available to students enrolled in double degree programs.",
      rule_json: null,
      unit_codes: extractUnitCodes(group3Section),
    });
  }

  const acctSection = extractSection(
    text,
    "Accounting specialisation",
    ["Business Information and Logistics Management specialisation"]
  );
  if (acctSection) {
    groups.push({
      code: "GROUP_A",
      name: "Group A - Accounting specialisation",
      rule_text:
        "Take units to the value of 24 points from Group A and units to the value of 24 points chosen from either group B, C, D, E, F, G, H, I OR take units to the value of at least 24 points and units chosen from groups B, C, D, E, F, G, H and I sufficient to bring the total to 48 points.",
      rule_json: null,
      unit_codes: extractUnitCodes(acctSection),
    });
  }

  const bsimgSection = extractSection(
    text,
    "Business Information and Logistics Management specialisation",
    ["Economics specialisation", "Group G:"]
  );
  if (bsimgSection) {
    groups.push({
      code: "GROUP_B",
      name: "Group B - Business Information and Logistics Management specialisation",
      rule_text:
        "Take units to the value of 24 points from Group B and units to the value of 24 points chosen from either group A, C, D, E, F, G, H or I OR take units to the value of at least 24 points and units chosen from groups A, C, D, E, F, G, H and I sufficient to bring the total to 48 points.",
      rule_json: null,
      unit_codes: extractUnitCodes(bsimgSection),
    });
  }

  const econSection = extractSection(text, "Group G:", ["Employment Relations specialisation"]);
  if (econSection) {
    groups.push({
      code: "GROUP_G",
      name: "Group G - Economics specialisation",
      rule_text:
        "Take units to the value of 24 points from Group G and units to the value of 24 points chosen from either group A, B, C, D, E, F, H or I OR take units to the value of at least 24 points and units chosen from groups A, B, C, D, E, F, H or I sufficient to bring the total to 48 points.",
      rule_json: null,
      unit_codes: extractUnitCodes(econSection).filter((code) => code !== "ECON5541"),
    });
  }

  const emplSection = extractSection(
    text,
    "Employment Relations specialisation",
    ["Finance specialisation"]
  );
  if (emplSection) {
    groups.push({
      code: "GROUP_C",
      name: "Group C - Employment Relations specialisation",
      rule_text:
        "Take units to the value of 24 points from Group C and units to the value of 24 points chosen from either group A, B, D, E, F, G, H or I OR take units to the value of at least 24 points and units chosen from groups A, B, D, E, F, G, H or I sufficient to bring the total to 48 points.",
      rule_json: null,
      unit_codes: extractUnitCodes(emplSection),
    });
  }

  const financeCoreSection = extractSection(text, "Finance specialisation", ["Group D:"]);
  if (financeCoreSection) {
    groups.push({
      code: "SP_FINCE_CORE",
      name: "Finance specialisation core",
      rule_text: "Take all units (12 points).",
      rule_json: null,
      unit_codes: extractUnitCodes(financeCoreSection),
    });
  }

  const financeDSection = extractSection(
    text,
    "Group D:",
    ["Human Resource Management specialisation", "Group E:"]
  );
  if (financeDSection) {
    groups.push({
      code: "GROUP_D",
      name: "Group D - Finance specialisation",
      rule_text:
        "Take units to the value of 12 points from Group D and units to the value of 24 points chosen from either group A, B, C, E, F, G, H or I OR take units to the value of at least 12 points and units chosen from groups A, B, C, E, F, G, H or I sufficient to bring the total to 36 points.",
      rule_json: null,
      unit_codes: extractUnitCodes(financeDSection),
    });
  }

  const hrSection = extractSection(
    text,
    "Group E:",
    ["International Business (Not Available for 2021) specialisation", "Management specialisation"]
  );
  if (hrSection) {
    groups.push({
      code: "GROUP_E",
      name: "Group E - Human Resource Management specialisation",
      rule_text:
        "Take units to the value of 24 points from Group E and units to the value of 24 points chosen from either group A, B, C, D, F, G, H or I OR take units to the value of at least 24 points and units chosen from groups A, B, C, D, F, G, H or I sufficient to bring the total to 48 points.",
      rule_json: null,
      unit_codes: extractUnitCodes(hrSection),
    });
  }

  const mgmntCoreSection = extractSection(text, "Management specialisation", ["Group H:"]);
  if (mgmntCoreSection) {
    groups.push({
      code: "SP_MGMNT_CORE",
      name: "Management specialisation core",
      rule_text: "Take all units (12 points).",
      rule_json: null,
      unit_codes: extractUnitCodes(mgmntCoreSection).filter(
        (code) => code === "MGMT5503" || code === "MGMT5508"
      ),
    });
  }

  const mgmntHSection = extractSection(text, "Group H:", ["Marketing specialisation", "Group F:"]);
  if (mgmntHSection) {
    groups.push({
      code: "GROUP_H",
      name: "Group H - Management specialisation",
      rule_text:
        "Take units to the value of 12 points from Group H and units to the value of 24 points chosen from either group A, B, C, D, E, F, G or I OR take units to the value of at least 12 points and units chosen from groups A, B, C, D, E, F, G or I sufficient to bring the total to 36 points.",
      rule_json: null,
      unit_codes: extractUnitCodes(mgmntHSection),
    });
  }

  const mktgSection = extractSection(text, "Group F:", ["marks a capstone"]);
  if (mktgSection) {
    groups.push({
      code: "GROUP_F",
      name: "Group F - Marketing specialisation",
      rule_text:
        "Take units to the value of 24 points from Group F and units to the value of 24 points chosen from either group A, B, C, D, E, G, H or I OR take units to the value of at least 24 points and units chosen from groups A, B, C, D, E, G, H or I sufficient to bring the total to 48 points.",
      rule_json: null,
      unit_codes: extractUnitCodes(mktgSection),
    });
  }

  return groups;
}

function extractGroups(text: string, courseCode: string | null): CourseGroup[] {
  if (courseCode === "62510") return extract62510Groups(text);
  if (courseCode === "41680") return extract41680Groups(text);
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

  const timeLimitYears = extractFirstNumber(
    text,
    /Time limit\s+(\d+)\s+years?/i
  );

  const specialisations = extractSpecialisations(text, courseCode);
  const rawGroups = extractGroups(text, courseCode);

  const groups = rawGroups.map((group) => ({
    ...group,
    rule_json: parseGroupRule(courseCode, group.code, group.rule_text),
  }));

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
    time_limit_years: timeLimitYears,
    specialisations,
    groups,
    extracted_rules,
  };
}