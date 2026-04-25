import { pool } from "../config/db";

export async function fetchCourseByCode(code: string) {
  const result = await pool.query(
    `
    SELECT code, title, major_code, min_points, max_points, time_limit_years,
      specialisations, extracted_rules
    FROM courses
    WHERE code = $1
    `,
    [code]
  );

  return result.rows[0] ?? null;
}

export async function fetchAllCourses() {
  const result = await pool.query(
    `
    SELECT code, title, specialisations
    FROM courses
    ORDER BY code
    `
  );

  return result.rows;
}

export async function fetchUnitsForCourse(code: string) {
  const result = await pool.query(
    `
    SELECT u.*
    FROM course_units cu
    JOIN units u ON u.code = cu.unit_code
    WHERE cu.course_code = $1
    ORDER BY u.code
    `,
    [code]
  );

  return result.rows;
}

export async function fetchGroupsForCourse(code: string) {
  const result = await pool.query(
    `
    SELECT id, course_code, group_code, name, rule_text, rule_json
    FROM course_groups
    WHERE course_code = $1
    ORDER BY group_code
    `,
    [code]
  );

  return result.rows;
}

export async function fetchUnitsForGroup(groupId: number) {
  const result = await pool.query(
    `
    SELECT u.*
    FROM group_units gu
    JOIN units u ON u.code = gu.unit_code
    WHERE gu.group_id = $1
    ORDER BY u.code
    `,
    [groupId]
  );

  return result.rows;
}

export async function fetchAllUnits() {
  const result = await pool.query(
    `
    SELECT *
    FROM units
    ORDER BY code
    `
  );

  return result.rows;
}

export async function fetchUnitByCode(code: string) {
  const result = await pool.query(
    `
    SELECT *
    FROM units
    WHERE code = $1
    `,
    [code]
  );

  return result.rows[0] ?? null;
}
