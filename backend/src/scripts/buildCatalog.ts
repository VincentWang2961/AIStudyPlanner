import * as path from "path";
import * as fs from "fs";
import { parseExcel } from "../services/parser/excelParser";
import { parsePDF } from "../services/parser/pdfParser";

async function run() {
  const base = path.resolve(".");

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
          specialisations: mitPdf.specialisations,
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
          specialisations: mathPdf.specialisations,
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
          specialisations: mcomPdf.specialisations,
          extracted_rules: mcomPdf.extracted_rules,
        },
        units: mcomUnits,
      },
    ],
  };

  fs.writeFileSync(
    path.join(base, "course-catalog.json"),
    JSON.stringify(catalog, null, 2),
    "utf-8"
  );

  console.log("✅ Catalog generated at course-catalog.json");
}

run().catch((err) => {
  console.error("❌ Failed to build catalog");
  console.error(err);
  process.exit(1);
});