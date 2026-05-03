import { Router, Request, Response } from "express";

const router = Router();

interface StudyPlanTerm {
  year: number;
  term: string;
  units: string[];
}

interface ExportPlanRequest {
  courseCode: string;
  completedUnits?: string[];
  selectedSpecialisations: string[];
  plan: StudyPlanTerm[];
}

function escapeCsvValue(value: string | number | null | undefined): string {
  const stringValue = String(value ?? "");

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function convertPlanToCsv(data: ExportPlanRequest): string {
  const rows: string[][] = [];

  rows.push(["Course Code", data.courseCode]);
  rows.push([
    "Selected Specialisations",
    data.selectedSpecialisations.join("; "),
  ]);

  if (data.completedUnits && data.completedUnits.length > 0) {
    rows.push(["Completed Units", data.completedUnits.join("; ")]);
  }

  rows.push([]);
  rows.push(["Year", "Term", "Unit Code"]);

  for (const semester of data.plan) {
    if (semester.units.length === 0) {
      rows.push([String(semester.year), semester.term, ""]);
      continue;
    }

    for (const unitCode of semester.units) {
      rows.push([String(semester.year), semester.term, unitCode]);
    }
  }

  return rows
    .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
    .join("\n");
}

router.post("/export/csv", (req: Request, res: Response) => {
  try {
    const body = req.body as ExportPlanRequest;

    if (!body.courseCode || !Array.isArray(body.plan)) {
      return res.status(400).json({
        message: "Invalid request body. courseCode and plan are required.",
      });
    }

    const csv = convertPlanToCsv(body);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="study-plan.csv"',
    );

    return res.status(200).send(csv);
  } catch (error) {
    console.error("Failed to export CSV:", error);

    return res.status(500).json({
      message: "Failed to export CSV file.",
    });
  }
});

export default router;
