import * as cheerio from "cheerio";
import { Unit, PointsRequirement, UnitGroup, Specialisation, PrerequisiteRule } from "./types";
import fs from "fs";

/**
 * Parse a handbook HTML document into structured course data.
 *
 * The handbook exposes two layouts:
 * - standard course pages
 * - major pages with DSM level blocks
 */
export function parseCoursePage(html: string, courseCode: string) {
  const $ = cheerio.load(html);

  // fs.writeFileSync("course-structure.txt", $.html(), "utf-8");
  // console.log("Saved HTML to file");

  if ($("#dsmlevel1").length || $("#dsmlevel2").length) {
    return parseMajorPage($, courseCode);
  }

  const specialisations = parseSpecialisations($);
  parseSpecialisationDetails($, specialisations, courseCode);
  const courseStructure = parseCourseStructure($, courseCode);

  return { courseCode, specialisations, courseStructure };
}

/**
 * Parse a unit table into normalised unit objects.
 */
function parseUnitsTable($: cheerio.CheerioAPI, table: any, courseCode: string): Unit[] {
  const units: Unit[] = [];

  $(table).find("tr").each((_, row) => {
    const cols = $(row).find("td");
    if (cols.length < 3) return;

    const availability = $(cols[0]).text().split(",").map(a => a.trim()).filter(a => a.length > 0);
    const code = $(cols[1]).text().trim();
    const name = $(cols[2]).text().trim();

    if (!code) return;

    const requirements = cols.length >= 4
      ? parseRequirements($, $(cols[3]), courseCode)
      : {};

    units.push({ code, name, availability, ...requirements });
  });

  return units;
}

/**
 * Parse requirement cell content into recognised rule fields.
 */
function parseRequirements($: cheerio.CheerioAPI, cell: cheerio.Cheerio<any>, courseCode: string): Partial<Unit> {
  const result: Partial<Unit> = {};

  const unitCode = cell.closest("tr").find("td:nth-child(2)").text().trim();
  if (unitCode === "SVLG5001") return result;

  cell.find("dl.requirements dt").each((_, dt) => {
    const label = $(dt).text().trim().toLowerCase();
    const dd = $(dt).next("dd");

    const pointsReq = extractPointsRequirement($, dd);
    const enrolmentReq = extractEnrolmentRequirements($, dd, courseCode);

    if (label.includes("prerequisite")) {
      const unitRule = parsePrerequisiteRule($, dd);
      if (unitRule) result.prerequisites = unitRule;
      if (pointsReq) result.pointsRequirement = pointsReq;
      if (enrolmentReq.length) result.enrolmentRequirements = enrolmentReq;

    } else if (label.includes("co-requisite") || label.includes("corequisite")) {
      const unitRule = parsePrerequisiteRule($, dd);
      if (unitRule) result.corequisites = unitRule;

    } else if (label.includes("incompatib")) {
      const codes = extractLinkedUnitCodes($, dd);
      if (codes.length) result.incompatibilities = codes;
    }
  });

  return result;
}

/**
 * Build a prerequisite rule tree from mixed text and markup nodes.
 */
function parsePrerequisiteRule(
  $: cheerio.CheerioAPI,
  dd: cheerio.Cheerio<any>
): PrerequisiteRule | null {
  const orSegments: PrerequisiteRule[] = [];
  let currentAndGroup: PrerequisiteRule[] = [];

  dd.contents().each((_, node) => {
    if (node.type === "text") {
      const text = (node as any).data.trim().toLowerCase();

      if (text === "or" || text.startsWith("or ")) {
        if (currentAndGroup.length === 1) orSegments.push(currentAndGroup[0]);
        else if (currentAndGroup.length > 1) orSegments.push({ type: "and", rules: currentAndGroup });
        currentAndGroup = [];
      }

    } else {
      const el = $(node);

      // Handle <em>or</em> and <em>and</em> connectives
      if (el.is("em")) {
        const emText = el.text().trim().toLowerCase();

        if (emText === "or" || emText.startsWith("or ")) {
          if (currentAndGroup.length === 1) orSegments.push(currentAndGroup[0]);
          else if (currentAndGroup.length > 1) orSegments.push({ type: "and", rules: currentAndGroup });
          currentAndGroup = [];
        }
        // "and" / "and equivalent" etc — just continue accumulating
        return;
      }

      if (el.is("a[href*='unitdetails']")) {
        const code = el.text().trim();
        if (code) currentAndGroup.push({ type: "unit", code });
      } else if (el.is("div.implied, div.auto")) {
        const subRule = parsePrerequisiteRule($, el);
        if (subRule) currentAndGroup.push(subRule);
      }
    }
  });

  // Flush the final AND group
  if (currentAndGroup.length === 1) orSegments.push(currentAndGroup[0]);
  else if (currentAndGroup.length > 1) orSegments.push({ type: "and", rules: currentAndGroup });

  if (orSegments.length === 0) return null;
  if (orSegments.length === 1) return orSegments[0];
  return { type: "or", rules: orSegments };
}

/**
 * Extract linked unit codes from requirement markup.
 */
function extractLinkedUnitCodes($: cheerio.CheerioAPI, dd: cheerio.Cheerio<any>): string[] {
  const codes: string[] = [];

  dd.find("a[href*='unitdetails']").each((_, a) => {
    const code = $(a).text().trim();
    if (code) codes.push(code);
  });

  return codes;
}

/**
 * Extract points-based constraints, including optional course scoping.
 */
function extractPointsRequirement(
  $: cheerio.CheerioAPI,
  dd: cheerio.Cheerio<any>
): PointsRequirement | null {
  const text = dd.text().trim();

  const numericMatch = text.match(/(\d+)\s*points/i);
  const wordMatch = text.match(/any\s+(one|two|three|four|five|six|seven|eight|nine|ten)\s+units?/i);

  const wordToNum: Record<string, number> = {
    one: 6, two: 12, three: 18, four: 24,
    five: 30, six: 36, seven: 42, eight: 48,
    nine: 54, ten: 60
  };

  let points: number | null = null;

  if (numericMatch) {
    points = parseInt(numericMatch[1]);
  } else if (wordMatch) {
    points = wordToNum[wordMatch[1].toLowerCase()] ?? null;
  }

  if (!points) return null;

  const courseLinks: string[] = [];
  dd.find("a[href*='coursedetails']").each((_, a) => {
    const href = $(a).attr("href") ?? "";
    const match = href.match(/code=([A-Z0-9]+)/i);
    if (match) courseLinks.push(match[1]);
  });

  return {
    minimumPoints: points,
    ...(courseLinks.length && { inCourses: courseLinks }),
  };
}

/**
 * Extract enrolment constraints and remove the currently parsed course code.
 */
function extractEnrolmentRequirements(
  $: cheerio.CheerioAPI,
  dd: cheerio.Cheerio<any>,
  courseCode: string
): string[] {
  const text = dd.text().trim().toLowerCase();
  if (!text.includes("enrolment") && !text.includes("enrolled")) return [];

  const codes: string[] = [];
  dd.find("a[href*='coursedetails']").each((_, a) => {
    const href = $(a).attr("href") ?? "";
    const match = href.match(/code=([A-Z0-9]+)/i);
    if (match) codes.push(match[1]);
  });

  // Filter out the current course — the student is already enrolled in it
  return codes.filter(code => code !== courseCode);
}

/**
 * Parse top-level course structure groups.
 */
function parseCourseStructure($: cheerio.CheerioAPI, courseCode: string): UnitGroup[] {
  const groups: UnitGroup[] = [];

  const h3CourseStructure = $("h3").filter((_, el) => {
    return $(el).text().trim().toLowerCase() === "course structure";
  }).first();

  if (!h3CourseStructure.length) return groups;

  const sequencer = h3CourseStructure.nextAll("div.sequencer").first();
  const searchRoot = sequencer.length ? sequencer : h3CourseStructure.parent();

  let ungroupedUnits: Unit[] = [];

  searchRoot.children().each((_, el) => {
    const current = $(el);
    const text = current.text().trim();

    if (current.is("p") && current.hasClass("group")) {
      const tableDiv = current.nextAll("div.table-scroll").first();
      if (tableDiv.length) {
        const table = tableDiv.find("table").first();
        const units = parseUnitsTable($, table, courseCode);
        if (units.length) groups.push({ name: text, units });
      }
    } else if (current.is("div.table-scroll")) {
      const prev = current.prev();
      if (!(prev.is("p") && prev.hasClass("group"))) {
        const table = current.find("table").first();
        const units = parseUnitsTable($, table, courseCode);
        if (units.length) ungroupedUnits.push(...units);
      }
    }
  });

  if (ungroupedUnits.length) {
    groups.unshift({ name: "Ungrouped", units: ungroupedUnits });
  }

  return groups;
}

/**
 * Parse specialisations from the handbook Specialisations block.
 */
function parseSpecialisations($: cheerio.CheerioAPI): Specialisation[] {
  const specs: Specialisation[] = [];

  // Find the h3 that contains "Specialisations"
  const h3 = $("h3").filter((_, el) => {
    return $(el).text().trim() === "Specialisations";
  }).first();

  if (!h3.length) return specs;

  // The <p> right after contains the list
  const p = h3.next("p");
  if (!p.length) return specs;

  // Split by <br>
  const lines = p.html()?.split("<br>") || [];
  lines.forEach(line => {
    const text = line.trim();
    if (!text) return;

    // Split code and name
    const match = text.match(/^(\S+)\s+(.+)$/);
    if (match) {
      const [_, code, name] = match;
      specs.push({ code, name, groups: [] });
    }
  });

  return specs;
}

/**
 * Populate each specialisation with grouped unit tables.
 */
function parseSpecialisationDetails(
  $: cheerio.CheerioAPI,
  specs: Specialisation[],
  courseCode: string
) {
  specs.forEach(spec => {
    const h4 = $("h4")
      .filter((_, el) => $(el).text().toLowerCase().includes(spec.name.toLowerCase()))
      .first();

    if (!h4.length) return;

    let current = h4.next();
    const groups: UnitGroup[] = [];
    let ungroupedUnits: Unit[] = [];
    let currentGroup: UnitGroup | null = null;

    while (current.length) {
      if (current.is("h4")) break;

      const text = current.text().trim();

      if ((current.is("p") && /^Group \d+/.test(text)) ||
          (current.is("h5") && /^Group [A-Z]/.test(text))) {

        currentGroup = { name: text, units: [] };
        groups.push(currentGroup);

        const table = current.next("div").find("table").first();
        if (table.length) {
          currentGroup.units.push(...parseUnitsTable($, table, courseCode));
        }
      } else if (current.is("div") && current.find("table").length) {
        const table = current.find("table").first();
        const units = parseUnitsTable($, table, courseCode);

        if (units.length) {
          if (currentGroup) currentGroup.units.push(...units);
          else ungroupedUnits.push(...units);
        }
      }

      current = current.next();
    }

    if (ungroupedUnits.length) {
      groups.unshift({ name: "Ungrouped", units: ungroupedUnits });
    }

    spec.groups = groups;
  });
}

/**
 * Parse major-page DSM level blocks into a levelled structure.
 */
function parseMajorPage($: cheerio.CheerioAPI, courseCode: string) {
  const levels: any[] = [];

  const levelIds = ["dsmlevel1", "dsmlevel2", "dsmlevel3"];

  levelIds.forEach((levelId, index) => {
    const section = $(`#${levelId}`);

    if (!section.length) return;

    const sections: any[] = [];

    section.find("h3").each((_, el) => {

      const title = $(el).text().trim();

      // Capture instruction text between h3 and table
      let instructions = "";
      let next = $(el).next();

      while (next.length && next[0].tagName !== "table") {
        instructions += next.text().trim() + " ";
        next = next.next();
      }

      const table = next;

      if (!table.length) return;

      const units = parseUnitsTable($, table, courseCode);

      sections.push({
        title,
        instructions: instructions.trim(),
        units
      });
    });

    levels.push({
      level: index + 1,
      sections
    });
  });

  return {
    courseCode,
    type: "major",
    levels
  };
}
