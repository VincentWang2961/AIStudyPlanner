/**
 * Re-parse prerequisites_parsed from cleaned prerequisites_raw.
 * Run: npx ts-node src/scripts/reparsePrerequisites.ts
 */
import { prisma } from '../config/prisma';
import { parseRule } from '../services/parser/ruleParser';

async function main() {
  const units = await prisma.units.findMany({
    where: { prerequisites_raw: { not: null } },
    select: { code: true, prerequisites_raw: true },
  });

  console.log(`Found ${units.length} units with prerequisites_raw`);

  let updated = 0;
  for (const unit of units) {
    const parsed = parseRule(unit.prerequisites_raw, { courseCode: '62510' });
    const jsonValue = parsed ? JSON.stringify(parsed) : null;

    await prisma.units.update({
      where: { code: unit.code },
      data: { prerequisites_parsed: jsonValue ? JSON.parse(jsonValue) : null },
    });
    updated++;
  }

  console.log(`Updated ${updated} units`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
