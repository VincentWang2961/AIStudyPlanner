import axios from "axios";
import { parseCoursePage } from "./parser";

const COURSE_URL = "https://www.handbooks.uwa.edu.au/coursedetails?code=";
const MAJOR_URL = "https://www.handbooks.uwa.edu.au/majordetails?code=";

// Map undergraduate courses to their major codes
const MAJOR_MAP: Record<string, string> = {
  "BP059": "MJD-EMATH"
};

export async function scrapeCourses(courseCodes: string[]) {
  const results = [];

  for (const code of courseCodes) {
    try {
      console.log(`Scraping course ${code}`);

      let url: string;

      // Check if this course uses a major page
      if (MAJOR_MAP[code]) {
        url = `${MAJOR_URL}${MAJOR_MAP[code]}`;
      } else {
        url = `${COURSE_URL}${code}`;
      }

      const response = await axios.get(url);

      const parsed = parseCoursePage(response.data, code);

      results.push(parsed);

    } catch (err) {
      console.error(`Failed to scrape ${code}`, err);
    }
  }

  return results;
}