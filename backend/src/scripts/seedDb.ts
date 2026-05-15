/**
 * Database Seed Script
 *
 * Imports course, unit, group, and specialisation data from data/courses.json
 * into the PostgreSQL database. Uses upsert operations so it is safe to run
 * multiple times.
 *
 * Usage: npx ts-node src/scripts/seedDb.ts
 */

import 'dotenv/config';
import { prisma } from '../config/prisma';
import path from 'path';
import fs from 'fs';

interface CourseData {
  courseCode: string;
  specialisations: SpecialisationData[];
  courseStructure: CourseGroupData[];
}

interface SpecialisationData {
  code: string;
  name: string;
  groups: CourseGroupData[];
}

interface CourseGroupData {
  name: string;
  units: UnitData[];
}

interface UnitData {
  code: string;
  name: string;
  availability: string[];
  prerequisites?: any;
  corequisites?: any;
  incompatibilities?: string[];
  enrolmentRequirements?: string[];
  pointsRequirement?: {
    minimumPoints: number;
    inCourses: string[];
  };
}

async function main() {
  console.log('[seedDb] Starting database seed...');

  const coursesPath = path.join(__dirname, '../../data/courses.json');
  const raw = fs.readFileSync(coursesPath, 'utf-8');
  const coursesData: CourseData[] = JSON.parse(raw);

  for (const program of coursesData) {
    const programCode = program.courseCode;
    console.log(`[seedDb] Seeding programme: ${programCode}`);

    // ── Clear existing data for this programme ───────────────────────
    await prisma.$executeRawUnsafe(
      `DELETE FROM group_units WHERE group_id IN (SELECT id FROM course_groups WHERE course_code = $1)`,
      programCode,
    );
    await prisma.$executeRawUnsafe(
      `DELETE FROM course_groups WHERE course_code = $1`,
      programCode,
    );
    await prisma.$executeRawUnsafe(
      `DELETE FROM course_units WHERE course_code = $1`,
      programCode,
    );

    // ── Upsert programme ─────────────────────────────────────────────
    await prisma.courses.upsert({
      where: { code: programCode },
      update: {
        title: programCode === '62510' ? 'Master of Information Technology' : 'Programme',
        min_points: 96,
        max_points: 96,
        time_limit_years: 4,
        specialisations: program.specialisations.map(s => ({
          code: s.code,
          name: s.name,
          description: `${s.name} specialisation`,
        })),
      },
      create: {
        code: programCode,
        title: programCode === '62510' ? 'Master of Information Technology' : 'Programme',
        min_points: 96,
        max_points: 96,
        time_limit_years: 4,
        specialisations: program.specialisations.map(s => ({
          code: s.code,
          name: s.name,
          description: `${s.name} specialisation`,
        })),
      },
    });

    // ── Collect all unique units ─────────────────────────────────────
    const allUnits = new Map<string, UnitData>();

    for (const group of program.courseStructure) {
      for (const unit of group.units) {
        if (!allUnits.has(unit.code)) {
          allUnits.set(unit.code, unit);
        }
      }
    }

    for (const spec of program.specialisations) {
      for (const group of spec.groups) {
        for (const unit of group.units) {
          if (!allUnits.has(unit.code)) {
            allUnits.set(unit.code, unit);
          }
        }
      }
    }

    console.log(`[seedDb] ${allUnits.size} unique units`);

    // ── Upsert all units first ───────────────────────────────────────
    for (const [code, unit] of allUnits) {
      const prereqJson = unit.prerequisites ? JSON.stringify(unit.prerequisites) : null;
      const incompatJson = unit.incompatibilities?.length
        ? JSON.stringify(unit.incompatibilities)
        : null;

      await prisma.units.upsert({
        where: { code },
        update: {
          title: unit.name,
          availabilities: unit.availability.join(', '),
          prerequisites_raw: prereqJson,
          prerequisites_parsed: unit.prerequisites || null,
          incompatibilities_raw: incompatJson,
        },
        create: {
          code,
          title: unit.name,
          availabilities: unit.availability.join(', '),
          prerequisites_raw: prereqJson,
          prerequisites_parsed: unit.prerequisites || null,
          incompatibilities_raw: incompatJson,
          status: 'active',
        },
      });

      // Link unit to course
      await prisma.course_units.upsert({
        where: {
          course_code_unit_code: {
            course_code: programCode,
            unit_code: code,
          },
        },
        update: {},
        create: {
          course_code: programCode,
          unit_code: code,
        },
      });
    }

    console.log(`[seedDb] Created ${allUnits.size} units`);

    // ── Build set of valid unit codes ────────────────────────────────
    const validCodes = new Set(allUnits.keys());

    // ── Create core group (hardcoded core units) ─────────────────────
    const coreUnitList = ['CITS4009', 'CITS4012', 'CITS4013', 'CITS5017', 'CITS5018']
      .filter(code => validCodes.has(code));

    if (coreUnitList.length > 0) {
      const coreGroup = await prisma.course_groups.upsert({
        where: { course_code_group_code: { course_code: programCode, group_code: 'CORE' } },
        update: { name: 'Core Units', rule_text: 'All core units must be completed' },
        create: {
          course_code: programCode,
          group_code: 'CORE',
          name: 'Core Units',
          rule_text: 'All core units must be completed',
          rule_json: { type: 'TAKE_ALL_FROM_GROUP', group: 'CORE' },
        },
      });

      for (const code of coreUnitList) {
        await prisma.group_units.upsert({
          where: { group_id_unit_code: { group_id: coreGroup.id, unit_code: code } },
          update: {},
          create: { group_id: coreGroup.id, unit_code: code },
        });
      }

      console.log(`[seedDb] Core group: ${coreUnitList.length} units`);
    }

    // ── Create specialisation groups ─────────────────────────────────
    for (const spec of program.specialisations) {
      let allSpecUnits: string[] = [];
      for (const group of spec.groups) {
        for (const unit of group.units) {
          allSpecUnits.push(unit.code);
        }
      }
      allSpecUnits = [...new Set(allSpecUnits)].filter(code => validCodes.has(code));

      if (allSpecUnits.length === 0) {
        console.log(`[seedDb] Skipping ${spec.code} — no valid units`);
        continue;
      }

      const specGroup = await prisma.course_groups.upsert({
        where: { course_code_group_code: { course_code: programCode, group_code: spec.code } },
        update: { name: spec.name, rule_text: `Specialisation: ${spec.name}` },
        create: {
          course_code: programCode,
          group_code: spec.code,
          name: spec.name,
          rule_text: `Specialisation: ${spec.name}`,
          rule_json: null,
        },
      });

      for (const code of allSpecUnits) {
        await prisma.group_units.upsert({
          where: { group_id_unit_code: { group_id: specGroup.id, unit_code: code } },
          update: {},
          create: { group_id: specGroup.id, unit_code: code },
        });
      }

      console.log(`[seedDb] Group ${spec.code}: ${allSpecUnits.length} units`);
    }

    console.log(`[seedDb] Programme ${programCode} seeded successfully.`);
  }
}

main()
  .then(() => {
    console.log('[seedDb] All done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[seedDb] Fatal error:', err);
    process.exit(1);
  });
