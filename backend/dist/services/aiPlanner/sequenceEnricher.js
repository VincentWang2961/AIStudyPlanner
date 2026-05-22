"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhanceCatalogueWithSequenceData = EnhanceCatalogueWithSequenceData;
/**
 * Enhance a programme catalogue with sequence ordering data and specialisation info.
 * Reads from additional data sources (Excel, courses.json) when available.
 */
const DEFAULT_CREDIT_POINTS = 6;
// Some well-known unit relationships that should be respected in sequencing
const KNOWN_PREREQ_CHAINS = {
    '62510': [
        ['CITS4009', 'CITS4404', 'CITS5509'],
        ['CITS4009', 'CITS4402'],
        ['CITS4012', 'CITS5205'],
        ['CITS4012', 'CITS5553'],
        ['CITS4013', 'CITS5508'],
        ['CITS4009', 'CITS4404', 'CITS5021'],
        ['CITS4012', 'CITS5020'],
    ],
    '41680': [],
    'BP059': [],
};
const KNOWN_SPECIALISATIONS = {
    '62510': [
        {
            code: 'SP-APCMP',
            name: 'Applied Computing',
            coreUnits: ['CITS4009', 'CITS4012', 'CITS5017'],
            electiveOptions: ['CITS4402', 'CITS4403', 'CITS4404', 'CITS5508', 'CITS2005', 'CITS5507'],
            description: 'Focus on practical computing skills across software, data, and systems.',
        },
        {
            code: 'SP-ARTIN',
            name: 'Artificial Intelligence',
            coreUnits: ['CITS4009', 'CITS4012', 'CITS4404', 'CITS5017', 'CITS5508'],
            electiveOptions: ['CITS4402', 'CITS4403', 'CITS4407', 'CITS5507'],
            description: 'Deep dive into AI, machine learning, and intelligent systems.',
        },
        {
            code: 'SP-SOFSY',
            name: 'Software Systems',
            coreUnits: ['CITS4012', 'CITS5017', 'CITS4401', 'CITS5505'],
            electiveOptions: ['CITS5501', 'CITS5503', 'CITS4403', 'CITS5506', 'CITS4407', 'CITS5507'],
            description: 'Advanced software engineering, cloud systems, and cybersecurity.',
        },
    ],
    '41680': [],
    'BP059': [],
};
/**
 * Assign sequence ordering and foundation flags to units based on known UWA data.
 */
function assignSequenceOrder(catalogue) {
    // Units with no prerequisites are foundation / early-semester units
    const unitMap = new Map(catalogue.units.map((u) => [u.code, u]));
    for (const unit of catalogue.units) {
        unit.incompatibilities = unit.incompatibilities ?? [];
        unit.corequisites = unit.corequisites ?? [];
        if (!unit.prerequisites || unit.prerequisites.length === 0) {
            unit.sequenceOrder = 0;
            unit.isFoundationUnit = true;
        }
        else {
            // Compute depth: longest prerequisite chain leading to this unit
            const depth = computePrerequisiteDepth(unit.code, unitMap, new Set(), 0);
            unit.sequenceOrder = depth;
            unit.isFoundationUnit = false;
        }
    }
}
function computePrerequisiteDepth(code, unitMap, visited, depth) {
    if (visited.has(code))
        return depth;
    visited.add(code);
    const unit = unitMap.get(code);
    if (!unit || !unit.prerequisites || unit.prerequisites.length === 0) {
        return depth;
    }
    let maxDepth = depth;
    for (const prereq of unit.prerequisites) {
        const prereqDepth = computePrerequisiteDepth(prereq, unitMap, visited, depth + 1);
        maxDepth = Math.max(maxDepth, prereqDepth);
    }
    return maxDepth;
}
/**
 * Build prerequisite chains from the catalogue data.
 */
function buildPrerequisiteChains(catalogue) {
    const programChains = KNOWN_PREREQ_CHAINS[catalogue.programCode];
    if (programChains && programChains.length > 0) {
        return programChains;
    }
    // Fallback: build chains from unit prerequisites
    const chains = [];
    const unitMap = new Map(catalogue.units.map((u) => [u.code, u]));
    for (const unit of catalogue.units) {
        if (unit.prerequisites && unit.prerequisites.length > 0) {
            for (const prereq of unit.prerequisites) {
                chains.push([prereq, unit.code]);
            }
        }
    }
    return chains;
}
function buildSequenceData(catalogue) {
    const sequenceData = [];
    // Group units by sequence depth to recommend semester placement
    const byDepth = new Map();
    for (const unit of catalogue.units) {
        const depth = unit.sequenceOrder ?? 0;
        if (!byDepth.has(depth))
            byDepth.set(depth, []);
        byDepth.get(depth).push(unit.code);
    }
    // Estimate which semester a unit goes in based on depth (assuming ~4 units/sem)
    const UNITS_PER_SEM = catalogue.defaultUnitsPerSemester || 4;
    let semesterIndex = 0;
    let countInCurrentSem = 0;
    const sortedDepths = Array.from(byDepth.entries()).sort((a, b) => a[0] - b[0]);
    for (const [depth, unitCodes] of sortedDepths) {
        for (const code of unitCodes) {
            if (countInCurrentSem >= UNITS_PER_SEM) {
                semesterIndex++;
                countInCurrentSem = 0;
            }
            const semesterNum = semesterIndex + 1;
            const year = 2026 + Math.floor((semesterIndex) / 2);
            const semLabel = semesterIndex % 2 === 0 ? 'S1' : 'S2';
            const depthDescription = depth === 0
                ? 'Foundation — no prerequisites required'
                : depth === 1
                    ? 'Early — may depend on foundation units'
                    : depth >= 3
                        ? 'Advanced — requires several prerequisite chains'
                        : 'Intermediate — check prerequisites';
            sequenceData.push({
                unitCode: code,
                recommendedSemester: `${semLabel} ${year}`,
                notes: `${depthDescription}. Seq depth: ${depth}`,
            });
            countInCurrentSem++;
        }
    }
    return sequenceData;
}
/**
 * Main enrichment function.
 */
async function EnhanceCatalogueWithSequenceData(catalogue) {
    const enhanced = { ...catalogue };
    // Ensure new fields exist
    enhanced.specialisations = KNOWN_SPECIALISATIONS[catalogue.programCode] ?? [];
    // incompatibilities are already part of each PlannerUnit
    // Assign sequence order
    assignSequenceOrder(enhanced);
    // Build prerequisite chains
    enhanced.prerequisiteChains = buildPrerequisiteChains(enhanced);
    // Build sequence data
    enhanced.sequenceData = buildSequenceData(enhanced);
    return enhanced;
}
