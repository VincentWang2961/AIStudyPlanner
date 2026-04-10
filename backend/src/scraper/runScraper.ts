import { scrapeCourses } from "./handbookScraper";
import fs from "fs";
import path from "path";

async function run() {
  try {
    const courses = ["62510"];
    // const courses = ["41680", "62510", "BP059"];

    console.log("Starting scraper...");

    const data = await scrapeCourses(courses);

    const dataDir = path.join(__dirname, "../../data");
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
    
    const outputPath = path.join(__dirname, "../../data/courses.json");
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

    console.log("Scraping complete. Data saved.");
  } catch (error) {
    console.error("Error during scraping: ", error);
  }
} 

run();