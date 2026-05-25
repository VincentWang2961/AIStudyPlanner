export type RuleNode =
  | { type: "UNIT"; code: string }
  | {
      type: "POINTS";
      value: number;
      constraints?: {
        prefixes?: string[];
        levels?: number[];
        category?: string;
        scope?: string;
      };
    }
  | {
      type: "WAM";
      minimum: number;
      scope?: {
        prefixes?: string[];
        levels?: number[];
        scope?: string;
      };
    }
  | { type: "AND"; children: RuleNode[] }
  | { type: "OR"; children: RuleNode[] };

type ParseOptions = {
  courseCode?: string;
};

type ParseResult =
  | RuleNode
  | { type: "__SATISFIED__" }
  | null;

function isRuleNode(node: ParseResult): node is RuleNode {
  return !!node && node.type !== "__SATISFIED__";
}

function normalizeText(text: string): string {
  return text
    .replace(/\r/g, " ")
    .replace(/\n/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNil(text: string | null | undefined): boolean {
  if (!text) return true;
  const clean = normalizeText(text).toLowerCase();
  return clean === "nil" || clean === "nil." || clean === "none" || clean === "none.";
}

function stripOuterParens(text: string): string {
  let s = text.trim();

  while (s.startsWith("(") && s.endsWith(")")) {
    let depth = 0;
    let enclosesWholeString = true;

    for (let i = 0; i < s.length; i++) {
      if (s[i] === "(") depth++;
      else if (s[i] === ")") depth--;

      if (depth === 0 && i < s.length - 1) {
        enclosesWholeString = false;
        break;
      }
    }

    if (!enclosesWholeString) break;
    s = s.slice(1, -1).trim();
  }

  return s;
}

function uniqRuleNodes(nodes: RuleNode[]): RuleNode[] {
  const seen = new Set<string>();
  const result: RuleNode[] = [];

  for (const node of nodes) {
    const key = JSON.stringify(node);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(node);
    }
  }

  return result;
}

function simplifyRuleNode(node: RuleNode): RuleNode {
  if (
    node.type === "UNIT" ||
    node.type === "POINTS" ||
    node.type === "WAM"
  ) {
    return node;
  }

  // From here, node is guaranteed to be AND or OR
  const simplifiedChildren = node.children.map(simplifyRuleNode);

  const flatChildren: RuleNode[] = [];
  for (const child of simplifiedChildren) {
    if (child.type === node.type) {
      flatChildren.push(...child.children);
    } else {
      flatChildren.push(child);
    }
  }

  const uniqueChildren = uniqRuleNodes(flatChildren);

  if (uniqueChildren.length === 1) {
    return uniqueChildren[0];
  }

  if (node.type === "AND") {
    return {
      type: "AND",
      children: uniqueChildren,
    };
  }

  return {
    type: "OR",
    children: uniqueChildren,
  };
}

function splitTopLevelByWord(text: string, operator: "or" | "and"): string[] {
  const result: string[] = [];
  let depth = 0;
  let start = 0;
  const lower = text.toLowerCase();

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === "(") {
      depth++;
      continue;
    }

    if (ch === ")") {
      depth--;
      continue;
    }

    if (depth !== 0) continue;

    const beforeOk = i === 0 || /\s|\(/.test(text[i - 1]);
    const afterIndex = i + operator.length;
    const word = lower.slice(i, afterIndex);
    const afterOk = afterIndex >= text.length || /\s|\)/.test(text[afterIndex]);

    if (beforeOk && afterOk && word === operator) {
      const part = text.slice(start, i).trim();
      if (part) result.push(part);
      start = afterIndex;
    }
  }

  const last = text.slice(start).trim();
  if (last) result.push(last);

  return result;
}

function findMatchingParen(text: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") depth--;
    if (depth === 0) return i;
  }
  return -1;
}

function removeFillerPhrases(text: string): string {
  return text
    .replace(/\bSuccessful completion of\b/gi, "")
    .replace(/\bor equivalent\b/gi, "")
    .replace(/\bequivalent\b/gi, "")
    .replace(/\bthe following units\b/gi, "")
    .replace(/\bthe vast majority of students\s*-\s*no prerequistes\b/gi, "")
    .replace(/\bthe vast majority of students\s*-\s*no prerequisites\b/gi, "")
    .replace(/\bno prerequistes\b/gi, "")
    .replace(/\bno prerequisites\b/gi, "")
    // Remove historical code references like "(formerly MGMT8502 Accounting)"
    .replace(/\(\s*formerly\s+[A-Z]{4}\d{4}[^)]*\)/gi, "")
    .replace(/\bformerly\s+[A-Z]{4}\d{4}\b[^;,.)]*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPrefixes(text: string): string[] | undefined {
  const matches = Array.from(
    text.matchAll(/\b([A-Z]{4})(?=\/|\s+units|\b)/g)
  ).map((m) => m[1]);

  const unique = Array.from(new Set(matches));
  return unique.length > 0 ? unique : undefined;
}

function extractLevels(text: string): number[] | undefined {
  const levels = new Set<number>();

  for (const match of text.matchAll(/\blevel\s+(\d)(?:\s*\/\s*(\d))?/gi)) {
    levels.add(Number(match[1]));
    if (match[2]) levels.add(Number(match[2]));
  }

  const arr = Array.from(levels).sort();
  return arr.length > 0 ? arr : undefined;
}

function extractPointsConstraintMetadata(text: string): {
  prefixes?: string[];
  levels?: number[];
  category?: string;
  scope?: string;
} | undefined {
  const clean = normalizeText(text);

  const prefixes = extractPrefixes(clean);
  const levels = extractLevels(clean);

  let category: string | undefined;

  if (/programming-based units/i.test(clean)) {
    category = "programming-based";
  }

  let scope: string | undefined;
  if (/all completed/i.test(clean)) {
    scope = "ALL completed units";
  }

  if (!prefixes && !levels && !category && !scope) return undefined;

  return {
    ...(prefixes ? { prefixes } : {}),
    ...(levels ? { levels } : {}),
    ...(category ? { category } : {}),
    ...(scope ? { scope } : {}),
  };
}

function extractWamNode(text: string): RuleNode | null {
  const clean = normalizeText(text);
  const wamMatch = clean.match(/WAM\)?\s+of\s+at\s+least\s+(\d+)\s+percent/i);

  if (!wamMatch) return null;

  const minimum = Number(wamMatch[1]);
  const metadata = extractPointsConstraintMetadata(clean);

  return {
    type: "WAM",
    minimum,
    scope: metadata
      ? {
          ...(metadata.prefixes ? { prefixes: metadata.prefixes } : {}),
          ...(metadata.levels ? { levels: metadata.levels } : {}),
          ...(metadata.scope ? { scope: metadata.scope } : {}),
        }
      : undefined,
  };
}

function branchMentionsCourse(text: string, courseCode?: string): boolean {
  if (!courseCode) return false;
  return new RegExp(`\\b${courseCode}\\b`).test(text);
}

function extractRequirementAttachedToCurrentCourse(
  text: string,
  courseCode?: string
): string | null {
  if (!courseCode) return null;

  const clean = stripOuterParens(normalizeText(text));
  const andParts = splitTopLevelByWord(clean, "and");

  if (andParts.length <= 1) return null;

  const left = andParts[0];
  const right = andParts.slice(1).join(" and ").trim();

  // If the left side is an enrolment group that includes the current course,
  // then the right side is the actual requirement we should keep.
  if (/enrolment in/i.test(left) && branchMentionsCourse(left, courseCode)) {
    return right || null;
  }

  return null;
}

function isSatisfiedEnrollmentBranch(text: string, courseCode?: string): boolean {
  const clean = normalizeText(text);

  if (!courseCode) return false;
  if (!/enrolment in/i.test(clean)) return false;
  if (!branchMentionsCourse(clean, courseCode)) return false;

  const unitCodes = clean.match(/[A-Z]{4}\d{4}/g) ?? [];
  const points = clean.match(/\d+\s+points/gi) ?? [];

  return unitCodes.length === 0 && points.length === 0;
}

function preprocessForCourse(text: string, courseCode?: string): string {
  if (!courseCode) return normalizeText(text);

  let s = normalizeText(text);

  // Remove: Enrolment in ( ...<courseCode>... ) and
  let changed = true;
  while (changed) {
    changed = false;
    const idx = s.search(/Enrolment in\s*\(/i);
    if (idx !== -1) {
      const parenStart = s.indexOf("(", idx);
      const parenEnd = findMatchingParen(s, parenStart);
      if (parenEnd !== -1) {
        const clause = s.slice(idx, parenEnd + 1);
        if (branchMentionsCourse(clause, courseCode)) {
          const after = s.slice(parenEnd + 1);
          const andMatch = after.match(/^\s*and\s*/i);
          if (andMatch) {
            s = s.slice(0, idx) + after.slice(andMatch[0].length);
            changed = true;
          }
        }
      }
    }
  }

  // Remove: Enrolment in <courseCode> ... and
  const codePattern = new RegExp(`\\bEnrolment in\\s+${courseCode}\\b[^()]*?\\band\\s*`, "gi");
  s = s.replace(codePattern, "");

  s = removeFillerPhrases(s);

  s = s.replace(/\(\s*(or|and)\s+/gi, "(");
  s = s.replace(/\s+(or|and)\s*\)/gi, ")");
  s = s.replace(/^\s*(or|and)\s+/gi, "");
  s = s.replace(/\s+(or|and)\s*$/gi, "");
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

function parseAtom(text: string, options?: ParseOptions): ParseResult {
  const clean = stripOuterParens(normalizeText(text));
  if (!clean || isNil(clean)) return null;

  if (isSatisfiedEnrollmentBranch(clean, options?.courseCode)) {
    return { type: "__SATISFIED__" };
  }

  const unitCodes = Array.from(new Set(clean.match(/[A-Z]{4}\d{4}/g) ?? []));

  const wordToNumber: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };

  let pointsMatches = Array.from(clean.matchAll(/(\d+)\s+points/gi)).map((m) =>
    Number(m[1])
  );

  const unitCountMatches = [
    ...Array.from(clean.matchAll(/(\d+)\s+units/gi)).map((m) => Number(m[1])),
    ...Array.from(
      clean.matchAll(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+units/gi)
    ).map((m) => wordToNumber[m[1].toLowerCase()]),
  ];

  for (const count of unitCountMatches) {
    pointsMatches.push(count * 6);
  }

  const wamNode = extractWamNode(clean);

  // If this atom explicitly mentions enrolment but not the current course, ignore it.
  if (
    options?.courseCode &&
    /enrolment in/i.test(clean) &&
    !branchMentionsCourse(clean, options.courseCode)
  ) {
    pointsMatches = [];
    if (unitCodes.length === 0) return null;
    return null;
  }

  const nodes: RuleNode[] = [];

  for (const code of unitCodes) {
    nodes.push({ type: "UNIT", code });
  }

  for (const value of pointsMatches) {
    nodes.push({
      type: "POINTS",
      value,
      constraints: extractPointsConstraintMetadata(clean),
    });
  }

  if (wamNode) {
    nodes.push(wamNode);
  }

  if (nodes.length === 0) return null;
  if (nodes.length === 1) return nodes[0];

  if (/\bor\b/i.test(clean) && !/\band\b/i.test(clean)) {
    return simplifyRuleNode({
      type: "OR",
      children: uniqRuleNodes(nodes),
    });
  }

  return simplifyRuleNode({
    type: "AND",
    children: uniqRuleNodes(nodes),
  });
}

function parseExpression(text: string, options?: ParseOptions): ParseResult {
  let clean = normalizeText(text);
  clean = stripOuterParens(clean);
  clean = removeFillerPhrases(clean);
  clean = stripOuterParens(clean);

  if (!clean || isNil(clean)) return null;

  // New rule:
  // if a branch is "Enrolment in ... <current course> ... and X",
  // then keep only X.
  const attachedRequirement = extractRequirementAttachedToCurrentCourse(
    clean,
    options?.courseCode
  );

  if (attachedRequirement) {
    return parseExpression(attachedRequirement, options);
  }

  const orParts = splitTopLevelByWord(clean, "or");

  if (orParts.length > 1) {
    if (options?.courseCode) {
      const hasSatisfiedEnrollmentBranch = orParts.some((part) =>
        isSatisfiedEnrollmentBranch(part, options.courseCode)
      );

      if (hasSatisfiedEnrollmentBranch) {
        return { type: "__SATISFIED__" };
      }
      
      const matchingCourseBranches = orParts.filter((part) =>
        branchMentionsCourse(part, options.courseCode)
      );

      if (matchingCourseBranches.length > 0) {
        const children: RuleNode[] = [];

        for (const part of matchingCourseBranches) {
          const parsed = parseExpression(part, options);

          if (parsed && parsed.type === "__SATISFIED__") {
            return { type: "__SATISFIED__" };
          }

          if (isRuleNode(parsed)) {
            children.push(parsed);
          }
        }

        if (children.length === 0) return null;
        if (children.length === 1) return simplifyRuleNode(children[0]);

        return simplifyRuleNode({
          type: "OR",
          children,
        });
      }

      const nonEnrollmentBranches = orParts.filter(
        (part) => !/enrolment in/i.test(part)
      );

      if (nonEnrollmentBranches.length > 0) {
        const children: RuleNode[] = [];

        for (const part of nonEnrollmentBranches) {
          const parsed = parseExpression(part, options);

          if (parsed && parsed.type === "__SATISFIED__") {
            return { type: "__SATISFIED__" };
          }

          if (isRuleNode(parsed)) {
            children.push(parsed);
          }
        }

        if (children.length === 0) return null;
        if (children.length === 1) return simplifyRuleNode(children[0]);

        return simplifyRuleNode({
          type: "OR",
          children,
        });
      }

      return null;
    }

    const children: RuleNode[] = [];

    for (const part of orParts) {
      const parsed = parseExpression(part, options);

      if (parsed && parsed.type === "__SATISFIED__") {
        return { type: "__SATISFIED__" };
      }

      if (isRuleNode(parsed)) {
        children.push(parsed);
      }
    }

    if (children.length === 0) return null;
    if (children.length === 1) return simplifyRuleNode(children[0]);

    return simplifyRuleNode({
      type: "OR",
      children,
    });
  }

  if (options?.courseCode) {
    clean = preprocessForCourse(clean, options.courseCode);
    clean = stripOuterParens(clean);

    if (!clean || isNil(clean)) return null;

    const courseOrParts = splitTopLevelByWord(clean, "or");
    if (courseOrParts.length > 1) {
      const children: RuleNode[] = [];

      for (const part of courseOrParts) {
        const parsed = parseExpression(part, options);

        if (parsed && parsed.type === "__SATISFIED__") {
          return { type: "__SATISFIED__" };
        }

        if (isRuleNode(parsed)) {
          children.push(parsed);
        }
      }

      if (children.length === 0) return null;
      if (children.length === 1) return simplifyRuleNode(children[0]);

      return simplifyRuleNode({
        type: "OR",
        children,
      });
    }
  }

  const andParts = splitTopLevelByWord(clean, "and");
  if (andParts.length > 1) {
    const children: RuleNode[] = [];

    for (const part of andParts) {
      const parsed = parseExpression(part, options);

      if (parsed && parsed.type === "__SATISFIED__") {
        continue;
      }

      if (isRuleNode(parsed)) {
        children.push(parsed);
      }
    }

    if (children.length === 0) return null;
    if (children.length === 1) return simplifyRuleNode(children[0]);

    return simplifyRuleNode({
      type: "AND",
      children,
    });
  }

  return parseAtom(clean, options);
}

export function parseRule(
  text: string | null,
  options?: ParseOptions
): RuleNode | null {
  if (!text || isNil(text)) return null;

  const clean = normalizeText(text);
  const parsed = parseExpression(clean, options);

  if (!parsed) return null;
  if (parsed.type === "__SATISFIED__") return null;

  return simplifyRuleNode(parsed);
}