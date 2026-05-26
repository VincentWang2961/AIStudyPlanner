import { prisma } from "../config/prisma"; 
import {
  fetchLocalAllCourses,
  fetchLocalAllUnits,
  fetchLocalCourseByCode,
  fetchLocalGroupsForCourse,
  fetchLocalUnitByCode,
  fetchLocalUnitsForCourse,
  fetchLocalUnitsForGroup,
} from "./localCatalogService";

function shouldUseLocalCatalog(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? error.code : undefined;

  return (
    code === "ECONNREFUSED" ||
    code === "EPERM" ||
    code === "P1000" ||
    code === "P1001" ||
    code === "P1002" ||
    code === "P2021" ||
    code === "P2022" ||
    code === "P2024"
  );
}

async function withLocalCatalogFallback<TDatabase, TLocal>(
  databaseQuery: () => Promise<TDatabase>,
  localQuery: () => Promise<TLocal>
): Promise<TDatabase | TLocal> {
  try {
    return await databaseQuery();
  } catch (error) {
    if (!shouldUseLocalCatalog(error)) {
      throw error;
    }

    console.warn("Course database unavailable; using bundled local catalogue fallback.", error);
    return localQuery();
  }
}

export async function fetchCourseByCode(code: string) {
  const result = await withLocalCatalogFallback(
    () => prisma.courses.findUnique({
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
    }),
    () => fetchLocalCourseByCode(code)
  );

  return result ?? null;
}

export async function fetchAllCourses() {
  const result = await withLocalCatalogFallback(
    () => prisma.courses.findMany({
      select: {
        code: true,
        title: true,
        specialisations: true,
      },
      orderBy: { code: "asc" },
    }),
    fetchLocalAllCourses
  );

  return result;
}

export async function fetchAllUnits() {
  const result = await withLocalCatalogFallback(
    () => prisma.units.findMany({
      orderBy: { code: "asc" },
    }),
    fetchLocalAllUnits
  );

  return result;
}

export async function fetchUnitByCode(code: string) {
  const result = await withLocalCatalogFallback(
    () => prisma.units.findUnique({
      where: { code },
    }),
    () => fetchLocalUnitByCode(code)
  );

  return result ?? null;
}

export async function fetchUnitsForCourse(code: string) {
  const result = await withLocalCatalogFallback(
    () => prisma.course_units.findMany({
      where: { course_code: code },
      include: {
        units: true, // this gives full unit object
      },
      orderBy: {
        units: { code: "asc" },
      },
    }),
    () => fetchLocalUnitsForCourse(code)
  );

  // SQL returned only u.* (flat units)
  return result.map((row) => "units" in row ? row.units : row);
}

export async function fetchGroupsForCourse(code: string) {
  const result = await withLocalCatalogFallback(
    () => prisma.course_groups.findMany({
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
    }),
    () => fetchLocalGroupsForCourse(code)
  );

  // Convert BigInt → number
  return result.map(g => ({
    ...g,
    id: Number(g.id),
  }));
}

export async function fetchUnitsForGroup(groupId: number) {
  const result = await withLocalCatalogFallback(
    () => prisma.group_units.findMany({
      where: { group_id: BigInt(groupId) },
      include: {
        units: true,
      },
      orderBy: {
        units: { code: "asc" },
      },
    }),
    () => fetchLocalUnitsForGroup(groupId)
  );

  return result.map(row => "units" in row ? row.units : row);
}
