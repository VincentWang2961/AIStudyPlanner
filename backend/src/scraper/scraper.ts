import { scrapeHandbook } from "./handbookScraper";
import fs from "fs";
import path from "path";

async function runScraper() {
  try {
    console.log("Starting handbook scrape...");

    const units = await scrapeHandbook();

    const outputPath = path.join(process.cwd(), "data", "scrapedUnits.json");
    const outputDir = path.dirname(outputPath);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(units, null, 2));

    console.log(`Scraped ${units.length} units`);
    console.log("Data saved to scrapedUnits.json");

  } catch (error) {
    console.error("Scraper failed:", error);
  }
}

runScraper();