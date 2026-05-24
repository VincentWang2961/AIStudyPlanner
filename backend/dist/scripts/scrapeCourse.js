"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * UWA Handbook Course Scraper v3
 * Extracts course structure including specialisation core/group rules.
 * Usage: npx ts-node src/scripts/scrapeCourse.ts 62510
 */
require("dotenv/config");
const prisma_1 = require("../config/prisma");
const BASE_URL = "https://www.handbooks.uwa.edu.au";
// ─── HTML helpers ──────────────────────────────────────────────────
function stripTags(html) {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function dedupe(arr) { return [...new Set(arr)]; }
/**
 * Extract ONLY unit codes from the "Unit code" column of handbook tables.
 * The handbook HTML has rows like:
 * <tr>
 *   <td>availability</td>
 *   <td><a href="...code=XXXX">XXXX</a></td>  ← we want THIS
 *   <td>name</td>
 *   <td>prerequisites (with other code links)</td>
 *   <td>contact hours</td>
 * </tr>
 */
function extractRowUnitCodes(html) {
    const codes = [];
    // Split into rows
    const rows = html.split(/<tr[^>]*>/i).slice(1); // skip before first <tr>
    for (const row of rows) {
        const rowEnd = row.indexOf("</tr>");
        if (rowEnd < 0)
            continue;
        const rowContent = row.substring(0, rowEnd);
        // Split into cells
        const cells = rowContent.split(/<t[dh][^>]*>/i).slice(1);
        if (cells.length < 2)
            continue;
        // Second cell = unit code column
        const cell2 = cells[1].split("</t")[0];
        const m = cell2.match(/unitdetails\?code=([A-Z]+\d{4})/);
        if (m)
            codes.push(m[1]);
    }
    return dedupe(codes);
}
function findSections(html) {
    const sections = [];
    // Find course core section (everything before first specialisation)
    const firstSpec = html.indexOf("Applied Computing specialisation");
    // Course core: "Take all units" before specialisations
    const courseCoreIdx = html.indexOf("Take all units");
    if (courseCoreIdx > 0) {
        // Find the table after this text
        const tableStart = html.indexOf("<table", courseCoreIdx);
        if (tableStart > 0) {
            const tableEnd = html.indexOf("</table>", tableStart) + 8;
            sections.push({
                name: "Course Core",
                start: tableStart,
                end: tableEnd,
                isSpec: false,
            });
        }
    }
    // Specialisation sections
    const specs = [
        { name: "Applied Computing", code: "SP-APCMP", keyword: "Applied Computing specialisation" },
        { name: "Artificial Intelligence", code: "SP-ARTIN", keyword: "Artificial Intelligence specialisation" },
        { name: "Software Systems", code: "SP-SOFSY", keyword: "Software Systems specialisation" },
    ];
    for (const spec of specs) {
        const kwIdx = html.indexOf(spec.keyword);
        if (kwIdx < 0)
            continue;
        // The tables for this spec come AFTER the keyword, possibly after some description text
        // Find ALL tables after this keyword, up to the next specialisation
        const nextSpecKeywords = specs
            .filter(s => s.code !== spec.code)
            .map(s => html.indexOf(s.keyword, kwIdx + spec.keyword.length))
            .filter(i => i > 0);
        const sectionEnd = nextSpecKeywords.length > 0 ? Math.min(...nextSpecKeywords) : html.length;
        // Find all Take-matching text blocks and their tables
        // First check for "Take all units" (AI + SOFSY)
        let takeIdx = html.indexOf("Take all units", kwIdx);
        if (takeIdx > 0 && takeIdx < sectionEnd) {
            const tableStart = html.indexOf("<table", takeIdx);
            if (tableStart > 0 && tableStart < sectionEnd) {
                const tableEnd = html.indexOf("</table>", tableStart) + 8;
                sections.push({
                    name: `${spec.name} Core`,
                    start: tableStart,
                    end: Math.min(tableEnd, sectionEnd),
                    isSpec: true,
                    specCode: spec.code,
                });
            }
        }
        // Then check for "Take unit(s)" (Applied Computing)
        takeIdx = html.indexOf("Take unit(s)", kwIdx);
        if (takeIdx > 0 && takeIdx < sectionEnd) {
            const tableStart = html.indexOf("<table", takeIdx);
            if (tableStart > 0 && tableStart < sectionEnd) {
                const tableEnd = html.indexOf("</table>", tableStart) + 8;
                sections.push({
                    name: `${spec.name} Core`,
                    start: tableStart,
                    end: Math.min(tableEnd, sectionEnd),
                    isSpec: true,
                    specCode: spec.code,
                });
            }
        }
        // Find Group A/B/C tables
        const groupRegex = /Group\s+([A-C])/g;
        let gm;
        while ((gm = groupRegex.exec(html)) !== null) {
            if (gm.index < kwIdx || gm.index > sectionEnd)
                continue;
            const tableStart = html.indexOf("<table", gm.index);
            if (tableStart < 0 || tableStart > sectionEnd)
                continue;
            const tableEnd = html.indexOf("</table>", tableStart) + 8;
            // Also capture the rule text before the table
            const ruleBlock = html.substring(Math.max(0, gm.index - 600), gm.index);
            const ruleMatch = stripTags(ruleBlock).match(/Take units to (?:the value of |a total of )[^.]+/i);
            sections.push({
                name: `${spec.name} Group ${gm[1]}`,
                start: tableStart,
                end: Math.min(tableEnd, sectionEnd),
                isSpec: true,
                specCode: spec.code,
            });
        }
    }
    return sections;
}
// ─── Main logic ────────────────────────────────────────────────────
async function scrapeCourse(code) {
    const url = `${BASE_URL}/coursedetails?code=${code}`;
    console.log(`[scrapeCourse] Fetching ${url}...`);
    const resp = await fetch(url, { redirect: "follow" });
    if (!resp.ok)
        throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    const title = stripTags(html.match(/<h2[^>]*id="pagetitle"[^>]*>(.*?)<\/h2>/)?.[1] ||
        html.match(/<title>(.*?)<\/title>/)?.[1]?.split(":")[0]?.trim() || "");
    const points = parseInt(html.match(/Credit points required[\s\S]*?(\d+)/)?.[1] || "96");
    const sections = findSections(html);
    console.log(`[scrapeCourse] Found ${sections.length} sections:`);
    const groups = [];
    for (const section of sections) {
        const tableHtml = html.substring(section.start, section.end);
        const codes = extractRowUnitCodes(tableHtml);
        if (codes.length === 0) {
            console.log(`  ${section.name}: SKIP (0 units)`);
            continue;
        }
        // Determine rule text
        let ruleText = "";
        let groupCode = "";
        if (!section.isSpec) {
            groupCode = "CORE";
            ruleText = `Take all units (24 points)`;
        }
        else if (section.name.includes("Group")) {
            const letter = section.name.match(/Group\s+([A-C])/)?.[1] || "?";
            groupCode = `${section.specCode}_GROUP_${letter}`;
            ruleText = `Group ${letter} elective units`;
        }
        else {
            groupCode = `${section.specCode}_CORE`;
            ruleText = `Take all units (24 points)`;
        }
        groups.push({
            group_code: groupCode,
            name: section.name,
            rule_text: ruleText,
            rule_json: { type: section.name.includes("Group") ? "GROUP" : "ALL" },
            unit_codes: codes,
        });
        console.log(`  ${groupCode}: ${codes.length}u → ${codes.join(", ")}`);
    }
    const specs = [
        { code: "SP-APCMP", name: "Applied Computing", description: "Focus on practical computing skills across software, data, and systems." },
        { code: "SP-ARTIN", name: "Artificial Intelligence", description: "Deep dive into AI, machine learning, and intelligent systems." },
        { code: "SP-SOFSY", name: "Software Systems", description: "Advanced software engineering, cloud systems, and cybersecurity." },
    ];
    return { code, title, min_points: points, max_points: points, specialisations: specs, groups };
}
// ─── DB upsert ─────────────────────────────────────────────────────
async function upsertCourse(course) {
    await prisma_1.prisma.courses.upsert({
        where: { code: course.code },
        update: {
            title: course.title, min_points: course.min_points,
            max_points: course.max_points, specialisations: course.specialisations,
        },
        create: {
            code: course.code, title: course.title, min_points: course.min_points,
            max_points: course.max_points, specialisations: course.specialisations,
        },
    });
    await prisma_1.prisma.$executeRawUnsafe(`DELETE FROM group_units WHERE group_id IN (SELECT id FROM course_groups WHERE course_code = $1)`, course.code);
    await prisma_1.prisma.$executeRawUnsafe(`DELETE FROM course_groups WHERE course_code = $1`, course.code);
    for (const group of course.groups) {
        await prisma_1.prisma.course_groups.create({
            data: {
                course_code: course.code, group_code: group.group_code,
                name: group.name, rule_text: group.rule_text,
                rule_json: group.rule_json,
            },
        });
        for (const uc of group.unit_codes) {
            try {
                await prisma_1.prisma.$executeRawUnsafe(`INSERT INTO group_units (group_id, unit_code) 
           SELECT id, $1 FROM course_groups 
           WHERE course_code = $2 AND group_code = $3 ON CONFLICT DO NOTHING`, uc, course.code, group.group_code);
            }
            catch { }
        }
    }
    console.log(`\n✅ ${course.code}: ${course.groups.length} groups saved`);
}
async function main() {
    const code = process.argv[2] || "62510";
    const course = await scrapeCourse(code);
    await upsertCourse(course);
    await prisma_1.prisma.$disconnect();
}
main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
