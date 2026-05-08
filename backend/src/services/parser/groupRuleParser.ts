export type GroupRuleNode =
  | {
      type: "TAKE_ALL_FROM_GROUP";
      group: string;
    }
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
  | {
      type: "CHOOSE_ONE_OF";
      options: string[];
    }
  | {
      type: "AND";
      children: GroupRuleNode[];
    }
  | {
      type: "TEXT";
      value: string;
    };

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
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

function parseNumber(text: string): number | null {
  const match = text.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function parse62510Rule(groupCode: string, ruleText: string): GroupRuleNode {
  const clean = normalizeText(ruleText);

  if (/Take all units/i.test(clean)) {
    return {
      type: "TAKE_ALL_FROM_GROUP",
      group: groupCode,
    };
  }

  if (
    groupCode === "GROUP_A" &&
    /at least 6 points/i.test(clean)
  ) {
    return {
      type: "POINTS_FROM_GROUP",
      group: "GROUP_A",
      value: 6,
      mode: "MIN",
    };
  }

  if (
    groupCode === "GROUP_B" &&
    /including at least 6 points of level 5/i.test(clean)
    ) {
        return {
            type: "POINTS_FROM_GROUP",
            group: "GROUP_B",
            value: 6,
            mode: "MIN",
            constraints: {
            levels: [5],
            },
        };
    }

  if (
    groupCode === "GROUP_C" &&
    /at most 12 points/i.test(clean)
  ) {
    return {
      type: "POINTS_FROM_GROUP",
      group: "GROUP_C",
      value: 12,
      mode: "MAX",
    };
  }

  if (
    ["GROUP_A", "GROUP_B", "GROUP_C"].includes(groupCode) &&
    /total of 24 points from groups A, B and C/i.test(clean)
  ) {
    const base: GroupRuleNode =
  groupCode === "GROUP_A"
    ? {
        type: "POINTS_FROM_GROUP",
        group: "GROUP_A",
        value: 6,
        mode: "MIN",
      }
    : groupCode === "GROUP_B"
    ? {
        type: "POINTS_FROM_GROUP",
        group: "GROUP_B",
        value: 6,
        mode: "MIN",
        constraints: {
          levels: [5],
        },
      }
    : {
        type: "POINTS_FROM_GROUP",
        group: "GROUP_C",
        value: 12,
        mode: "MAX",
      };

    return {
      type: "AND",
      children: [
        base,
        {
          type: "POINTS_TOTAL_FROM_GROUP_SET",
          groups: ["GROUP_A", "GROUP_B", "GROUP_C"],
          value: 24,
          mode: "EXACT",
        },
      ],
    };
  }

  if (
    groupCode === "SP_APCMP" &&
    /24 points/i.test(clean) &&
    /12 points of level 5/i.test(clean)
  ) {
    return {
      type: "AND",
      children: [
        {
          type: "POINTS_FROM_GROUP",
          group: "SP_APCMP",
          value: 24,
          mode: "EXACT",
        },
        {
          type: "POINTS_FROM_GROUP",
          group: "SP_APCMP",
          value: 12,
          mode: "MIN",
          constraints: { levels: [5] },
        },
      ],
    };
  }

  if (["SP_ARTIN", "SP_SOFSY", "CORE"].includes(groupCode) && /Take all units/i.test(clean)) {
    return {
      type: "TAKE_ALL_FROM_GROUP",
      group: groupCode,
    };
  }

  return {
    type: "TEXT",
    value: clean,
  };
}

function parse41680Rule(groupCode: string, ruleText: string): GroupRuleNode {
  const clean = normalizeText(ruleText);

  const commerceSpecialisationGroups = [
    "GROUP_A",
    "GROUP_B",
    "GROUP_C",
    "GROUP_D",
    "GROUP_E",
    "GROUP_F",
    "GROUP_G",
    "GROUP_H",
    "GROUP_I",
  ];

  if (groupCode === "CORE" && /Take all units \(12 points\)/i.test(clean)) {
    return {
      type: "TAKE_ALL_FROM_GROUP",
      group: "CORE",
    };
  }

  if (groupCode === "GROUP_1" && /up to the value of 12 points/i.test(clean)) {
    return {
      type: "POINTS_FROM_GROUP",
      group: "GROUP_1",
      value: 12,
      mode: "MAX",
    };
  }

  if (groupCode === "GROUP_2" && /value of 6 points/i.test(clean)) {
    return {
      type: "POINTS_FROM_GROUP",
      group: "GROUP_2",
      value: 6,
      mode: "EXACT",
    };
  }

  if (groupCode === "GROUP_3" && /0-6 points/i.test(clean)) {
    return {
      type: "POINTS_FROM_GROUP",
      group: "GROUP_3",
      value: 6,
      mode: "MAX",
    };
  }

  if (groupCode === "SP_FINCE_CORE" && /Take all units \(12 points\)/i.test(clean)) {
    return {
      type: "TAKE_ALL_FROM_GROUP",
      group: "SP_FINCE_CORE",
    };
  }

  if (groupCode === "SP_MGMNT_CORE" && /Take all units \(12 points\)/i.test(clean)) {
    return {
      type: "TAKE_ALL_FROM_GROUP",
      group: "SP_MGMNT_CORE",
    };
  }

  // Standard 24-point Master of Commerce specialisation groups:
  // A Accounting, B BILM, C Employment Relations, E HRM, F Marketing, G Economics.
  if (["GROUP_A", "GROUP_B", "GROUP_C", "GROUP_E", "GROUP_F", "GROUP_G"].includes(groupCode)) {
    return {
      type: "AND",
      children: [
        {
          type: "POINTS_FROM_GROUP",
          group: groupCode,
          value: 24,
          mode: "MIN",
        },
        {
          type: "POINTS_TOTAL_FROM_GROUP_SET",
          groups: commerceSpecialisationGroups,
          value: 48,
          mode: "MIN",
        },
      ],
    };
  }

  // Finance and Management have 12-point cores plus 12-point lettered groups.
  // Their lettered groups only need 36 total points because 12 points come from core.
  if (["GROUP_D", "GROUP_H"].includes(groupCode)) {
    return {
      type: "AND",
      children: [
        {
          type: "POINTS_FROM_GROUP",
          group: groupCode,
          value: 12,
          mode: "MIN",
        },
        {
          type: "POINTS_TOTAL_FROM_GROUP_SET",
          groups: commerceSpecialisationGroups,
          value: 36,
          mode: "MIN",
        },
      ],
    };
  }

  return {
    type: "TEXT",
    value: clean,
  };
}

export function parseGroupRule(
  courseCode: string | null,
  groupCode: string,
  ruleText: string
): GroupRuleNode | null {
  if (!courseCode || !ruleText) return null;

  if (courseCode === "62510") {
    return parse62510Rule(groupCode, ruleText);
  }

  if (courseCode === "41680") {
    return parse41680Rule(groupCode, ruleText);
  }

  return {
    type: "TEXT",
    value: normalizeText(ruleText),
  };
}