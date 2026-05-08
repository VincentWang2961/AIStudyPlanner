import { Router } from "express";
import { validatePlannerPlan } from "../controllers/plannerController";

const router = Router();

router.post("/validate", validatePlannerPlan);
// Example: POST /api/planner/validate

export default router;