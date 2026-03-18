import axios from "axios";
import { parseUnitPage } from "./parser";

const UNIT_URLS = [
  "https://handbooks.uwa.edu.au/unitdetails?code=CITS5505",
  "https://handbooks.uwa.edu.au/unitdetails?code=CITS5503",
  "https://handbooks.uwa.edu.au/unitdetails?code=CITS4403"
];

export async function scrapeHandbook() {

  const units: any[] = [];

  for (const url of UNIT_URLS) {
    try {

      console.log(`Scraping ${url}`);

      const response = await axios.get(url);

      const unit = parseUnitPage(response.data);

      units.push(unit);

    } catch (error) {
      console.error(`Failed to scrape ${url}`);
    }
  }

  return units;
}