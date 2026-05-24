"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchCourseByCode = fetchCourseByCode;
exports.fetchAllCourses = fetchAllCourses;
exports.fetchAllUnits = fetchAllUnits;
exports.fetchUnitByCode = fetchUnitByCode;
exports.fetchUnitsForCourse = fetchUnitsForCourse;
exports.fetchGroupsForCourse = fetchGroupsForCourse;
exports.fetchUnitsForGroup = fetchUnitsForGroup;
const prisma_1 = require("../config/prisma");
const localCatalogService_1 = require("./localCatalogService");
function shouldUseLocalCatalog(error) {
    if (!error || typeof error !== "object") {
        return false;
    }
    const code = "code" in error ? error.code : undefined;
    return (code === "ECONNREFUSED" ||
        code === "EPERM" ||
        code === "P1000" ||
        code === "P1001" ||
        code === "P1002" ||
        code === "P2021" ||
        code === "P2022" ||
        code === "P2024");
}
async function withLocalCatalogFallback(databaseQuery, localQuery) {
    try {
        return await databaseQuery();
    }
    catch (error) {
        if (!shouldUseLocalCatalog(error)) {
            throw error;
        }
        console.warn("Course database unavailable; using bundled local catalogue fallback.");
        return localQuery();
    }
}
async function fetchCourseByCode(code) {
    const result = await withLocalCatalogFallback(() => prisma_1.prisma.courses.findUnique({
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
    }), () => (0, localCatalogService_1.fetchLocalCourseByCode)(code));
    return result ?? null;
}
async function fetchAllCourses() {
    const result = await withLocalCatalogFallback(() => prisma_1.prisma.courses.findMany({
        select: {
            code: true,
            title: true,
            specialisations: true,
        },
        orderBy: { code: "asc" },
    }), localCatalogService_1.fetchLocalAllCourses);
    return result;
}
async function fetchAllUnits() {
    const result = await withLocalCatalogFallback(() => prisma_1.prisma.units.findMany({
        orderBy: { code: "asc" },
    }), localCatalogService_1.fetchLocalAllUnits);
    return result;
}
async function fetchUnitByCode(code) {
    const result = await withLocalCatalogFallback(() => prisma_1.prisma.units.findUnique({
        where: { code },
    }), () => (0, localCatalogService_1.fetchLocalUnitByCode)(code));
    return result ?? null;
}
async function fetchUnitsForCourse(code) {
    const result = await withLocalCatalogFallback(() => prisma_1.prisma.course_units.findMany({
        where: { course_code: code },
        include: {
            units: true, // this gives full unit object
        },
        orderBy: {
            units: { code: "asc" },
        },
    }), () => (0, localCatalogService_1.fetchLocalUnitsForCourse)(code));
    // SQL returned only u.* (flat units)
    return result.map((row) => "units" in row ? row.units : row);
}
async function fetchGroupsForCourse(code) {
    const result = await withLocalCatalogFallback(() => prisma_1.prisma.course_groups.findMany({
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
    }), () => (0, localCatalogService_1.fetchLocalGroupsForCourse)(code));
    // Convert BigInt → number
    return result.map(g => ({
        ...g,
        id: Number(g.id),
    }));
}
async function fetchUnitsForGroup(groupId) {
    const result = await withLocalCatalogFallback(() => prisma_1.prisma.group_units.findMany({
        where: { group_id: BigInt(groupId) },
        include: {
            units: true,
        },
        orderBy: {
            units: { code: "asc" },
        },
    }), () => (0, localCatalogService_1.fetchLocalUnitsForGroup)(groupId));
    return result.map(row => "units" in row ? row.units : row);
}
