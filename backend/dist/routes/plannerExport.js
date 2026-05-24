"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
function csvEscape(value) {
    const raw = String(value ?? "");
    return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}
function buildCsvExport(planData) {
    const rows = [
        [
            "semester_sequence",
            "semester_name",
            "unit_code",
            "unit_title",
            "credits",
            "type",
        ],
        ...planData.flatMap((semester, index) => semester.units.map((unit) => [
            semester.id ?? index + 1,
            semester.name,
            unit.code,
            unit.name,
            unit.credits,
            unit.type ?? "unit",
        ])),
    ];
    return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}
function fileSafe(value) {
    return (value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "plan");
}
router.post("/export/csv", (req, res) => {
    const payload = req.body;
    if (!payload.courseCode || !Array.isArray(payload.planData)) {
        return res.status(400).json({
            error: "courseCode and planData are required.",
        });
    }
    const csv = buildCsvExport(payload.planData);
    const filenameBase = fileSafe(`${payload.courseCode}-study-plan`);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filenameBase}.csv"`);
    return res.send(csv);
});
exports.default = router;
