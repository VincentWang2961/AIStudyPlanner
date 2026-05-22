/**
 * UWA Handbook Unit Scraper
 *
 * Fetches and parses a unit detail page from UWA Handbook,
 * then upserts structured data into PostgreSQL via Prisma.
 *
 * Usage:
 *   npx ts-node src/scripts/scrapeUnit.ts CITS4012
 *   npx ts-node src/scripts/scrapeUnit.ts CITS1401 CITS2005 CITS5508
 */

import "dotenv/config";
import { prisma } from "../config/prisma";

const BASE_URL = "https://www.handbooks.uwa.edu.au";

interface ScrapedUnit {
  code: string;
  title: string;
  curriculum_type: string | null;
  description: string | null;
  availabilities: string | null; // comma-separated e.g. "S2"
  prerequisites_raw: string | null;
  prerequisites_parsed: { type: string; code?: string; children?: unknown[] } | null;
  corequisites_raw: string | null;
  corequisites_parsed: unknown | null;
  incompatibilities_raw: string | null;
  incompatibilities_parsed: unknown | null;
  credit_points: number;
}

// ─── HTML fetching ────────────────────────────────────────────────

async function fetchUnitPage(code: string): Promise<string> {
  const url = `${BASE_URL}/unitdetails?code=${code.toUpperCase()}`;
  console.log(`[scrape] Fetching ${url}...`);
  const resp = await fetch(url, { redirect: "follow" });
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} for ${code}`);
  }
  return resp.text();
}

// ─── Parsing helpers ──────────────────────────────────────────────

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractSection(html: string, label: string): string {
  // Match from label to next <h3> or <h4> or end of content
  const regex = new RegExp(
    `${label}\\s*(.*?)(?=<h[3-4]|<div class="[^"]*unit_|<!--END|$)`,
    "s"
  );
  const m = html.match(regex);
  if (!m) return "";
  return stripTags(m[1]).replace(new RegExp(`^${label}\\s*`), "").trim();
}

function extractTitle(html: string, code: string): string {
  // Try <h2 id="pagetitle">
  let m = html.match(/<h2[^>]*id="pagetitle"[^>]*>(.*?)<\/h2>/);
  if (m) {
    const text = stripTags(m[1]);
    // Remove the [CODE] part
    return text.replace(new RegExp(`\\[${code}\\]`, "i"), "").trim();
  }
  // Fallback to <title>
  m = html.match(/<title>(.*?)<\/title>/);
  if (m) {
    // Format: "Natural Language Processing [CITS4012] : Handbook 2026 : UWA"
    const text = stripTags(m[1]);
    const parts = text.split(":");
    return parts[0].trim();
  }
  return code;
}

function extractCreditPoints(html: string): number {
  const m = html.match(/Credit\s+(\d+)\s+points?/);
  return m ? parseInt(m[1]) : 6;
}

function extractAvailability(html: string): string {
  // The availability table has rows like:
  // <tr>...<td>Semester 2</td><td>UWA (Perth)</td><td>On-campus</td></tr>
  const rows = html.match(
    /<td>(Semester\s+\d+|S\w+\s+\d+)<\/td>\s*<td>[^<]*<\/td>\s*<td>([^<]+)<\/td>/g
  );
  if (!rows) return "";

  const semesters: string[] = [];
  for (const row of rows) {
    const m = row.match(/<td>(Semester\s+\d+|S\w+\s+\d+)<\/td>/);
    if (m) {
      // Convert "Semester 2" → "S2"
      const s = m[1].replace(/Semester\s+/, "S");
      if (!semesters.includes(s)) semesters.push(s);
    }
  }
  return semesters.join(",") || "";
}

function extractUnitRules(html: string): {
  prerequisites_raw: string | null;
  corequisites_raw: string | null;
  incompatibilities_raw: string | null;
} {
  // Find the "Unit rules" section
  const rulesBlock = html.match(
    /Unit rules(.*?)(?=<h[3-4]|<!--END unit_|$)/s
  );
  if (!rulesBlock) return { prerequisites_raw: null, corequisites_raw: null, incompatibilities_raw: null };

  const block = rulesBlock[1];

  const extractRuleText = (label: string): string | null => {
    const regex = new RegExp(
      `${label}\\s*(.*?)(?=${["Prerequisites", "Corequisites", "Incompatibilities", "Outcomes", "Assessment", "Contact", "Unit Coordinator"]
        .filter((l) => l !== label)
        .join("|")}|$)`,
      "s"
    );
    const m = block.match(regex);
    if (!m || !m[1].trim()) return null;
    return stripTags(m[1]).replace(new RegExp(`^${label}\\s*`), "").trim() || null;
  };

  return {
    prerequisites_raw: extractRuleText("Prerequisites"),
    corequisites_raw: extractRuleText("Corequisites"),
    incompatibilities_raw: extractRuleText("Incompatibilities"),
  };
}

function parsePrerequisiteCodes(
  raw: string | null
): { type: string; code?: string; children?: unknown[] } | null {
  if (!raw) return null;

  // Extract unit codes (CITSxxxx, CITXxxxx, etc.)
  const unitPattern = /[A-Z]{2,6}\d{4,5}/g;
  const codes = raw.match(unitPattern);

  if (!codes || codes.length === 0) return null;

  if (codes.length === 1) {
    return { type: "UNIT", code: codes[0] };
  }

  // Multiple codes - could be "OR" relationship
  // Simple representation: children array
  return {
    type: "OR",
    children: codes.map((code) => ({ type: "UNIT", code })),
  };
}

// ─── Main scraper ─────────────────────────────────────────────────

async function scrapeUnit(code: string): Promise<ScrapedUnit> {
  const html = await fetchUnitPage(code);

  const title = extractTitle(html, code);
  const description = extractSection(html, "Description") || null;
  const credit_points = extractCreditPoints(html);
  const availabilities = extractAvailability(html) || null;
  const rules = extractUnitRules(html);

  const prerequisites_parsed = parsePrerequisiteCodes(rules.prerequisites_raw);

  return {
    code: code.toUpperCase(),
    title,
    curriculum_type: null, // not easily extracted from HTML
    description,
    availabilities,
    prerequisites_raw: rules.prerequisites_raw,
    prerequisites_parsed,
    corequisites_raw: rules.corequisites_raw,
    corequisites_parsed: null,
    incompatibilities_raw: rules.incompatibilities_raw,
    incompatibilities_parsed: null,
    credit_points,
  };
}

// ─── Database upsert ──────────────────────────────────────────────

async function upsertUnit(unit: ScrapedUnit): Promise<void> {
  await prisma.units.upsert({
    where: { code: unit.code },
    update: {
      title: unit.title,
      description: unit.description,
      availabilities: unit.availabilities,
      prerequisites_raw: unit.prerequisites_raw,
      prerequisites_parsed: unit.prerequisites_parsed as any,
      corequisites_raw: unit.corequisites_raw,
      corequisites_parsed: unit.corequisites_parsed as any,
      incompatibilities_raw: unit.incompatibilities_raw,
      incompatibilities_parsed: unit.incompatibilities_parsed as any,
    },
    create: {
      code: unit.code,
      title: unit.title,
      curriculum_type: unit.curriculum_type,
      description: unit.description,
      availabilities: unit.availabilities,
      prerequisites_raw: unit.prerequisites_raw,
      prerequisites_parsed: unit.prerequisites_parsed as any,
      corequisites_raw: unit.corequisites_raw,
      corequisites_parsed: unit.corequisites_parsed as any,
      incompatibilities_raw: unit.incompatibilities_raw,
      incompatibilities_parsed: unit.incompatibilities_parsed as any,
    },
  });
  console.log(
    `[scrape] ✅ ${unit.code}: "${unit.title}" | ${unit.availabilities || "N/A"} | prereqs: ${unit.prerequisites_parsed ? JSON.stringify(unit.prerequisites_parsed) : "none"}`
  );
}

// ─── Bulk scraping ────────────────────────────────────────────────

async function scrapeAllUnits(unitCodes: string[]): Promise<void> {
  console.log(`[scrape] Scraping ${unitCodes.length} units from UWA Handbook...\n`);

  let success = 0;
  let failed = 0;

  // Process sequentially to be polite to UWA servers
  for (const code of unitCodes) {
    try {
      const unit = await scrapeUnit(code.toUpperCase());
      await upsertUnit(unit);
      success++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[scrape] ❌ ${code}: ${message}`);
      failed++;
    }
    // Small delay between requests
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n[scrape] Done: ${success} succeeded, ${failed} failed`);
}

// ─── CLI entry ────────────────────────────────────────────────────

async function main() {
  const codes = process.argv.slice(2);

  if (codes.length === 0) {
    console.log("Usage: npx ts-node src/scripts/scrapeUnit.ts <CODE> [CODE...]");
    console.log("Example: npx ts-node src/scripts/scrapeUnit.ts CITS4012 CITS1401");
    process.exit(1);
  }

  await scrapeAllUnits(codes);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
