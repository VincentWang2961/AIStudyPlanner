import { prisma } from "../config/prisma"; 

export async function fetchCourseByCode(code: string) {
  const result = await prisma.courses.findUnique({
    where: { code },
    select: {
      code: true,
      title: true,
      major_code: true,
      min_points: true,
      max_points: true,
      time_limit_years: true,
      specialisations: true,
      extracted_rules: true,
    },
  });

  return result ?? null;
}

export async function fetchAllCourses() {
  const result = await prisma.courses.findMany({
    select: {
      code: true,
      title: true,
      specialisations: true,
    },
    orderBy: { code: "asc" },
  });

  return result;
}

export async function fetchUnitsForCourse(code: string) {
  const result = await prisma.course_units.findMany({
    where: { course_code: code },
    include: {
      units: true, // this gives full unit object
    },
    orderBy: {
      units: { code: "asc" },
    },
  });

  // SQL returned only u.* (flat units)
  return result.map((row) => row.units);
}

export async function fetchGroupsForCourse(code: string) {
  const result = await prisma.course_groups.findMany({
    where: { course_code: code },
    select: {
      id: true,
      course_code: true,
      group_code: true,
      name: true,
      rule_text: true,
      rule_json: true,
    },
    orderBy: { group_code: "asc" },
  });

  // Convert BigInt → number
  return result.map(g => ({
    ...g,
    id: Number(g.id),
  }));
}

export async function fetchUnitsForGroup(groupId: number) {
  const result = await prisma.group_units.findMany({
    where: { group_id: BigInt(groupId) },
    include: {
      units: true,
    },
    orderBy: {
      units: { code: "asc" },
    },
  });

  return result.map(row => row.units);
}
