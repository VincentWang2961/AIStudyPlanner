"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseExcel = parseExcel;
const XLSX = __importStar(require("xlsx"));
const ruleParser_1 = require("./ruleParser");
function cleanCell(value) {
    if (value === null || value === undefined)
        return null;
    const text = String(value).trim();
    if (!text)
        return null;
    if (text.toLowerCase() === "nil" || text.toLowerCase() === "nil.")
        return null;
    return text;
}
function parseDate(value) {
    const match = value.match(/(\d{2})-(\d{2})-(\d{4})/);
    if (!match)
        return null;
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day) {
        return null;
    }
    return date;
}
function daysInclusive(start, end) {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
}
function classifyDateRangeAsSemester(start, end) {
    if (end < start)
        return [];
    const year = end.getFullYear();
    const s1Start = new Date(year, 0, 1);
    const s1End = new Date(year, 5, 30);
    const s2Start = new Date(year, 6, 1);
    const s2End = new Date(year, 11, 31);
    const overlapDays = (rangeStart, rangeEnd) => {
        const overlapStart = new Date(Math.max(start.getTime(), rangeStart.getTime()));
        const overlapEnd = new Date(Math.min(end.getTime(), rangeEnd.getTime()));
        if (overlapEnd < overlapStart)
            return 0;
        return daysInclusive(overlapStart, overlapEnd);
    };
    const s1Days = overlapDays(s1Start, s1End);
    const s2Days = overlapDays(s2Start, s2End);
    if (s1Days > s2Days)
        return ["S1"];
    if (s2Days > s1Days)
        return ["S2"];
    if (s1Days > 0 && s2Days > 0 && s1Days === s2Days)
        return ["S1", "S2"];
    return [];
}
function extractNonStandardSemesters(value) {
    const result = new Set();
    const matches = value.matchAll(/Attendance start:\s*(\d{2}-\d{2}-\d{4})\]\s*\[Attendance end:\s*(\d{2}-\d{2}-\d{4})/gi);
    for (const match of matches) {
        const start = parseDate(match[1]);
        const end = parseDate(match[2]);
        if (!start || !end)
            continue;
        for (const semester of classifyDateRangeAsSemester(start, end)) {
            result.add(semester);
        }
    }
    return Array.from(result);
}
function normalizeAvailability(value) {
    if (!value)
        return "N/A";
    const text = value.toLowerCase();
    if (text.includes("not available")) {
        return "N/A";
    }
    const result = new Set();
    if (/semester\s*1/i.test(value)) {
        result.add("S1");
    }
    if (/semester\s*2/i.test(value)) {
        result.add("S2");
    }
    if (/non-standard/i.test(value)) {
        for (const semester of extractNonStandardSemesters(value)) {
            result.add(semester);
        }
    }
    const ordered = ["S1", "S2"].filter((semester) => result.has(semester));
    return ordered.length > 0 ? ordered.join(",") : "N/A";
}
function shouldIgnoreQualifiedRule(text, courseCode) {
    if (!text)
        return false;
    const clean = text.trim();
    if (/master of applied finance students\s*:/i.test(clean) &&
        courseCode !== "41690") {
        return true;
    }
    return false;
}
function shouldIgnorePrerequisite(text, courseCode) {
    if (!text)
        return false;
    const clean = text.trim();
    if (courseCode === "BP059" &&
        /MATH1722 Mathematics Foundations:\s*Specialist/i.test(clean)) {
        return true;
    }
    return false;
}
function parseExcel(filePath, courseCode) {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: null,
    });
    if (rawRows.length < 4) {
        throw new Error(`Unexpected spreadsheet structure in ${filePath}`);
    }
    const headers = rawRows[2].map((h) => String(h ?? "").trim());
    const dataRows = rawRows.slice(3);
    const units = dataRows
        .map((row) => {
        const record = {};
        headers.forEach((header, index) => {
            record[header] = row[index];
        });
        const curriculumType = cleanCell(record["CurriculumType"]);
        const id = cleanCell(record["ID"]);
        const code = cleanCell(record["Code"]);
        const title = cleanCell(record["Title"]);
        const status = cleanCell(record["Status"]);
        const availabilities = normalizeAvailability(cleanCell(record["Availabilities"]));
        const prereq = cleanCell(record["Prerequisites"]);
        const coreq = cleanCell(record["Corequisites"]);
        const incompat = cleanCell(record["Incompatibilities"]);
        return {
            curriculumType,
            id,
            code,
            title,
            status,
            availabilities,
            prerequisites_raw: prereq,
            prerequisites_parsed: shouldIgnorePrerequisite(prereq, courseCode)
                ? null
                : (0, ruleParser_1.parseRule)(prereq, { courseCode }),
            corequisites_raw: coreq,
            corequisites_parsed: shouldIgnoreQualifiedRule(coreq, courseCode)
                ? null
                : (0, ruleParser_1.parseRule)(coreq, { courseCode }),
            incompatibilities_raw: incompat,
            incompatibilities_parsed: (0, ruleParser_1.parseRule)(incompat),
        };
    })
        .filter((unit) => unit.code !== null);
    return units;
}
