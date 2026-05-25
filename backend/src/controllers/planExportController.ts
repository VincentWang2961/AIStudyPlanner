import { Request, Response } from "express";
import { CsvExportRequest } from "../types/planExport";
import { buildCsvExport, buildPdfExport, fileSafe } from "../services/planExportService";

export function exportPlanCsvController(req: Request, res: Response) {
  const payload = req.body as Partial<CsvExportRequest>;

  if (!payload.courseCode || !Array.isArray(payload.planData)) {
    return res.status(400).json({
      error: "courseCode and planData are required.",
    });
  }

  const csv = buildCsvExport(payload.planData);
  const filenameBase = fileSafe(`${payload.courseCode}-study-plan`);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filenameBase}.csv"`
  );

  return res.send(csv);
}

export async function exportPlanPdfController(req: Request, res: Response) {
  const payload = req.body as Partial<CsvExportRequest>;

  if (!payload.courseCode || !payload.program || !Array.isArray(payload.planData)) {
    return res.status(400).json({
      error: "courseCode, program and planData are required.",
    });
  }

  const pdf = await buildPdfExport({
    courseCode: payload.courseCode,
    program: payload.program,
    planData: payload.planData,
  });

  const filenameBase = fileSafe(`${payload.courseCode}-study-plan`);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filenameBase}.pdf"`
  );

  return res.send(pdf);
}
