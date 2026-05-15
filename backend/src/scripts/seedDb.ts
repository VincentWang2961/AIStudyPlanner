/**
 * Database Seed Script
 *
 * Imports course, unit, group, and specialisation data from data/courses.json
 * into the PostgreSQL database. This ensures the database contains accurate
 * UWA handbook data for all supported programmes.
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

  // Load courses.json
  const coursesPath = path.join(__dirname, '../../data/courses.json');
  const raw = fs.readFileSync(coursesPath, 'utf-8');
  const coursesData: CourseData[] = JSON.parse(raw);

  const programCode = '62510';
  const program = coursesData.find(c => c.courseCode === programCode);

  if (!program) {
    console.log(`[seedDb] No data found for programme ${programCode}`);
    return;
  }

  // ── Upsert Course ────────────────────────────────────────────────────
  console.log(`[seedDb] Upserting course: ${programCode}`);

  await prisma.courses.upsert({
    where: { code: programCode },
    update: {
      title: 'Master of Information Technology',
      min_points: 96,
      max_points: 96,
      time_limit_years: 4,
      specialisations: program.specialisations.map(s => ({
        code: s.code,
        name: s.name,
        description: `${s.name} specialisation for Master of Information Technology`,
      })),
    },
    create: {
      code: programCode,
      title: 'Master of Information Technology',
      min_points: 96,
      max_points: 96,
      time_limit_years: 4,
      specialisations: program.specialisations.map(s => ({
        code: s.code,
        name: s.name,
        description: `${s.name} specialisation for Master of Information Technology`,
      })),
    },
  });

  // ── Merge All Units (deduplicate) ────────────────────────────────────
  const allUnits = new Map<string, UnitData>();

  // Units from courseStructure
  for (const group of program.courseStructure) {
    for (const unit of group.units) {
      if (!allUnits.has(unit.code)) {
        allUnits.set(unit.code, unit);
      }
    }
  }

  // Units from specialisations
  for (const spec of program.specialisations) {
    for (const group of spec.groups) {
      for (const unit of group.units) {
        if (!allUnits.has(unit.code)) {
          allUnits.set(unit.code, unit);
        }
      }
    }
  }

  console.log(`[seedDb] Found ${allUnits.size} unique units for programme ${programCode}`);

  // ── Upsert Units ─────────────────────────────────────────────────────
  let unitCount = 0;
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

    // Link to course (course_units)
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

    unitCount++;
    if (unitCount % 10 === 0) {
      console.log(`[seedDb] Processed ${unitCount}/${allUnits.size} units`);
    }
  }

  // ── Create Groups ────────────────────────────────────────────────────
  console.log('[seedDb] Creating course groups...');

  // Core group (from specialisation definitions)
  const coreUnits = ['CITS4009', 'CITS4012', 'CITS4013', 'CITS5017', 'CITS5018'];
  const coreGroup = await prisma.course_groups.upsert({
    where: {
      course_code_group_code: {
        course_code: programCode,
        group_code: 'CORE',
      },
    },
    update: {
      name: 'Core Units',
      rule_text: 'All core units must be completed',
    },
    create: {
      course_code: programCode,
      group_code: 'CORE',
      name: 'Core Units',
      rule_text: 'All core units must be completed',
      rule_json: { type: 'TAKE_ALL_FROM_GROUP', group: 'CORE' },
    },
  });

  for (const code of coreUnits) {
    await prisma.group_units.upsert({
      where: {
        group_id_unit_code: {
          group_id: coreGroup.id,
          unit_code: code,
        },
      },
      update: {},
      create: {
        group_id: coreGroup.id,
        unit_code: code,
      },
    });
  }

  // Specialisation groups
  for (const spec of program.specialisations) {
    const groupCode = spec.code;
    let allSpecUnits: string[] = [];

    for (const group of spec.groups) {
      for (const unit of group.units) {
        allSpecUnits.push(unit.code);
      }
    }

    // Deduplicate
    allSpecUnits = [...new Set(allSpecUnits)];

    const specGroup = await prisma.course_groups.upsert({
      where: {
        course_code_group_code: {
          course_code: programCode,
          group_code: groupCode,
        },
      },
      update: {
        name: spec.name,
        rule_text: `Specialisation: ${spec.name}`,
      },
      create: {
        course_code: programCode,
        group_code: groupCode,
        name: spec.name,
        rule_text: `Specialisation: ${spec.name}`,
        rule_json: null,
      },
    });

    for (const code of allSpecUnits) {
      await prisma.group_units.upsert({
        where: {
          group_id_unit_code: {
            group_id: specGroup.id,
            unit_code: code,
          },
        },
        update: {},
        create: {
          group_id: specGroup.id,
          unit_code: code,
        },
      });
    }

    console.log(`[seedDb] Created group ${groupCode} with ${allSpecUnits.length} units`);
  }

  console.log('[seedDb] Database seed complete!');
}

main()
  .then(() => {
    console.log('[seedDb] Done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[seedDb] Error:', err);
    process.exit(1);
  });
