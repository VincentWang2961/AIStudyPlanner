import * as path from "path";
import * as fs from "fs";
import { parseExcel } from "../services/parser/excelParser";
import { parsePDF } from "../services/parser/pdfParser";
import { pool } from "../config/db";
import { upsertCatalog } from "../services/parser/catalogRepository";

async function run() {
  const base = path.resolve("data");

  const files = {
    mit_pdf: path.join(base, "62510 Master of Information Technology.pdf"),
    mit_xlsx: path.join(base, "62510 Master of Information Technology.xlsx"),

    math_pdf: path.join(base, "BP059 Bachelor of Mathematics.pdf"),
    math_xlsx: path.join(base, "BP059 Bachelor of Mathematics.xlsx"),

    mcom_pdf: path.join(base, "41680 Master of Commerce.pdf"),
    mcom_xlsx: path.join(base, "41680 Master of Commerce.xlsx"),
  };

  const mitPdf = await parsePDF(files.mit_pdf);
  const mitUnits = parseExcel(files.mit_xlsx, "62510");

  const mathPdf = await parsePDF(files.math_pdf);
  const mathUnits = parseExcel(files.math_xlsx, "BP059");

  const mcomPdf = await parsePDF(files.mcom_pdf);
  const mcomUnits = parseExcel(files.mcom_xlsx, "41680");

  const catalog = {
    generated_at: new Date().toISOString(),
    courses: [
      {
        code: "62510",
        title: mitPdf.title,
        pdf_rules: {
          points: mitPdf.points,
          time_limit_years: mitPdf.time_limit_years,
          specialisations: mitPdf.specialisations,
          groups: mitPdf.groups,
          extracted_rules: mitPdf.extracted_rules,
        },
        units: mitUnits,
      },
      {
        code: "BP059",
        title: mathPdf.title,
        major: "MJD-EMATH",
        pdf_rules: {
          points: mathPdf.points,
          time_limit_years: mathPdf.time_limit_years,
          specialisations: mathPdf.specialisations,
          groups: mathPdf.groups,
          extracted_rules: mathPdf.extracted_rules,
        },
        units: mathUnits.map((u) =>
          u.code === "MATH3031"
            ? {
                ...u,
                prerequisites_raw: "MATH1014 OR MATH1012",
                prerequisites_parsed: {
                  type: "OR",
                  children: [
                    { type: "UNIT", code: "MATH1014" },
                    { type: "UNIT", code: "MATH1012" },
                  ],
                },
              }
            : u
        ),
      },
      {
        code: "41680",
        title: mcomPdf.title,
        pdf_rules: {
          points: mcomPdf.points,
          time_limit_years: mcomPdf.time_limit_years,
          specialisations: mcomPdf.specialisations,
          groups: mcomPdf.groups,
          extracted_rules: mcomPdf.extracted_rules,
        },
        units: mcomUnits,
      },
    ],
  };

  const outputDir = path.resolve("output");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  fs.writeFileSync(
    path.join(outputDir, "course-catalog.json"),
    JSON.stringify(catalog, null, 2),
    "utf-8"
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await upsertCatalog(client, catalog);
    await client.query("COMMIT");
    console.log("✅ Catalog inserted into database");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  await pool.end();
  console.log("✅ Catalog generated at course-catalog.json");
}

run().catch((err) => {
  console.error("❌ Failed to build catalog");
  console.error(err);
  process.exit(1);
});