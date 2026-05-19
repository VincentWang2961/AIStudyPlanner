import {
  fetchCourseByCode,
  fetchUnitsForCourse,
  fetchGroupsForCourse,
  fetchUnitsForGroup,
} from "../courseService";

export type PlannedTerm = {
  sequence: number;
  year: number;
  term: "S1" | "S2";
  units: string[];
};

export type ValidatePlanRequest = {
  courseCode: string;
  completedUnits: string[];
  selectedSpecialisations: string[];
  plan: PlannedTerm[];
};

export type ValidationIssue = {
  category: string;
  severity: "pass" | "warning" | "fail";
  title: string;
  message: string;
};

export type ValidationResult = {
  overallStatus: "pass" | "warning" | "fail";
  issues: ValidationIssue[];
};

function getOverallStatus(issues: ValidationIssue[]): "pass" | "warning" | "fail" {
  if (issues.some((issue) => issue.severity === "fail")) return "fail";
  if (issues.some((issue) => issue.severity === "warning")) return "warning";
  return "pass";
}

function isValidTerm(term: unknown): term is "S1" | "S2" {
  return term === "S1" || term === "S2";
}

function validateRequestShape(payload: any): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!payload || typeof payload !== "object") {
    issues.push({
      category: "request",
      severity: "fail",
      title: "Invalid request",
      message: "Validation request body is missing or invalid.",
    });

    return issues;
  }

  if (!payload.courseCode || typeof payload.courseCode !== "string") {
    issues.push({
      category: "request",
      severity: "fail",
      title: "Missing course code",
      message: "A valid courseCode must be provided.",
    });
  }

  if (!Array.isArray(payload.completedUnits)) {
    issues.push({
      category: "request",
      severity: "fail",
      title: "Invalid completed units",
      message: "completedUnits must be an array of unit codes.",
    });
  }

  if (!Array.isArray(payload.selectedSpecialisations)) {
    issues.push({
      category: "request",
      severity: "fail",
      title: "Invalid selected specialisations",
      message: "selectedSpecialisations must be an array.",
    });
  }

  if (!Array.isArray(payload.plan)) {
    issues.push({
      category: "request",
      severity: "fail",
      title: "Invalid plan",
      message: "plan must be an array of semester objects.",
    });

    return issues;
  }

  payload.plan.forEach((term: any, index: number) => {
    if (typeof term.sequence !== "number") {
      issues.push({
        category: "request",
        severity: "fail",
        title: "Invalid semester sequence",
        message: `Plan term at index ${index} must include a numeric sequence.`,
      });
    }

    if (typeof term.year !== "number") {
      issues.push({
        category: "request",
        severity: "fail",
        title: "Invalid semester year",
        message: `Plan term at index ${index} must include a numeric year.`,
      });
    }

    if (!isValidTerm(term.term)) {
      issues.push({
        category: "request",
        severity: "fail",
        title: "Invalid semester term",
        message: `Plan term at index ${index} must use term S1 or S2.`,
      });
    }

    if (!Array.isArray(term.units)) {
      issues.push({
        category: "request",
        severity: "fail",
        title: "Invalid semester units",
        message: `Plan term at index ${index} must include units as an array.`,
      });
    }
  });

  return issues;
}

function flattenPlannedUnits(plan: PlannedTerm[]): string[] {
  return plan.flatMap((term) => term.units);
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    } else {
      seen.add(value);
    }
  }

  return Array.from(duplicates);
}

function validateUnitMembership(params: {
  completedUnits: string[];
  plannedUnits: string[];
  courseUnitCodes: Set<string>;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const allSubmittedUnits = [
    ...params.completedUnits,
    ...params.plannedUnits,
  ];

  for (const unitCode of allSubmittedUnits) {
    if (!params.courseUnitCodes.has(unitCode)) {
      issues.push({
        category: "unit-membership",
        severity: "fail",
        title: "Unit not in selected course",
        message: `${unitCode} is not listed as a unit for this course.`,
      });
    }
  }

  return issues;
}

function validateDuplicateUnits(params: {
  completedUnits: string[];
  plannedUnits: string[];
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const duplicatedPlannedUnits = findDuplicates(params.plannedUnits);

  for (const unitCode of duplicatedPlannedUnits) {
    issues.push({
      category: "duplicate-unit",
      severity: "fail",
      title: "Duplicate planned unit",
      message: `${unitCode} appears more than once in the planned semesters.`,
    });
  }

  const completedSet = new Set(params.completedUnits);

  for (const unitCode of params.plannedUnits) {
    if (completedSet.has(unitCode)) {
      issues.push({
        category: "duplicate-unit",
        severity: "warning",
        title: "Already completed unit planned again",
        message: `${unitCode} is already marked as completed but also appears in the plan.`,
      });
    }
  }

  return issues;
}

function validateSemesterUnitLoad(plan: PlannedTerm[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const term of plan) {
    if (term.units.length > 4) {
      issues.push({
        category: "semester-load",
        severity: "fail",
        title: "Too many units in semester",
        message: `${term.term} ${term.year} has ${term.units.length} units. A semester can contain at most 4 units.`,
      });
    }
  }

  return issues;
}

function validateAvailability(params: {
  plan: PlannedTerm[];
  unitByCode: Map<string, any>;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const term of params.plan) {
    for (const unitCode of term.units) {
      const unit = params.unitByCode.get(unitCode);

      if (!unit) continue;

      const availability = String(unit.availabilities ?? "N/A")
        .trim()
        .toUpperCase();

      if (availability === "N/A") {
        issues.push({
          category: "availability",
          severity: "fail",
          title: "Unit not available",
          message: `${unitCode} is marked as not available.`,
        });
        continue;
      }

      const availableTerms = availability
        .split(",")
        .map((value) => value.trim());

      if (!availableTerms.includes(term.term)) {
        issues.push({
          category: "availability",
          severity: "fail",
          title: "Unit not available in selected semester",
          message: `${unitCode} is planned in ${term.term}, but it is only available in ${availability}.`,
        });
      }
    }
  }

  return issues;
}

type RuleNode =
  | { type: "UNIT"; code: string }
  | { type: "POINTS"; value: number; constraints?: any }
  | { type: "WAM"; minimum: number; scope?: any }
  | { type: "AND"; children: RuleNode[] }
  | { type: "OR"; children: RuleNode[] };

type GroupRuleNode =
  | { type: "TAKE_ALL_FROM_GROUP"; group: string }
  | {
      type: "POINTS_FROM_GROUP";
      group: string;
      value: number;
      mode: "MIN" | "MAX" | "EXACT";
      constraints?: {
        levels?: number[];
      };
    }
  | {
      type: "POINTS_TOTAL_FROM_GROUP_SET";
      groups: string[];
      value: number;
      mode: "MIN" | "MAX" | "EXACT";
    }
  | { type: "AND"; children: GroupRuleNode[] }
  | { type: "TEXT"; value: string };

function ruleToText(rule: RuleNode | null): string {
  if (!rule) return "No rule";

  if (rule.type === "UNIT") return rule.code;

  if (rule.type === "POINTS") {
    const constraints: string[] = [];

    if (rule.constraints?.levels?.length) {
      constraints.push(`level ${rule.constraints.levels.join("/")}`);
    }

    if (rule.constraints?.prefixes?.length) {
      constraints.push(`${rule.constraints.prefixes.join("/")} units`);
    }

    if (rule.constraints?.category) {
      constraints.push(rule.constraints.category);
    }

    return constraints.length > 0
      ? `${rule.value} points of ${constraints.join(" ")}`
      : `${rule.value} points`;
  }

  if (rule.type === "WAM") {
    return `WAM of at least ${rule.minimum}`;
  }

  if (rule.type === "AND") {
    return rule.children.map(ruleToText).join(" and ");
  }

  if (rule.type === "OR") {
    return rule.children.map(ruleToText).join(" or ");
  }

  return "Unknown rule";
}

function getUnitLevel(unitCode: string): number | null {
  const match = unitCode.match(/\d/);
  return match ? Number(match[0]) : null;
}

function unitMatchesPointConstraints(
  unitCode: string,
  constraints?: {
    prefixes?: string[];
    levels?: number[];
    category?: string;
  }
): boolean {
  if (!constraints) return true;

  if (constraints.prefixes?.length) {
    const matchesPrefix = constraints.prefixes.some((prefix) =>
      unitCode.startsWith(prefix)
    );

    if (!matchesPrefix) return false;
  }

  if (constraints.levels?.length) {
    const level = getUnitLevel(unitCode);
    if (level === null || !constraints.levels.includes(level)) {
      return false;
    }
  }

  return true;
}

function countCompletedPoints(
  completedUnits: Set<string>,
  constraints?: {
    prefixes?: string[];
    levels?: number[];
    category?: string;
  }
): number {
  let points = 0;

  for (const unitCode of completedUnits) {
    if (unitMatchesPointConstraints(unitCode, constraints)) {
      // Assumption: every unit is worth 6 points
      points += 6;
    }
  }

  return points;
}

function isRuleSatisfied(rule: RuleNode | null, completedUnits: Set<string>): boolean {
  if (!rule) return true;

  if (rule.type === "UNIT") {
    return completedUnits.has(rule.code);
  }

  if (rule.type === "AND") {
    return rule.children.every((child) => isRuleSatisfied(child, completedUnits));
  }

  if (rule.type === "OR") {
    return rule.children.some((child) => isRuleSatisfied(child, completedUnits));
  }

  if (rule.type === "POINTS") {
    const completedPoints = countCompletedPoints(
      completedUnits,
      rule.constraints
    );

    return completedPoints >= rule.value;
  }

  // TODO: WAM cannot be fully evaluated until frontend sends marks
  if (rule.type === "WAM") {
    return true;
  }

  return true;
}

function collectWamRules(rule: RuleNode | null): RuleNode[] {
  if (!rule) return [];

  if (rule.type === "WAM") {
    return [rule];
  }

  if (rule.type === "AND" || rule.type === "OR") {
    return rule.children.flatMap(collectWamRules);
  }

  return [];
}

function validatePrerequisites(params: {
  plan: PlannedTerm[];
  completedUnits: string[];
  unitByCode: Map<string, any>;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const completed = new Set(params.completedUnits);

  const sortedPlan = [...params.plan].sort((a, b) => a.sequence - b.sequence);

  for (const term of sortedPlan) {
    for (const unitCode of term.units) {
      const unit = params.unitByCode.get(unitCode);
      if (!unit) continue;

      const prereqRule = unit.prerequisites_parsed as RuleNode | null;

      const wamRules = collectWamRules(prereqRule);

      for (const wamRule of wamRules) {
        if (wamRule.type !== "WAM") continue;

        issues.push({
          category: "wam",
          severity: "warning",
          title: "WAM requirement not verified",
          message: `${unitCode} requires a WAM of at least ${wamRule.minimum}. This cannot be verified unless marks are provided.`,
        });
      }

      if (!isRuleSatisfied(prereqRule, completed)) {
        const prereqText = ruleToText(prereqRule);
        // Point-based prerequisites (e.g. "96 points") are hard to verify
        // without admission credit info — downgrade to warning
        const isPointBased = /^\d+ points/.test(prereqText);
        issues.push({
          category: "prerequisite",
          severity: isPointBased ? "warning" : "fail",
          title: "Missing prerequisite",
          message: `${unitCode} requires ${prereqText} before it can be taken in ${term.term} ${term.year}.${isPointBased ? ' This may be met via admission credit or prior study.' : ''}`,
        });
      }
    }

    // After validating this semester, assume planned units are completed
    for (const unitCode of term.units) {
      completed.add(unitCode);
    }
  }

  return issues;
}

function validateCorequisites(params: {
  plan: PlannedTerm[];
  completedUnits: string[];
  unitByCode: Map<string, any>;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const completed = new Set(params.completedUnits);

  const sortedPlan = [...params.plan].sort((a, b) => a.sequence - b.sequence);

  for (const term of sortedPlan) {
    const sameTermUnits = new Set(term.units);
    const availableForCoreq = new Set([...completed, ...sameTermUnits]);

    for (const unitCode of term.units) {
      const unit = params.unitByCode.get(unitCode);
      if (!unit) continue;

      const coreqRule = unit.corequisites_parsed as RuleNode | null;

      if (!isRuleSatisfied(coreqRule, availableForCoreq)) {
        issues.push({
          category: "corequisite",
          severity: "fail",
          title: "Missing corequisite",
          message: `${unitCode} requires ${ruleToText(coreqRule)} to be completed before or taken in the same semester.`,
        });
      }
    }

    // After validating the semester, assume its units are completed
    for (const unitCode of term.units) {
      completed.add(unitCode);
    }
  }

  return issues;
}

function validateIncompatibilities(params: {
  plan: PlannedTerm[];
  completedUnits: string[];
  unitByCode: Map<string, any>;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const completedSet = new Set(params.completedUnits);
  const plannedUnits = flattenPlannedUnits(params.plan);
  const plannedSet = new Set(plannedUnits);

  const allTakenOrPlanned = new Set([
    ...params.completedUnits,
    ...plannedUnits,
  ]);

  for (const term of params.plan) {
    for (const unitCode of term.units) {
      const unit = params.unitByCode.get(unitCode);
      if (!unit) continue;

      const incompatRule = unit.incompatibilities_parsed as RuleNode | null;

      if (!incompatRule) continue;

      if (isRuleSatisfied(incompatRule, allTakenOrPlanned)) {
        const messageTarget = ruleToText(incompatRule);

        const severity: "warning" | "fail" =
          completedSet.has(messageTarget) || plannedSet.has(messageTarget)
            ? "fail"
            : "warning";

        issues.push({
          category: "incompatibility",
          severity,
          title: "Incompatible unit detected",
          message: `${unitCode} is incompatible with ${messageTarget}.`,
        });
      }
    }
  }

  return issues;
}

function countPointsForUnits(unitCodes: string[]): number {
  // Assumption: each unit is worth 6 points
  return unitCodes.length * 6;
}

function filterUnitsByLevel(unitCodes: string[], levels?: number[]): string[] {
  if (!levels || levels.length === 0) return unitCodes;

  return unitCodes.filter((unitCode) => {
    const level = getUnitLevel(unitCode);
    return level !== null && levels.includes(level);
  });
}

function evaluateGroupRule(params: {
  rule: GroupRuleNode | null;
  groupCode: string;
  groupUnits: string[];
  selectedUnits: Set<string>;
  groupUnitsByCode: Map<string, string[]>;
}): ValidationIssue[] {
  const { rule, groupCode, groupUnits, selectedUnits, groupUnitsByCode } = params;
  const issues: ValidationIssue[] = [];

  if (!rule) return issues;

  if (rule.type === "TEXT") {
    // TODO: Handle course-specific text rules separately
    return issues;
  }

  if (rule.type === "AND") {
    for (const child of rule.children) {
      issues.push(
        ...evaluateGroupRule({
          rule: child,
          groupCode,
          groupUnits,
          selectedUnits,
          groupUnitsByCode,
        })
      );
    }

    return issues;
  }

  if (rule.type === "TAKE_ALL_FROM_GROUP") {
    const missingUnits = groupUnits.filter((unitCode) => !selectedUnits.has(unitCode));

    if (missingUnits.length > 0) {
      issues.push({
        category: "group-requirement",
        severity: "warning",
        title: "Required group units missing",
        message: `You still need to include all units from ${groupCode}. Missing: ${missingUnits.join(", ")}.`,
      });
    }

    return issues;
  }

  if (rule.type === "POINTS_FROM_GROUP") {
    const relevantGroupUnits = groupUnitsByCode.get(rule.group) ?? [];
    const selectedFromGroup = relevantGroupUnits.filter((unitCode) =>
      selectedUnits.has(unitCode)
    );

    const constrainedUnits = filterUnitsByLevel(
      selectedFromGroup,
      rule.constraints?.levels
    );

    const points = countPointsForUnits(constrainedUnits);

    if (rule.mode === "MIN" && points < rule.value) {
      issues.push({
        category: "group-requirement",
        severity: "warning",
        title: "Group points requirement not met",
        message: `You need at least ${rule.value} points from ${rule.group}. Currently selected: ${points} points.`,
      });
    }

    if (rule.mode === "MAX" && points > rule.value) {
      issues.push({
        category: "group-requirement",
        severity: "fail",
        title: "Too many points from group",
        message: `You can take at most ${rule.value} points from ${rule.group}. Currently selected: ${points} points.`,
      });
    }

    if (rule.mode === "EXACT" && points !== rule.value) {
      issues.push({
        category: "group-requirement",
        severity: "warning",
        title: "Exact group points requirement not met",
        message: `You need exactly ${rule.value} points from ${rule.group}. Currently selected: ${points} points.`,
      });
    }

    return issues;
  }

  if (rule.type === "POINTS_TOTAL_FROM_GROUP_SET") {
    const unitCodesFromGroups = rule.groups.flatMap(
      (code) => groupUnitsByCode.get(code) ?? []
    );

    const selectedFromGroups = unitCodesFromGroups.filter((unitCode) =>
      selectedUnits.has(unitCode)
    );

    const points = countPointsForUnits(Array.from(new Set(selectedFromGroups)));

    if (rule.mode === "MIN" && points < rule.value) {
      issues.push({
        category: "group-requirement",
        severity: "warning",
        title: "Total group points requirement not met",
        message: `You need at least ${rule.value} points from ${rule.groups.join(", ")}. Currently selected: ${points} points.`,
      });
    }

    if (rule.mode === "MAX" && points > rule.value) {
      issues.push({
        category: "group-requirement",
        severity: "fail",
        title: "Too many points from group set",
        message: `You can take at most ${rule.value} points from ${rule.groups.join(", ")}. Currently selected: ${points} points.`,
      });
    }

    if (rule.mode === "EXACT" && points !== rule.value) {
      issues.push({
        category: "group-requirement",
        severity: "warning",
        title: "Total group points requirement not met",
        message: `You need exactly ${rule.value} points from ${rule.groups.join(", ")}. Currently selected: ${points} points.`,
      });
    }

    return issues;
  }

  return issues;
}

function normaliseSpecialisation(value: string): string {
  return value.trim().toLowerCase();
}

function getSelectedSpecialisationGroupCodes(
  selectedSpecialisations: string[],
  courseCode?: string
): Set<string> {
  const selected = new Set<string>();

  for (const specialisation of selectedSpecialisations) {
    const value = normaliseSpecialisation(specialisation);

    if (courseCode === "62510") {
      if (value === "applied computing" || value === "sp_apcmp") {
        selected.add("SP_APCMP");
      }

      if (value === "artificial intelligence" || value === "sp_artin") {
        selected.add("SP_ARTIN");
      }

      if (value === "software systems" || value === "sp_sofsy") {
        selected.add("SP_SOFSY");
      }
    }

    if (courseCode === "41680") {
      if (value === "accounting" || value === "sp-acctg" || value === "sp_acctg") {
        selected.add("GROUP_A");
      }

      if (
        value === "business information and logistics management" ||
        value === "sp-bsimg" ||
        value === "sp_bsimg"
      ) {
        selected.add("GROUP_B");
      }

      if (value === "employment relations" || value === "sp-empco" || value === "sp_empco") {
        selected.add("GROUP_C");
      }

      if (value === "finance" || value === "sp-fince" || value === "sp_fince") {
        selected.add("SP_FINCE_CORE");
        selected.add("GROUP_D");
      }

      if (
        value === "human resource management" ||
        value === "sp-hrsmt" ||
        value === "sp_hrsmt"
      ) {
        selected.add("GROUP_E");
      }

      if (value === "marketing" || value === "sp-mrktg" || value === "sp_mrktg") {
        selected.add("GROUP_F");
      }

      if (value === "economics" || value === "sp-econs" || value === "sp_econs") {
        selected.add("GROUP_G");
      }

      if (value === "management" || value === "sp-mgmnt" || value === "sp_mgmnt") {
        selected.add("SP_MGMNT_CORE");
        selected.add("GROUP_H");
      }

      if (
        value === "international business" ||
        value === "international business (not available for 2021)" ||
        value === "sp-inbus" ||
        value === "sp_inbus"
      ) {
        selected.add("GROUP_I");
      }
    }
  }

  return selected;
}

function shouldValidateGroup(params: {
  courseCode: string;
  groupCode: string;
  selectedSpecialisationGroupCodes: Set<string>;
}): boolean {
  const { courseCode, groupCode, selectedSpecialisationGroupCodes } = params;

  if (courseCode === "62510") {
    // Always validate core.
    if (groupCode === "CORE") return true;

    // Conversion rules are partly dependent on student background/credit,
    // so do not hard-validate them here.
    if (groupCode === "CONVERSION") return false;

    // General option groups should still be checked.
    if (groupCode === "GROUP_A" || groupCode === "GROUP_B" || groupCode === "GROUP_C") {
      // Software Systems students do not require Group A.
      if (
        groupCode === "GROUP_A" &&
        selectedSpecialisationGroupCodes.has("SP_SOFSY")
      ) {
        return false;
      }

      return true;
    }

    // Only validate selected specialisation groups.
    if (groupCode.startsWith("SP_")) {
      return selectedSpecialisationGroupCodes.has(groupCode);
    }
  }

  if (courseCode === "41680") {
    if (groupCode === "CORE") return true;

    // Conversion/flexible option groups. These are background/advice dependent,
    // so do not hard-validate them for every student yet.
    if (groupCode === "GROUP_1" || groupCode === "GROUP_2" || groupCode === "GROUP_3") {
      return false;
    }

    // Only validate the selected Commerce specialisation groups.
    if (
      groupCode.startsWith("GROUP_") ||
      groupCode === "SP_FINCE_CORE" ||
      groupCode === "SP_MGMNT_CORE"
    ) {
      return selectedSpecialisationGroupCodes.has(groupCode);
    }
  }

  // Default behaviour for other courses for now.
  return true;
}

async function validateGroupRules(params: {
  courseCode: string;
  selectedSpecialisations: string[];
  completedUnits: string[];
  plannedUnits: string[];
}): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  const selectedUnits = new Set([
    ...params.completedUnits,
    ...params.plannedUnits,
  ]);

  const selectedSpecialisationGroupCodes = getSelectedSpecialisationGroupCodes(
    params.selectedSpecialisations,
    params.courseCode
  );

  const groups = await fetchGroupsForCourse(params.courseCode);

  const groupsWithUnits = await Promise.all(
    groups.map(async (group) => ({
      ...group,
      units: await fetchUnitsForGroup(group.id),
    }))
  );

  const groupUnitsByCode = new Map<string, string[]>();

  for (const group of groupsWithUnits) {
    groupUnitsByCode.set(
      group.group_code,
      group.units.map((unit) => unit.code)
    );
  }

  for (const group of groupsWithUnits) {
    if (
      !shouldValidateGroup({
        courseCode: params.courseCode,
        groupCode: group.group_code,
        selectedSpecialisationGroupCodes,
      })
    ) {
      continue;
    }

    const groupUnitCodes = group.units.map((unit) => unit.code);

    issues.push(
      ...evaluateGroupRule({
        rule: group.rule_json as GroupRuleNode | null,
        groupCode: group.group_code,
        groupUnits: groupUnitCodes,
        selectedUnits,
        groupUnitsByCode,
      })
    );
  }

  return issues;
}

function validate62510Rules(params: {
  selectedSpecialisations: string[];
  completedUnits: string[];
  plannedUnits: string[];
  plan?: PlannedTerm[];
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const selectedUnits = new Set([
    ...params.completedUnits,
    ...params.plannedUnits,
  ]);

  // ── Capstone: CITS5206 must be in the plan and in the last semester ──
  const CAPSTONE_CODE = 'CITS5206';
  const hasCapstone = selectedUnits.has(CAPSTONE_CODE);

  if (!hasCapstone) {
    issues.push({
      category: 'capstone',
      severity: 'fail',
      title: 'Capstone project missing',
      message: `${CAPSTONE_CODE} (IT Capstone Project) is a mandatory graduation requirement and must be included in the plan.`,
    });
  }

  if (hasCapstone && params.plan && params.plan.length > 0) {
    const sortedPlan = [...params.plan].sort((a, b) => a.sequence - b.sequence);
    const lastSemester = sortedPlan[sortedPlan.length - 1];
    const capstoneInPlan = params.plannedUnits.includes(CAPSTONE_CODE);

    if (capstoneInPlan) {
      const capstoneTerm = sortedPlan.find((term) => term.units.includes(CAPSTONE_CODE));
      if (capstoneTerm && capstoneTerm.sequence !== lastSemester.sequence) {
        issues.push({
          category: 'capstone',
          severity: 'fail',
          title: 'Capstone must be in the last semester',
          message: `${CAPSTONE_CODE} is planned in term ${capstoneTerm.sequence} but must be in the final semester (term ${lastSemester.sequence}). The capstone integrates all prior learning and must be taken last.`,
        });
      }
    }
  }

  // Rule: Students choose either CITS2002 or CITS2005.
  const hasCITS2002 = selectedUnits.has("CITS2002");
  const hasCITS2005 = selectedUnits.has("CITS2005");

  if (hasCITS2002 && hasCITS2005) {
    issues.push({
      category: "course-specific",
      severity: "fail",
      title: "Choose either CITS2002 or CITS2005",
      message: "Students should choose either CITS2002 or CITS2005, not both.",
    });
  }

  if (!hasCITS2002 && !hasCITS2005) {
    issues.push({
      category: "course-specific",
      severity: "warning",
      title: "Conversion unit choice missing",
      message: "Students may need to choose either CITS2002 or CITS2005.",
    });
  }

  // Capstone placement validation is above.  Now validate research project pairing.

  // Rule: CITS5014/5015 are a two-part research project. If either is selected, both must be.
  const has5014 = selectedUnits.has('CITS5014');
  const has5015 = selectedUnits.has('CITS5015');

  if (has5014 && !has5015) {
    issues.push({
      category: 'research-project',
      severity: 'fail',
      title: 'Research project incomplete',
      message: 'CITS5014 is selected but CITS5015 is missing. These are a two-part research project and BOTH must be included.',
    });
  }
  if (has5015 && !has5014) {
    issues.push({
      category: 'research-project',
      severity: 'fail',
      title: 'Research project incomplete',
      message: 'CITS5015 is selected but CITS5014 is missing. CITS5014 must be completed first.',
    });
  }

  // Rule: CITS5014 must be at least semester 3 (2 semesters of prior study required)
  if (has5014 && params.plan) {
    const sortedPlan = [...params.plan].sort((a, b) => a.sequence - b.sequence);
    const term5014 = sortedPlan.find(t => t.units.includes('CITS5014'));
    if (term5014 && term5014.sequence < 3) {
      issues.push({
        category: 'research-project',
        severity: 'fail',
        title: 'Research project too early',
        message: `CITS5014 is placed in semester ${term5014.sequence} but requires at least 2 semesters of prior study (semester 3 earliest).`,
      });
    }
  }

  // Rule: CITS5014 must be before CITS5015 (also enforced by prerequisite check)
  if (has5014 && has5015 && params.plan) {
    const sortedPlan = [...params.plan].sort((a, b) => a.sequence - b.sequence);
    const term5014 = sortedPlan.find(t => t.units.includes('CITS5014'));
    const term5015 = sortedPlan.find(t => t.units.includes('CITS5015'));
    if (term5014 && term5015 && term5014.sequence >= term5015.sequence) {
      issues.push({
        category: 'research-project',
        severity: 'fail',
        title: 'Research project order wrong',
        message: `CITS5014 (semester ${term5014.sequence}) must come before CITS5015 (semester ${term5015.sequence}).`,
      });
    }
  }

  // Rule: maximum two specialisations, excluding Applied Computing.
  const nonAppliedSpecialisations = params.selectedSpecialisations.filter(
    (specialisation) =>
      specialisation.trim().toLowerCase() !== "applied computing" &&
      specialisation.trim().toLowerCase() !== "sp_apcmp"
  );

  if (nonAppliedSpecialisations.length > 2) {
    issues.push({
      category: "specialisation",
      severity: "fail",
      title: "Too many specialisations selected",
      message:
        "Students may complete a maximum of two specialisations, excluding Applied Computing.",
    });
  }

  // Rule: Applied Computing students may complete only one specialisation.
  const hasAppliedComputing = params.selectedSpecialisations.some(
    (specialisation) =>
      specialisation.trim().toLowerCase() === "applied computing" ||
      specialisation.trim().toLowerCase() === "sp_apcmp"
  );

  if (hasAppliedComputing && params.selectedSpecialisations.length > 1) {
    issues.push({
      category: "specialisation",
      severity: "fail",
      title: "Applied Computing specialisation limit",
      message:
        "Students taking Applied Computing may complete only one specialisation.",
    });
  }

  // Removed: non-CITS validation — SVLG5001, INMT5518, PHIL4100, MGMT5504
  // are legitimate electives within the MIT course as per UWA Handbook.
  // Unit membership is validated by validateUnitMembership.

  return issues;
}

/**
 * Warn when planned units belong to specialisation groups that the student
 * has NOT selected. This catches AI-generated plans that include units from
 * other specialisation tracks (e.g. NLP/Deep Learning in a Software Systems plan).
 */
function validateSpecialisationMembership(params: {
  courseCode: string;
  selectedSpecialisations: string[];
  plannedUnits: string[];
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (params.courseCode !== "62510" || params.selectedSpecialisations.length === 0) {
    return issues;
  }

  const selectedGroupCodes = getSelectedSpecialisationGroupCodes(
    params.selectedSpecialisations,
    params.courseCode
  );

  const allSpecGroupCodes = ["SP_APCMP", "SP_ARTIN", "SP_SOFSY"];
  const unselectedSpecGroups = allSpecGroupCodes.filter(
    (code) => !selectedGroupCodes.has(code)
  );

  if (params.selectedSpecialisations.length === 1 && unselectedSpecGroups.length === 2) {
    const specName = params.selectedSpecialisations[0].trim();
    issues.push({
      category: "specialisation",
      severity: "warning",
      title: "Single specialisation plan",
      message: `You have selected only "${specName}". Consider removing units that are core to other specialisations (Applied Computing, Artificial Intelligence) unless they are required general electives.`,
    });
  }

  return issues;
}

function validateCourseSpecificRules(params: {
  courseCode: string;
  selectedSpecialisations: string[];
  completedUnits: string[];
  plannedUnits: string[];
  plan: PlannedTerm[];
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (params.courseCode === "62510") {
    issues.push(...validate62510Rules({
      selectedSpecialisations: params.selectedSpecialisations,
      completedUnits: params.completedUnits,
      plannedUnits: params.plannedUnits,
      plan: params.plan,
    }));
    issues.push(...validateSpecialisationMembership(params));
  }

  return issues;
}

function validateCoursePoints(params: {
  course: {
    min_points: number | null;
    max_points: number | null;
  };
  completedUnits: string[];
  plannedUnits: string[];
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const uniqueUnits = new Set([
    ...params.completedUnits,
    ...params.plannedUnits,
  ]);

  // Assumption: every unit is worth 6 points
  const totalPoints = uniqueUnits.size * 6;

  if (
    params.course.min_points !== null &&
    totalPoints < params.course.min_points
  ) {
    issues.push({
      category: "course-points",
      severity: "warning",
      title: "Minimum course points not met",
      message: `This plan currently contains ${totalPoints} points. The course requires at least ${params.course.min_points} points.`,
    });
  }

  if (
    params.course.max_points !== null &&
    totalPoints > params.course.max_points
  ) {
    issues.push({
      category: "course-points",
      severity: "fail",
      title: "Maximum course points exceeded",
      message: `This plan currently contains ${totalPoints} points. The maximum allowed is ${params.course.max_points} points.`,
    });
  }

  return issues;
}

function getTermOrder(term: "S1" | "S2"): number {
  if (term === "S1") return 1;
  return 2;
}

function validateTimeLimit(params: {
  course: {
    time_limit_years: number | null;
  };
  plan: PlannedTerm[];
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!params.course.time_limit_years || params.plan.length === 0) {
    return issues;
  }

  const sortedPlan = [...params.plan].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return getTermOrder(a.term) - getTermOrder(b.term);
  });

  const firstTerm = sortedPlan[0];
  const lastTerm = sortedPlan[sortedPlan.length - 1];

  const yearSpan = lastTerm.year - firstTerm.year + 1;

  if (yearSpan > params.course.time_limit_years) {
    issues.push({
      category: "time-limit",
      severity: "fail",
      title: "Course time limit exceeded",
      message: `This plan spans approximately ${yearSpan} years, but the course time limit is ${params.course.time_limit_years} years.`,
    });
  }

  return issues;
}

export async function validatePlan(
  payload: ValidatePlanRequest
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];

  const shapeIssues = validateRequestShape(payload);
  issues.push(...shapeIssues);

  if (shapeIssues.some((issue) => issue.severity === "fail")) {
    return {
      overallStatus: getOverallStatus(issues),
      issues,
    };
  }

  const course = await fetchCourseByCode(payload.courseCode);

  if (!course) {
    issues.push({
      category: "course",
      severity: "fail",
      title: "Course not found",
      message: `Course ${payload.courseCode} could not be found.`,
    });

    return {
      overallStatus: getOverallStatus(issues),
      issues,
    };
  }

  const courseUnits = await fetchUnitsForCourse(payload.courseCode);
  const courseUnitCodes = new Set(courseUnits.map((unit) => unit.code));
  const unitByCode = new Map(courseUnits.map((unit) => [unit.code, unit]));

  const plannedUnits = flattenPlannedUnits(payload.plan);

  issues.push(
    ...validateUnitMembership({
      completedUnits: payload.completedUnits,
      plannedUnits,
      courseUnitCodes,
    })
  );

  issues.push(
    ...validateDuplicateUnits({
      completedUnits: payload.completedUnits,
      plannedUnits,
    })
  );

  issues.push(...validateSemesterUnitLoad(payload.plan));

  issues.push(
    ...validateAvailability({
      plan: payload.plan,
      unitByCode,
    })
  );

  issues.push(
    ...validatePrerequisites({
      plan: payload.plan,
      completedUnits: payload.completedUnits,
      unitByCode,
    })
  );

  issues.push(
    ...validateCorequisites({
      plan: payload.plan,
      completedUnits: payload.completedUnits,
      unitByCode,
    })
  );

  issues.push(
    ...validateIncompatibilities({
      plan: payload.plan,
      completedUnits: payload.completedUnits,
      unitByCode,
    })
  );

  issues.push(
    ...(await validateGroupRules({
      courseCode: payload.courseCode,
      selectedSpecialisations: payload.selectedSpecialisations,
      completedUnits: payload.completedUnits,
      plannedUnits,
    }))
  );

  issues.push(
    ...validateCourseSpecificRules({
      courseCode: payload.courseCode,
      selectedSpecialisations: payload.selectedSpecialisations,
      completedUnits: payload.completedUnits,
      plannedUnits,
      plan: payload.plan,
    })
  );

  issues.push(
    ...validateCoursePoints({
      course,
      completedUnits: payload.completedUnits,
      plannedUnits,
    })
  );

  issues.push(
    ...validateTimeLimit({
      course,
      plan: payload.plan,
    })
  );

  if (issues.length === 0) {
    issues.push({
      category: "validation",
      severity: "pass",
      title: "Basic validation passed",
      message: `All submitted units belong to ${course.title}, and no duplicates were found.`,
    });
  }

  return {
    overallStatus: getOverallStatus(issues),
    issues,
  };
}