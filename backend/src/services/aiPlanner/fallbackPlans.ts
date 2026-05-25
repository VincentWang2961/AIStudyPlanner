/**
 * Deterministic Fallback Plan Builder
 *
 * Builds a valid study plan from the programme catalogue using a greedy
 * constraint-satisfaction algorithm. Used when AI generation fails.
 *
 * Rules applied:
 * 1. Foundation units (no prereqs) go first
 * 2. Units placed only in their available semesters
 * 3. Prerequisites must be satisfied before dependents
 * 4. Core units must be included
 * 5. Capstone in final semester
 * 6. Max 4 units per semester (24 points)
 * 7. Specialisation core units prioritized
 */

import {
  ProgramCatalogue,
  PlannerUnit,
  PlanUnitSelection,
  PlanSemester,
  StudyPlanResponse,
  SpecialisationInfo,
} from "./types";

// ─── Helpers ───────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString();
}

function isAvailableIn(unit: PlannerUnit, semester: string): boolean {
  return unit.availability.includes(semester);
}

function prereqsSatisfied(
  unit: PlannerUnit,
  scheduledCodes: Set<string>
): boolean {
  if (unit.prerequisites.length === 0) return true;
  // ANY prerequisite satisfied (OR relationship for most UWA units)
  return unit.prerequisites.some((p) => scheduledCodes.has(p));
}

function unitTypeForSpec(
  unitCode: string,
  spec: SpecialisationInfo | undefined,
  coreSet: Set<string>
): "core" | "elective" {
  if (coreSet.has(unitCode)) return "core";
  return "elective";
}

function rationaleFor(unit: PlannerUnit, scheduledCodes: Set<string>): string {
  const parts: string[] = [];
  parts.push(unit.availability.includes("S1") && unit.availability.includes("S2")
    ? "Available both semesters"
    : `${unit.availability.join("/")} only`);
  if (unit.prerequisites.length > 0) {
    const met = unit.prerequisites.filter((p) => scheduledCodes.has(p));
    parts.push(`prereq ${met.join(",")} met`);
  }
  return parts.join("; ");
}

function isS1SemesterForTerm(seq: number, startTerm: 'S1' | 'S2'): boolean {
  if (startTerm === 'S1') return seq % 2 === 1;
  return seq % 2 === 0;
}

function semesterLabel(seq: number, startTerm: 'S1' | 'S2' = 'S1', startYear = 2026): string {
  const term = isS1SemesterForTerm(seq, startTerm) ? 'S1' : 'S2';
  // S1 start: year offsets 0,0,1,1,2,2...  →  floor((seq-1)/2)
  // S2 start: year offsets 0,1,1,2,2,3...  →  floor(seq/2)
  const yearOffset = startTerm === 'S1' ? Math.floor((seq - 1) / 2) : Math.floor(seq / 2);
  const year = startYear + yearOffset;
  return `${term} ${year}`;
}

// ─── Core builder ──────────────────────────────────────────────────

export function buildDeterministicPlan(
  catalogue: ProgramCatalogue,
  specialisationCode?: string,
  startTerm: 'S1' | 'S2' = 'S1',
  startYear = 2026,
): StudyPlanResponse {
  // Normalise spec code: SP-ARTIN → SP_ARTIN
  const normalisedCode = specialisationCode?.replace(/-/g, '_');
  const spec = normalisedCode
    ? catalogue.specialisations.find((s) => s.code === normalisedCode)
    : catalogue.specialisations[0];

  const specName = spec?.name || "General";
  const totalPoints = catalogue.totalCreditPoints || 96;
  const maxPerSemester = catalogue.defaultUnitsPerSemester || 4;

  // Determine core units
  const coreSet = new Set<string>();
  // Course-level core from constraints
  const coreConstraint = catalogue.constraints.find((c) => c.code === "CORE_COMPLETION");
  
  // Find all units marked as 'core' type
  for (const unit of catalogue.units) {
    if (unit.type === "core") {
      coreSet.add(unit.code);
    }
  }

  // Build specialisation core from constraints
  const specCoreSet = new Set<string>();
  if (spec) {
    for (const code of spec.coreUnits) specCoreSet.add(code);
    // Also add course-level core to everything
    for (const code of coreSet) specCoreSet.add(code);
  }

  // Sort units: foundation first, then by prereq depth
  const sorted = [...catalogue.units].sort((a, b) => {
    // Foundation units (no prereqs) first
    if (a.prerequisites.length === 0 && b.prerequisites.length > 0) return -1;
    if (b.prerequisites.length === 0 && a.prerequisites.length > 0) return 1;
    // Then by code
    return a.code.localeCompare(b.code);
  });

  // Separate into availability buckets
  const s1Units = sorted.filter((u) => isAvailableIn(u, "S1") || isAvailableIn(u, "N/A"));
  const s2Units = sorted.filter((u) => isAvailableIn(u, "S2") || isAvailableIn(u, "N/A"));

  const scheduledCodes = new Set<string>();
  const semesters: PlanSemester[] = [];
  let semesterSeq = 1;
  let remainingPoints = totalPoints;

  // Find the capstone unit
  const capstoneUnits = sorted.filter((u) =>
    u.code === "CITS5206" ||
    u.title.toLowerCase().includes("capstone") ||
    coreSet.has(u.code) && u.prerequisites.length >= 2
  );
  const capstone = capstoneUnits[0];

  // Track what's been used
  const used = new Set<string>();

  // Greedy placement: alternate S1/S2, prioritize core then foundation
  while (remainingPoints > 0 && semesterSeq <= 8) {
    const isS1Semester = isS1SemesterForTerm(semesterSeq, startTerm);
    const pool = isS1Semester ? s1Units : s2Units;
    const semesterUnits: PlanUnitSelection[] = [];

    // Priority order:
    // 1. Core units not yet scheduled
    // 2. Foundation units (no prereqs)  
    // 3. Electives with satisfied prereqs

    const candidates = pool
      .filter((u) => !used.has(u.code))
      .filter((u) => prereqsSatisfied(u, scheduledCodes))
      .sort((a, b) => {
        // Capstone always last
        if (a.code === capstone?.code) return 1;
        if (b.code === capstone?.code) return -1;
        // Spec core + course core first
        const aCore = specCoreSet.has(a.code) || coreSet.has(a.code) ? 0 : 1;
        const bCore = specCoreSet.has(b.code) || coreSet.has(b.code) ? 0 : 1;
        if (aCore !== bCore) return aCore - bCore;
        // Then foundation
        const aFound = a.prerequisites.length === 0 ? 0 : 1;
        const bFound = b.prerequisites.length === 0 ? 0 : 1;
        return aFound - bFound;
      });

    // Capstone: only place in final semester when we're nearly done
    const capstoneCandidate = candidates.find((u) => u.code === capstone?.code);
    const capstoneReady = remainingPoints <= 30; // ~last 2 semesters

    for (const unit of candidates) {
      if (semesterUnits.length >= maxPerSemester) break;
      if (remainingPoints - 6 < 0) break;
      // Hold capstone until the end
      if (unit.code === capstone?.code && !capstoneReady) continue;
      // Skip if unit has prereqs that aren't met yet (safety check)
      if (!prereqsSatisfied(unit, scheduledCodes)) continue;

      const isCore = coreSet.has(unit.code) || specCoreSet.has(unit.code);
      semesterUnits.push({
        code: unit.code,
        title: unit.title,
        creditPoints: unit.creditPoints,
        type: isCore ? "core" : "elective",
        rationale: rationaleFor(unit, scheduledCodes),
      });
      used.add(unit.code);
      scheduledCodes.add(unit.code);
      remainingPoints -= unit.creditPoints;
    }

    if (semesterUnits.length > 0) {
      semesters.push({
        sequence: semesterSeq,
        label: semesterLabel(semesterSeq, startTerm, startYear),
        units: semesterUnits,
      });
    }

    semesterSeq++;
  }

  // Fill incomplete semesters with remaining electives
  for (const sem of semesters) {
    if (sem.units.length >= maxPerSemester) continue;
    const isS1Semester = isS1SemesterForTerm(sem.sequence, startTerm);
    const pool = isS1Semester ? s1Units : s2Units;
    const fillCandidates = pool
      .filter(u => !used.has(u.code))
      .filter(u => capstone?.code !== u.code) // don't force capstone early
      .sort((a, b) => a.code.localeCompare(b.code));
    for (const unit of fillCandidates) {
      if (sem.units.length >= maxPerSemester) break;
      sem.units.push({
        code: unit.code, title: unit.title, creditPoints: unit.creditPoints,
        type: 'elective', rationale: `Available ${unit.availability.join("/")}`,
      });
      used.add(unit.code);
      scheduledCodes.add(unit.code);
    }
  }

  // Force-schedule remaining core units (capstone top priority)
  const remainingCore = sorted.filter(u => 
    !used.has(u.code) && (coreSet.has(u.code) || specCoreSet.has(u.code))
  );
  // Always try to force capstone into the last semester
  if (capstone && !used.has(capstone.code)) {
    const lastSem = semesters[semesters.length - 1];
    if (lastSem) {
      // Replace an elective with capstone
      const electiveIdx = lastSem.units.findIndex(
        u => u.type === 'elective' && !coreSet.has(u.code) && !specCoreSet.has(u.code)
      );
      if (electiveIdx >= 0) {
        const removed = lastSem.units[electiveIdx];
        lastSem.units[electiveIdx] = {
          code: capstone.code, title: capstone.title, creditPoints: capstone.creditPoints,
          type: 'core', rationale: 'Capstone — required for graduation',
        };
        used.delete(removed.code);
        scheduledCodes.delete(removed.code);
        used.add(capstone.code);
        scheduledCodes.add(capstone.code);
      }
    }
  }
  // Force remaining core units into any available slot
  for (const unit of remainingCore) {
    if (used.has(unit.code)) continue;
    if (unit.code === capstone?.code) continue; // handled above
    for (const sem of semesters) {
      if (sem.units.length >= maxPerSemester) continue;
      sem.units.push({
        code: unit.code, title: unit.title, creditPoints: unit.creditPoints,
        type: 'core', rationale: 'Core requirement',
      });
      used.add(unit.code);
      scheduledCodes.add(unit.code);
      break;
    }
  }

  const allCoreScheduled = [...coreSet].every((c) => scheduledCodes.has(c));

  return {
    version: "1.0",
    generatedAt: today(),
    language: "en-GB",
    plan: {
      programCode: catalogue.programCode,
      programName: catalogue.programName,
      focusArea: specName,
      semesters,
      summary: {
        totalCreditPoints: totalPoints - remainingPoints,
        totalUnits: used.size,
        prerequisitesAssumedStrict: true,
      },
    },
    explanation: {
      overview: `Deterministic fallback plan for ${specName}. Built from catalogue with ${catalogue.units.length} units, ${semesters.length} semesters.`,
      electiveRationales: [
        "Units selected based on availability and prerequisite chains",
        "Priority: core → foundation → elective",
        `Capstone ${capstone ? capstone.code : 'N/A'} placed in final semester`,
      ],
    },
    constraintsAcknowledged: [
      `AVAILABILITY: Only ${semesters.length} semesters needed`,
      `CORE: ${allCoreScheduled ? 'All' : [...coreSet].filter(c => !scheduledCodes.has(c)).length + ' missing'} core units included`,
      `CAPSTONE: ${capstone && scheduledCodes.has(capstone.code) ? capstone.code + ' in final semester' : 'Not scheduled'}`,
    ],
    warnings: [
      "⚠️ This is a DETERMINISTIC FALLBACK plan — review carefully before enrolling.",
      "⚠️ May not account for all specialisation elective requirements.",
      "⚠️ Unit availability may change between handbook publication and enrolment.",
    ],
    reasoning: {
      prerequisiteAnalysis: sorted
        .filter((u) => u.prerequisites.length > 0 && scheduledCodes.has(u.code))
        .slice(0, 8)
        .map((u) => `${u.code} needs ${u.prerequisites.join(" or ")}`),
      specialisationFulfillment: spec
        ? [`All ${spec.name} core units prioritized in scheduling`]
        : ["No specialisation specified"],
      workloadConsiderations: [
        `Max ${maxPerSemester} units (${maxPerSemester * 6} points) per semester`,
      ],
    },
  };
}

// ─── API-compatible interface ──────────────────────────────────────

const hardcodedFallbacks: Record<string, StudyPlanResponse> = {};

// Pre-populate with official UWA 2-year plans for instant responses
function seedOfficialPlans() {
  const specs: Record<string, { semesters: { label: string; units: string[] }[] }> = {
    'General': {
      semesters: [
        { label: 'S1 2026', units: ['CITS1003', 'CITS1401', 'CITS1402', 'PHIL4100'] },
        { label: 'S2 2026', units: ['CITS2002', 'CITS4009', 'CITS4012', 'CITS4403'] },
        { label: 'S1 2027', units: ['CITS4401', 'CITS5505', 'CITS5508', 'CITS4402'] },
        { label: 'S2 2027', units: ['CITS5206', 'CITS5017', 'CITS5503', 'CITS5501'] },
      ]
    },
    'Applied Computing': {
      semesters: [
        { label: 'S1 2026', units: ['CITS1003', 'CITS1401', 'CITS1402', 'PHIL4100'] },
        { label: 'S2 2026', units: ['CITS2002', 'CITS4012', 'CITS4009', 'CITS4403'] },
        { label: 'S1 2027', units: ['CITS4401', 'CITS5505', 'CITS5508', 'CITS5506'] },
        { label: 'S2 2027', units: ['CITS5206', 'CITS5507', 'CITS5503', 'SVLG5001'] },
      ]
    },
    'Artificial Intelligence': {
      semesters: [
        { label: 'S1 2026', units: ['CITS1003', 'CITS1401', 'CITS1402', 'PHIL4100'] },
        { label: 'S2 2026', units: ['CITS2002', 'CITS4012', 'CITS4403', 'MGMT5504'] },
        { label: 'S1 2027', units: ['CITS4401', 'CITS5505', 'CITS5508', 'CITS4404'] },
        { label: 'S2 2027', units: ['CITS5206', 'CITS5017', 'CITS5503', 'CITS5507'] },
      ]
    },
    'Software Systems': {
      semesters: [
        { label: 'S1 2026', units: ['CITS1003', 'CITS1401', 'CITS1402', 'PHIL4100'] },
        { label: 'S2 2026', units: ['CITS2002', 'CITS4009', 'CITS4403', 'MGMT5504'] },
        { label: 'S1 2027', units: ['CITS4401', 'CITS5505', 'CITS5506', 'CITS5504'] },
        { label: 'S2 2027', units: ['CITS5206', 'CITS5507', 'CITS5501', 'CITS5503'] },
      ]
    },
  };

  for (const [specName, data] of Object.entries(specs)) {
    const plan: StudyPlanResponse = {
      version: '1.0',
      generatedAt: today(),
      language: 'en-GB',
      plan: {
        programCode: '62510',
        programName: 'Master of Information Technology',
        focusArea: specName === 'General' ? 'No specialisation' : specName,
        semesters: data.semesters.map((s, i) => ({
          sequence: i + 1,
          label: s.label,
          units: s.units.map((code) => ({
            code,
            title: code,
            creditPoints: 6,
            type: 'core' as const,
            rationale: 'Official UWA recommended unit',
          })),
        })),
        summary: { totalCreditPoints: 96, totalUnits: 16, prerequisitesAssumedStrict: true },
      },
      explanation: {
        overview: `Official UWA ${specName} study plan (instant generation).`,
        electiveRationales: ['Based on official UWA recommended course structure.'],
      },
      constraintsAcknowledged: ['STRICT_PREREQUISITES', 'AVAILABILITY', 'CAPSTONE_LAST_SEMESTER'],
      warnings: ['Review before enrolling.'],
      reasoning: {
        prerequisiteAnalysis: ['Follows official UWA recommended sequencing.'],
        specialisationFulfillment: [`${specName} specialisation requirements met.`],
        workloadConsiderations: ['4 units (24 points) per semester.'],
      },
    };
    hardcodedFallbacks[specName] = plan;
  }
}

seedOfficialPlans();

export function hasFallbackPlan(programCode: string): boolean {
  return programCode in hardcodedFallbacks;
}

export function getFallbackPlan(
  programCode: string,
  focusArea?: string
): StudyPlanResponse | null {
  // Check hardcoded official template (MIT only)
  if (programCode === '62510') {
    const key = focusArea || 'General';
    const template = hardcodedFallbacks[key];
    if (template) {
      // Deep-clone to prevent mutation of shared template
      const plan = JSON.parse(JSON.stringify(template)) as StudyPlanResponse;
      plan.plan.focusArea = focusArea || plan.plan.focusArea;
      return plan;
    }
  }
  return null;
}

export function registerFallbackPlan(
  programCode: string,
  plan: StudyPlanResponse
): void {
  hardcodedFallbacks[programCode] = plan;
}
