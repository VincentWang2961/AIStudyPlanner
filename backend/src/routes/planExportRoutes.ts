import { Router } from "express";
import { exportPlanCsvController, exportPlanPdfController } from "../controllers/planExportController";

const router = Router();

router.post("/export/csv", exportPlanCsvController);
router.post("/export/pdf", exportPlanPdfController);

export default router;