"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertCatalog = upsertCatalog;
async function upsertCatalog(client, catalog) {
    for (const course of catalog.courses) {
        await client.query(`
      INSERT INTO courses (
        code, title, major_code, min_points, max_points, time_limit_years, specialisations, extracted_rules
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
      ON CONFLICT (code) DO UPDATE SET
        title = EXCLUDED.title,
        major_code = EXCLUDED.major_code,
        min_points = EXCLUDED.min_points,
        max_points = EXCLUDED.max_points,
        time_limit_years = EXCLUDED.time_limit_years,
        specialisations = EXCLUDED.specialisations,
        extracted_rules = EXCLUDED.extracted_rules
      `, [
            course.code,
            course.title ?? course.code,
            course.major ?? null,
            course.pdf_rules.points.minimum,
            course.pdf_rules.points.maximum,
            course.pdf_rules.time_limit_years,
            JSON.stringify(course.pdf_rules.specialisations ?? []),
            JSON.stringify(course.pdf_rules.extracted_rules ?? []),
        ]);
        for (const unit of course.units) {
            if (!unit.code || !unit.title)
                continue;
            await client.query(`
        INSERT INTO units (
          code, title, curriculum_type, source_id, status, availabilities,
          prerequisites_raw, prerequisites_parsed,
          corequisites_raw, corequisites_parsed,
          incompatibilities_raw, incompatibilities_parsed
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8::jsonb,
          $9, $10::jsonb,
          $11, $12::jsonb
        )
        ON CONFLICT (code) DO UPDATE SET
          title = EXCLUDED.title,
          curriculum_type = EXCLUDED.curriculum_type,
          source_id = EXCLUDED.source_id,
          status = EXCLUDED.status,
          availabilities = EXCLUDED.availabilities,
          prerequisites_raw = EXCLUDED.prerequisites_raw,
          prerequisites_parsed = EXCLUDED.prerequisites_parsed,
          corequisites_raw = EXCLUDED.corequisites_raw,
          corequisites_parsed = EXCLUDED.corequisites_parsed,
          incompatibilities_raw = EXCLUDED.incompatibilities_raw,
          incompatibilities_parsed = EXCLUDED.incompatibilities_parsed
        `, [
                unit.code,
                unit.title,
                unit.curriculumType,
                unit.id,
                unit.status,
                unit.availabilities,
                unit.prerequisites_raw,
                JSON.stringify(unit.prerequisites_parsed),
                unit.corequisites_raw,
                JSON.stringify(unit.corequisites_parsed),
                unit.incompatibilities_raw,
                JSON.stringify(unit.incompatibilities_parsed),
            ]);
            await client.query(`
        INSERT INTO course_units (course_code, unit_code)
        VALUES ($1, $2)
        ON CONFLICT (course_code, unit_code) DO NOTHING
        `, [course.code, unit.code]);
        }
        // Clear and rebuild groups for this course to keep it simple and consistent
        await client.query(`
      DELETE FROM group_units
      WHERE group_id IN (
        SELECT id FROM course_groups WHERE course_code = $1
      )
      `, [course.code]);
        await client.query(`DELETE FROM course_groups WHERE course_code = $1`, [course.code]);
        for (const group of course.pdf_rules.groups ?? []) {
            const insertGroupResult = await client.query(`
        INSERT INTO course_groups (course_code, group_code, name, rule_text, rule_json)
        VALUES ($1, $2, $3, $4, $5::jsonb)
        RETURNING id
        `, [
                course.code,
                group.code,
                group.name,
                group.rule_text,
                JSON.stringify(group.rule_json),
            ]);
            const groupId = insertGroupResult.rows[0].id;
            for (const unitCode of group.unit_codes ?? []) {
                await client.query(`
          INSERT INTO group_units (group_id, unit_code)
          VALUES ($1, $2)
          ON CONFLICT (group_id, unit_code) DO NOTHING
          `, [groupId, unitCode]);
            }
        }
    }
}
