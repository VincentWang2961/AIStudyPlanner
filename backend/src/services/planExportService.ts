import PDFDocument from "pdfkit";
import { SemesterPlan } from "../types/planExport";

function csvEscape(value: string | number | undefined | null): string {
  const raw = String(value ?? "");
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

export function buildCsvExport(planData: SemesterPlan[]): string {
  const rows = [
    [
      "semester_sequence",
      "semester_name",
      "unit_code",
      "unit_title",
      "credits",
      "type",
    ],
    ...planData.flatMap((semester, index) =>
      semester.units.map((unit) => [
        semester.id ?? index + 1,
        semester.name,
        unit.code,
        unit.name,
        unit.credits,
        unit.type ?? "unit",
      ])
    ),
  ];

  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

export function buildPdfExport(params: {
  courseCode: string;
  program: string;
  planData: SemesterPlan[];
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
    });

    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("Study Plan", { align: "center" });
    doc.moveDown(0.5);

    doc.fontSize(11).text(`Course Code: ${params.courseCode}`);
    doc.text(`Program: ${params.program}`);
    doc.moveDown();

    for (const semester of params.planData) {
      doc.fontSize(14).text(semester.name, { underline: true });
      doc.moveDown(0.3);

      doc.fontSize(10);

      doc.text("Code", 40, doc.y, { continued: true, width: 80 });
      doc.text("Unit Name", 120, doc.y, { continued: true, width: 280 });
      doc.text("Credits", 420, doc.y, { continued: true, width: 60 });
      doc.text("Type", 480, doc.y, { width: 70 });

      doc.moveDown(0.3);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.4);

      for (const unit of semester.units) {
        const y = doc.y;

        doc.text(unit.code, 40, y, { width: 80 });
        doc.text(unit.name, 120, y, { width: 280 });
        doc.text(String(unit.credits), 420, y, { width: 60 });
        doc.text(unit.type ?? "unit", 480, y, { width: 70 });

        doc.moveDown(0.6);

        if (doc.y > 740) {
          doc.addPage();
        }
      }

      doc.moveDown();
    }

    doc.end();
  });
}

export function fileSafe(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "plan"
  );
}