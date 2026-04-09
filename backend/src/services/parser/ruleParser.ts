export type RuleNode =
  | { type: "UNIT"; code: string }
  | { type: "POINTS"; value: number }
  | { type: "AND"; children: RuleNode[] }
  | { type: "OR"; children: RuleNode[] };

type ParseOptions = {
  courseCode?: string;
};

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
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * For 62510:
 * - remove "Enrolment in 62510 ... and" wrappers because they are satisfied
 * - remove branches tied to other courses/pathways
 * - remove dangling points-only engineering branches
 */
function preprocessForMIT(text: string): string {
  let s = normalizeText(text);

  // Remove: Enrolment in ( ...62510... ) and
  let changed = true;
  while (changed) {
    changed = false;
    const idx = s.search(/Enrolment in\s*\(/i);
    if (idx !== -1) {
      const parenStart = s.indexOf("(", idx);
      const parenEnd = findMatchingParen(s, parenStart);
      if (parenEnd !== -1) {
        const clause = s.slice(idx, parenEnd + 1);
        if (/\b62510\b/.test(clause)) {
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

  // Remove: Enrolment in 62510 ... and
  s = s.replace(/\bEnrolment in\s+62510\b[^()]*?\band\b\s*/gi, "");

  // Remove branches for other course pathways
  s = s.replace(/\s+or\s+\(?\s*Enrolment in\b(?![^()]*\b62510\b)[^()]*?(?=(\s+or\s+|\s+and\s+|\)|$))/gi, "");
  s = s.replace(/^\(?\s*Enrolment in\b(?![^()]*\b62510\b)[^()]*?(?:\s+or\s+)?/gi, "");

  // Remove specific known non-62510 branches
  s = s.replace(/\s+or\s+\(?\s*62550 Master of Professional Engineering\b[^()]*\)?/gi, "");
  s = s.replace(/\s+or\s+\(?\s*BH008 Bachelor of Advanced Computer Science\b[^()]*\)?/gi, "");
  s = s.replace(/\s+or\s+\(?\s*42630 Master of Business Analytics\b[^()]*\)?/gi, "");
  s = s.replace(/\s+or\s+\(?\s*62530 Master of Data Science\b[^()]*\)?/gi, "");
  s = s.replace(/\s+or\s+\(?\s*HON-CMSSE\b[^()]*\)?/gi, "");
  s = s.replace(/\s+or\s+\(?\s*MJD-[A-Z]+\b[^()]*\)?/gi, "");

  // Remove bachelor engineering style branches with points that don't apply to 62510
  s = s.replace(
    /\s+or\s+\(?\s*(Enrolment in\s+)?Bachelor of Engineering \(Honours\)[^()]*?(?:\d+\s+points[^()]*)+\)?/gi,
    ""
  );
  s = s.replace(
    /\s+or\s+\(?\s*an associated Combined Degree[^()]*?(?:\d+\s+points[^()]*)+\)?/gi,
    ""
  );

  s = removeFillerPhrases(s);

  // Cleanup dangling operators
  s = s.replace(/\(\s*(or|and)\s+/gi, "(");
  s = s.replace(/\s+(or|and)\s*\)/gi, ")");
  s = s.replace(/^\s*(or|and)\s+/gi, "");
  s = s.replace(/\s+(or|and)\s*$/gi, "");
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

function parseAtom(text: string, options?: ParseOptions): RuleNode | null {
  const clean = stripOuterParens(normalizeText(text));
  if (!clean || isNil(clean)) return null;

  const unitCodes = Array.from(new Set(clean.match(/[A-Z]{4}\d{4}/g) ?? []));

  let pointsMatches = Array.from(clean.matchAll(/(\d+)\s+points/gi)).map((m) =>
    Number(m[1])
  );

  // IMPORTANT:
  // For 62510, if this atom still looks like a non-62510 pathway, drop its points.
  if (options?.courseCode === "62510") {
    const lower = clean.toLowerCase();
    const looksNon62510Path =
      /bachelor of engineering \(honours\)/i.test(clean) ||
      /associated combined degree/i.test(clean) ||
      (/enrolment in/i.test(clean) && !/\b62510\b/.test(clean));

    if (looksNon62510Path) {
      pointsMatches = [];
    }
  }

  const nodes: RuleNode[] = [];

  for (const code of unitCodes) {
    nodes.push({ type: "UNIT", code });
  }

  for (const value of pointsMatches) {
    nodes.push({ type: "POINTS", value });
  }

  if (nodes.length === 0) return null;
  if (nodes.length === 1) return nodes[0];

  if (/\bor\b/i.test(clean) && !/\band\b/i.test(clean)) {
    return {
      type: "OR",
      children: uniqRuleNodes(nodes),
    };
  }

  return {
    type: "AND",
    children: uniqRuleNodes(nodes),
  };
}

function parseExpression(text: string, options?: ParseOptions): RuleNode | null {
  let clean = normalizeText(text);

  if (options?.courseCode === "62510") {
    clean = preprocessForMIT(clean);
  }

  clean = stripOuterParens(clean);

  if (!clean || isNil(clean)) return null;

  const orParts = splitTopLevelByWord(clean, "or");
  if (orParts.length > 1) {
    const children = orParts
      .map((part) => parseExpression(part, options))
      .filter(Boolean) as RuleNode[];

    if (children.length === 0) return null;
    if (children.length === 1) return children[0];

    return {
      type: "OR",
      children: uniqRuleNodes(children),
    };
  }

  const andParts = splitTopLevelByWord(clean, "and");
  if (andParts.length > 1) {
    const children = andParts
      .map((part) => parseExpression(part, options))
      .filter(Boolean) as RuleNode[];

    if (children.length === 0) return null;
    if (children.length === 1) return children[0];

    return {
      type: "AND",
      children: uniqRuleNodes(children),
    };
  }

  return parseAtom(clean, options);
}

export function parseRule(
  text: string | null,
  options?: ParseOptions
): RuleNode | null {
  if (!text || isNil(text)) return null;
  return parseExpression(text, options);
}