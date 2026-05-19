"use strict";
/**
 * Database Seed Script
 *
 * Imports course data from data/courses.json into PostgreSQL.
 * Uses upsert operations — safe to run multiple times.
 *
 * Usage: npx ts-node src/scripts/seedDb.ts
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const prisma_1 = require("../config/prisma");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
async function main() {
    console.log('[seedDb] Starting database seed...');
    const coursesPath = path_1.default.join(__dirname, '../../data/courses.json');
    const raw = fs_1.default.readFileSync(coursesPath, 'utf-8');
    const coursesData = JSON.parse(raw);
    for (const program of coursesData) {
        const code = program.courseCode;
        console.log(`[seedDb] Seeding: ${code} — ${program.title}`);
        // Clear existing
        await prisma_1.prisma.$executeRawUnsafe(`DELETE FROM group_units WHERE group_id IN (SELECT id FROM course_groups WHERE course_code = $1)`, code);
        await prisma_1.prisma.$executeRawUnsafe(`DELETE FROM course_groups WHERE course_code = $1`, code);
        await prisma_1.prisma.$executeRawUnsafe(`DELETE FROM course_units WHERE course_code = $1`, code);
        // Upsert course
        await prisma_1.prisma.courses.upsert({
            where: { code },
            update: {
                title: program.title,
                min_points: program.creditPoints,
                max_points: program.creditPoints,
                time_limit_years: program.timeLimitYears,
                specialisations: program.specialisations.map(s => ({
                    code: s.code, name: s.name, description: s.description,
                })),
            },
            create: {
                code,
                title: program.title,
                min_points: program.creditPoints,
                max_points: program.creditPoints,
                time_limit_years: program.timeLimitYears,
                specialisations: program.specialisations.map(s => ({
                    code: s.code, name: s.name, description: s.description,
                })),
            },
        });
        // Insert all units
        console.log(`[seedDb] ${program.units.length} units`);
        const validCodes = new Set();
        for (const unit of program.units) {
            validCodes.add(unit.code);
            await prisma_1.prisma.units.upsert({
                where: { code: unit.code },
                update: {
                    title: unit.title,
                    availabilities: unit.availability.join(', '),
                    prerequisites_raw: unit.prerequisites.length > 0 ? JSON.stringify(unit.prerequisites) : null,
                    prerequisites_parsed: unit.prerequisites.length > 0 ? { type: 'AND', children: unit.prerequisites.map(p => ({ type: 'UNIT', code: p })) } : null,
                    incompatibilities_raw: unit.incompatibilities.length > 0 ? JSON.stringify(unit.incompatibilities) : null,
                    curriculum_type: unit.level >= 5 ? 'core' : 'elective',
                },
                create: {
                    code: unit.code,
                    title: unit.title,
                    availabilities: unit.availability.join(', '),
                    prerequisites_raw: unit.prerequisites.length > 0 ? JSON.stringify(unit.prerequisites) : null,
                    prerequisites_parsed: unit.prerequisites.length > 0 ? { type: 'AND', children: unit.prerequisites.map(p => ({ type: 'UNIT', code: p })) } : null,
                    incompatibilities_raw: unit.incompatibilities.length > 0 ? JSON.stringify(unit.incompatibilities) : null,
                    status: 'active',
                    curriculum_type: unit.level >= 5 ? 'core' : 'elective',
                },
            });
            await prisma_1.prisma.course_units.upsert({
                where: { course_code_unit_code: { course_code: code, unit_code: unit.code } },
                update: {},
                create: { course_code: code, unit_code: unit.code },
            });
        }
        // Create course structure groups
        const allGroups = [];
        // Core group
        allGroups.push({
            code: 'CORE',
            name: 'Core Units',
            ruleText: 'All core units must be completed (24 points)',
            units: program.coreUnits.map(u => u.code).filter(c => validCodes.has(c)),
        });
        // Conversion group
        allGroups.push({
            code: 'CONVERSION',
            name: 'Conversion Units',
            ruleText: 'Up to 24 points for non-cognate students',
            units: program.conversionUnits.map(u => u.code).filter(c => validCodes.has(c)),
        });
        // A/B/C groups
        for (const g of program.groups) {
            const units = g.units.map(u => u.code).filter(c => validCodes.has(c));
            if (units.length > 0) {
                allGroups.push({
                    code: g.code,
                    name: g.name,
                    ruleText: g.note,
                    units,
                });
            }
        }
        // Specialisation groups
        for (const spec of program.specialisations) {
            allGroups.push({
                code: spec.code,
                name: spec.name,
                ruleText: `${spec.name} specialisation`,
                units: [], // filled per-specialisation below
            });
        }
        // Insert groups
        for (const g of allGroups) {
            const grp = await prisma_1.prisma.course_groups.upsert({
                where: { course_code_group_code: { course_code: code, group_code: g.code } },
                update: { name: g.name, rule_text: g.ruleText },
                create: {
                    course_code: code,
                    group_code: g.code,
                    name: g.name,
                    rule_text: g.ruleText,
                    rule_json: null,
                },
            });
            for (const unitCode of g.units) {
                await prisma_1.prisma.group_units.upsert({
                    where: { group_id_unit_code: { group_id: grp.id, unit_code: unitCode } },
                    update: {},
                    create: { group_id: grp.id, unit_code: unitCode },
                });
            }
            console.log(`[seedDb]   Group ${g.code}: ${g.units.length} units`);
        }
        console.log(`[seedDb] ${code} seeded successfully.`);
    }
}
main()
    .then(() => { console.log('[seedDb] Done.'); process.exit(0); })
    .catch(err => { console.error('[seedDb] Error:', err); process.exit(1); });
