export const PROGRAMMING_BASED_UNITS = new Set<string>([
  // Conversion / early MIT units
  "CITS1003",
  "CITS1401",
  "CITS1402",
  "CITS2002",
  "CITS2005",

  // MIT units excluding CITS4401, CITS5501, PHIL4100
  "CITS4009",
  "CITS4012",
  "CITS4403",
  "CITS4404",
  "CITS4407",
  "CITS5014",
  "CITS5015",
  "CITS5017",
  "CITS5206",
  "CITS5503",
  "CITS5504",
  "CITS5505",
  "CITS5506",
  "CITS5507",
  "CITS5508",

  // Non-CITS technical MIT units
  "AUTO4508",
  "INMT5526",
]);

export function isProgrammingBasedUnit(unitCode: string): boolean {
  return PROGRAMMING_BASED_UNITS.has(unitCode);
}