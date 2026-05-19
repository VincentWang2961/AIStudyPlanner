"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateStudyPlanShape = validateStudyPlanShape;
function isString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}
function isNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
function isUnitType(value) {
    return value === 'core' || value === 'elective' || value === 'option';
}
function validateStudyPlanShape(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const data = value;
    if (data.version !== '1.0' || data.language !== 'en-GB') {
        return false;
    }
    if (!isString(data.generatedAt) || Number.isNaN(Date.parse(data.generatedAt))) {
        return false;
    }
    if (!data.plan || typeof data.plan !== 'object') {
        return false;
    }
    if (!isString(data.plan.programCode) || !isString(data.plan.programName) || !isString(data.plan.focusArea)) {
        return false;
    }
    if (!Array.isArray(data.plan.semesters) || data.plan.semesters.length === 0) {
        return false;
    }
    for (const semester of data.plan.semesters) {
        if (!semester || typeof semester !== 'object') {
            return false;
        }
        if (!isNumber(semester.sequence) || !isString(semester.label) || !Array.isArray(semester.units)) {
            return false;
        }
        for (const unit of semester.units) {
            if (!unit || typeof unit !== 'object') {
                return false;
            }
            if (!isString(unit.code) || !isString(unit.title) || !isNumber(unit.creditPoints) || !isUnitType(unit.type)) {
                return false;
            }
            if (unit.rationale !== undefined && typeof unit.rationale !== 'string') {
                return false;
            }
        }
    }
    if (!data.plan.summary || typeof data.plan.summary !== 'object') {
        return false;
    }
    if (!isNumber(data.plan.summary.totalCreditPoints) ||
        !isNumber(data.plan.summary.totalUnits) ||
        typeof data.plan.summary.prerequisitesAssumedStrict !== 'boolean') {
        return false;
    }
    if (!data.explanation || typeof data.explanation !== 'object') {
        return false;
    }
    if (!isString(data.explanation.overview) || !Array.isArray(data.explanation.electiveRationales)) {
        return false;
    }
    if (!data.explanation.electiveRationales.every((item) => typeof item === 'string')) {
        return false;
    }
    if (!Array.isArray(data.constraintsAcknowledged) || !data.constraintsAcknowledged.every((item) => typeof item === 'string')) {
        return false;
    }
    if (!Array.isArray(data.warnings) || !data.warnings.every((item) => typeof item === 'string')) {
        return false;
    }
    // reasoning is optional — if present, validate its structure
    if (data.reasoning !== undefined) {
        if (typeof data.reasoning !== 'object' || data.reasoning === null) {
            return false;
        }
        const reasoning = data.reasoning;
        if (reasoning.prerequisiteAnalysis !== undefined && !Array.isArray(reasoning.prerequisiteAnalysis))
            return false;
        if (reasoning.specialisationFulfillment !== undefined && !Array.isArray(reasoning.specialisationFulfillment))
            return false;
        if (reasoning.workloadConsiderations !== undefined && !Array.isArray(reasoning.workloadConsiderations))
            return false;
    }
    return true;
}
