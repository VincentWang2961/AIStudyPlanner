"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProgrammeCatalogueFromDb = getProgrammeCatalogueFromDb;
const courseService_1 = require("../courseService");
function parseAvailability(value) {
    if (!value || value === 'N/A') {
        return ['N/A'];
    }
    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}
function collectUnitCodesFromRule(rule) {
    if (!rule || typeof rule !== 'object') {
        return [];
    }
    const data = rule;
    const type = typeof data.type === 'string' ? data.type.toUpperCase() : '';
    const code = typeof data.code === 'string' ? data.code : null;
    const children = Array.isArray(data.children) ? data.children : [];
    const rules = Array.isArray(data.rules) ? data.rules : [];
    const nestedCodes = [...children, ...rules].flatMap(collectUnitCodesFromRule);
    if ((type === 'UNIT' || type === 'UNIT_CODE') && code) {
        return Array.from(new Set([code, ...nestedCodes]));
    }
    return Array.from(new Set(nestedCodes));
}
function inferUnitType(unitCode, coreUnitCodes) {
    return coreUnitCodes.has(unitCode) ? 'core' : 'elective';
}
function buildConstraints(course, groups) {
    const constraints = [
        {
            code: 'STRICT_PREREQUISITES',
            description: 'All prerequisite chains must be satisfied before dependent units are scheduled.',
            priority: 'mandatory',
        },
    ];
    if (course.max_points || course.min_points) {
        constraints.push({
            code: 'CREDIT_POINTS',
            description: `The programme requires ${course.min_points ?? course.max_points} to ${course.max_points ?? course.min_points} credit points.`,
            priority: 'informational',
        });
    }
    if (course.time_limit_years) {
        constraints.push({
            code: 'TIME_LIMIT',
            description: `The programme must be completed within ${course.time_limit_years} years.`,
            priority: 'informational',
        });
    }
    for (const group of groups) {
        if (!group.rule_text)
            continue;
        constraints.push({
            code: `GROUP_${group.group_code}`,
            description: `${group.name}: ${group.rule_text}`,
            priority: 'preferred',
        });
    }
    // Capstone constraint for MIT (62510)
    if (course.code === '62510') {
        constraints.push({
            code: 'CAPSTONE_LAST_SEMESTER',
            description: 'CITS5206 (IT Capstone Project) is MANDATORY and MUST be placed in the final semester. The final semester should still contain a normal full load of 4 units — CITS5206 takes only ONE slot.',
            priority: 'mandatory',
        });
        constraints.push({
            code: 'PREFER_CITS_UNITS',
            description: 'PREFER CITS-prefixed units (CITSxxxx) for elective slots. Non-CITS units (INMT, MGMT, PHIL, SVLG, AUTO, ENVT) are interdisciplinary electives and should only be used if no suitable CITS alternative exists.',
            priority: 'preferred',
        });
        constraints.push({
            code: 'RESEARCH_PROJECT_PAIR',
            description: 'CITS5014 and CITS5015 are a two-part research project. If selected, BOTH must be taken with CITS5014 before CITS5015. CITS5014 requires at least 2 semesters of prior study (earliest start: semester 3).',
            priority: 'mandatory',
        });
        constraints.push({
            code: 'CONVERSION_MUTUALLY_EXCLUSIVE',
            description: 'CITS2002 (Systems Programming) and CITS2005 (Object Oriented Programming) are conversion units. You ONLY need ONE of them, NOT BOTH. Including both wastes a slot. Choose the one that best fits the plan.',
            priority: 'mandatory',
        });
    }
    return constraints;
}
async function getCoreUnitCodes(groups) {
    const coreCodes = new Set();
    for (const group of groups) {
        // Only the course-level CORE group (not spec-specific groups like SP-ARTIN_CORE)
        if (group.group_code !== 'CORE') {
            continue;
        }
        const groupUnits = await (0, courseService_1.fetchUnitsForGroup)(Number(group.id));
        for (const unit of groupUnits) {
            coreCodes.add(unit.code);
        }
    }
    return coreCodes;
}
function toPlannerUnit(unit, coreUnitCodes) {
    const prerequisites = collectUnitCodesFromRule(unit.prerequisites_parsed)
        // Filter out self-references (e.g. CITS5206 requiring itself)
        .filter((code) => code !== unit.code);
    return {
        code: unit.code,
        title: unit.title,
        creditPoints: 6,
        type: inferUnitType(unit.code, coreUnitCodes),
        availability: parseAvailability(unit.availabilities),
        prerequisites,
        incompatibilities: [],
        corequisites: [],
        description: unit.description?.trim() || `Programme unit. ${unit.prerequisites_raw ? `Prerequisites: ${unit.prerequisites_raw}` : ''}`.trim(),
    };
}
async function getProgrammeCatalogueFromDb(programCode) {
    const course = await (0, courseService_1.fetchCourseByCode)(programCode);
    if (!course) {
        return null;
    }
    const groups = await (0, courseService_1.fetchGroupsForCourse)(programCode);
    const units = await (0, courseService_1.fetchUnitsForCourse)(programCode);
    if (units.length === 0) {
        return null;
    }
    const coreUnitCodes = await getCoreUnitCodes(groups);
    // Filter out excluded units for this course
    const excludedUnits = course.code === '62510' ? ['CITS4009'] : [];
    const filteredUnits = units.filter((unit) => !excludedUnits.includes(unit.code));
    // Build specialisation info from DB groups
    const courseSpecialisations = [];
    const specCoreUnits = new Map(); // spec_code → unit codes
    const specElectives = new Map();
    for (const group of groups) {
        // Match spec core groups like SP-ARTIN_CORE
        const coreMatch = group.group_code.match(/^(SP-\w+)_CORE$/);
        if (coreMatch) {
            const specCode = coreMatch[1];
            const groupUnits = await (0, courseService_1.fetchUnitsForGroup)(Number(group.id));
            const codes = groupUnits.map(u => u.code);
            specCoreUnits.set(specCode, codes);
        }
        // Match spec group rules like SP-APCMP_GROUP_A
        const groupMatch = group.group_code.match(/^(SP-\w+)_GROUP_/);
        if (groupMatch) {
            const specCode = groupMatch[1];
            const groupUnits = await (0, courseService_1.fetchUnitsForGroup)(Number(group.id));
            const codes = groupUnits.map(u => u.code);
            const existing = specElectives.get(specCode) || [];
            specElectives.set(specCode, [...new Set([...existing, ...codes])]);
        }
    }
    // Try reading specialisations from course metadata
    if (typeof course.specialisations !== 'undefined') {
        try {
            const specs = JSON.parse(JSON.stringify(course.specialisations));
            for (const spec of specs) {
                if (spec && spec.name) {
                    const specCode = spec.code || spec.name;
                    courseSpecialisations.push({
                        code: specCode,
                        name: spec.name,
                        coreUnits: specCoreUnits.get(specCode) || [],
                        electiveOptions: specElectives.get(specCode) || [],
                        description: spec.description || `${spec.name} specialisation`,
                    });
                }
            }
        }
        catch {
            // ignore parse errors
        }
    }
    return {
        programCode: course.code,
        programName: course.title,
        totalCreditPoints: course.max_points ?? course.min_points ?? units.length * 6,
        defaultUnitsPerSemester: 4,
        constraints: buildConstraints(course, groups),
        units: filteredUnits.map((unit) => toPlannerUnit(unit, coreUnitCodes)),
        specialisations: courseSpecialisations,
        sequenceData: [],
        prerequisiteChains: [],
    };
}
