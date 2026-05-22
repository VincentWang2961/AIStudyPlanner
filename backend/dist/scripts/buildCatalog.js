"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const excelParser_1 = require("../services/parser/excelParser");
const pdfParser_1 = require("../services/parser/pdfParser");
const db_1 = require("../config/db");
const catalogRepository_1 = require("../services/parser/catalogRepository");
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
    const mitPdf = await (0, pdfParser_1.parsePDF)(files.mit_pdf);
    const mitUnits = (0, excelParser_1.parseExcel)(files.mit_xlsx, "62510");
    const mathPdf = await (0, pdfParser_1.parsePDF)(files.math_pdf);
    const mathUnits = (0, excelParser_1.parseExcel)(files.math_xlsx, "BP059");
    const mcomPdf = await (0, pdfParser_1.parsePDF)(files.mcom_pdf);
    const mcomUnits = (0, excelParser_1.parseExcel)(files.mcom_xlsx, "41680");
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
                units: mathUnits.map((u) => u.code === "MATH3031"
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
                    : u),
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
    fs.writeFileSync(path.join(outputDir, "course-catalog.json"), JSON.stringify(catalog, null, 2), "utf-8");
    const client = await db_1.pool.connect();
    try {
        await client.query("BEGIN");
        await (0, catalogRepository_1.upsertCatalog)(client, catalog);
        await client.query("COMMIT");
        console.log("✅ Catalog inserted into database");
    }
    catch (err) {
        await client.query("ROLLBACK");
        throw err;
    }
    finally {
        client.release();
    }
    await db_1.pool.end();
    console.log("✅ Catalog generated at course-catalog.json");
}
run().catch((err) => {
    console.error("❌ Failed to build catalog");
    console.error(err);
    process.exit(1);
});
