import { Router } from "express";
import { getDefaultPlanController } from "../controllers/defaultPlanController";

const router = Router();

router.get("/default-plans", getDefaultPlanController);

export default router;