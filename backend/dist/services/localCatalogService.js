"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchLocalAllCourses = fetchLocalAllCourses;
exports.fetchLocalCourseByCode = fetchLocalCourseByCode;
exports.fetchLocalUnitsForCourse = fetchLocalUnitsForCourse;
exports.fetchLocalGroupsForCourse = fetchLocalGroupsForCourse;
exports.fetchLocalUnitsForGroup = fetchLocalUnitsForGroup;
const path_1 = __importDefault(require("path"));
const excelParser_1 = require("./parser/excelParser");
const pdfParser_1 = require("./parser/pdfParser");
const catalogFiles = [
    {
        code: "62510",
        pdf: "62510 Master of Information Technology.pdf",
        xlsx: "62510 Master of Information Technology.xlsx",
        major: null,
    },
    {
        code: "BP059",
        pdf: "BP059 Bachelor of Mathematics.pdf",
        xlsx: "BP059 Bachelor of Mathematics.xlsx",
        major: "MJD-EMATH",
    },
    {
        code: "41680",
        pdf: "41680 Master of Commerce.pdf",
        xlsx: "41680 Master of Commerce.xlsx",
        major: null,
    },
];
let catalogPromise = null;
function dataPath(fileName) {
    return path_1.default.resolve(process.cwd(), "data", fileName);
}
function normalizeUnit(unit) {
    if (!unit.code || !unit.title) {
        return null;
    }
    return {
        code: unit.code,
        title: unit.title,
        curriculum_type: unit.curriculumType,
        source_id: unit.id,
        status: unit.status,
        availabilities: unit.availabilities,
        prerequisites_raw: unit.prerequisites_raw,
        prerequisites_parsed: unit.prerequisites_parsed,
        corequisites_raw: unit.corequisites_raw,
        corequisites_parsed: unit.corequisites_parsed,
        incompatibilities_raw: unit.incompatibilities_raw,
        incompatibilities_parsed: unit.incompatibilities_parsed,
    };
}
function normalizeUnits(units, courseCode) {
    return units
        .map((unit) => {
        if (courseCode === "BP059" && unit.code === "MATH3031") {
            return normalizeUnit({
                ...unit,
                prerequisites_raw: "MATH1014 OR MATH1012",
                prerequisites_parsed: {
                    type: "OR",
                    children: [
                        { type: "UNIT", code: "MATH1014" },
                        { type: "UNIT", code: "MATH1012" },
                    ],
                },
            });
        }
        return normalizeUnit(unit);
    })
        .filter((unit) => unit !== null);
}
async function buildLocalCatalog() {
    const courses = await Promise.all(catalogFiles.map(async (file, index) => {
        const pdf = await (0, pdfParser_1.parsePDF)(dataPath(file.pdf));
        const units = normalizeUnits((0, excelParser_1.parseExcel)(dataPath(file.xlsx), file.code), file.code);
        return {
            code: file.code,
            title: pdf.title ?? file.code,
            major_code: file.major,
            min_points: pdf.points.minimum,
            max_points: pdf.points.maximum,
            time_limit_years: pdf.time_limit_years,
            specialisations: pdf.specialisations,
            extracted_rules: pdf.extracted_rules,
            units,
            groups: pdf.groups.map((group, groupIndex) => ({
                id: index * 1000 + groupIndex + 1,
                course_code: file.code,
                group_code: group.code,
                name: group.name,
                rule_text: group.rule_text,
                rule_json: group.rule_json,
                unitCodes: group.unit_codes,
            })),
        };
    }));
    return courses.sort((left, right) => left.code.localeCompare(right.code));
}
async function getCatalog() {
    catalogPromise ?? (catalogPromise = buildLocalCatalog());
    return catalogPromise;
}
async function fetchLocalAllCourses() {
    const catalog = await getCatalog();
    return catalog.map(({ code, title, specialisations }) => ({
        code,
        title,
        specialisations,
    }));
}
async function fetchLocalCourseByCode(code) {
    const catalog = await getCatalog();
    const course = catalog.find((item) => item.code === code);
    if (!course) {
        return null;
    }
    const { units: _units, groups: _groups, ...summary } = course;
    return summary;
}
async function fetchLocalUnitsForCourse(code) {
    const catalog = await getCatalog();
    return catalog.find((course) => course.code === code)?.units ?? [];
}
async function fetchLocalGroupsForCourse(code) {
    const catalog = await getCatalog();
    return (catalog.find((course) => course.code === code)?.groups.map(({ unitCodes: _unitCodes, ...group }) => group) ??
        []);
}
async function fetchLocalUnitsForGroup(groupId) {
    const catalog = await getCatalog();
    const group = catalog.flatMap((course) => course.groups).find((item) => item.id === groupId);
    if (!group) {
        return [];
    }
    const unitLookup = new Map(catalog
        .find((course) => course.code === group.course_code)
        ?.units.map((unit) => [unit.code, unit]) ?? []);
    return group.unitCodes
        .map((unitCode) => unitLookup.get(unitCode))
        .filter((unit) => unit !== undefined);
}
