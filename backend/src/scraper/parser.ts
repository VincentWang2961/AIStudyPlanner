import cheerio from "cheerio";

export function parseUnitPage(html: string) {

  const $ = cheerio.load(html);

  const code = $(".unit-code").text().trim();
  const title = $("h1").text().trim();
  const description = $(".unit-description").text().trim();

  const prerequisitesText = $(".prerequisites").text();

  const prerequisites = prerequisitesText
    .split(",")
    .map(p => p.trim())
    .filter(Boolean);

  const offeredInText = $(".availability").text();

  const offeredIn = [];

  if (offeredInText.includes("Semester 1")) offeredIn.push(1);
  if (offeredInText.includes("Semester 2")) offeredIn.push(2);

  return {
    code,
    title,
    description,
    prerequisites,
    offeredIn
  };
}