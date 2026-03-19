import cron from "node-cron";
import { scrapeHandbook } from "./handbookScraper";

export function startScraperScheduler() {

  cron.schedule("0 0 1 2,7 *", async () => {

    console.log("Running semester scraper...");

    await scrapeHandbook();

  });

}