import { Router } from "express";
import { getPlan, listPlans, removePlan, savePlan } from "../controllers/planController";

const router = Router();

router.get("/", listPlans);
router.post("/", savePlan);
router.get("/:id", getPlan);
router.delete("/:id", removePlan);

export default router;
