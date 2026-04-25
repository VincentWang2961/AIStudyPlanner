import { Router } from "express";
import { getAllUnits, getUnitByCode } from "../controllers/unitController";

const router = Router();

router.get("/", getAllUnits);
router.get("/:code", getUnitByCode);

export default router;
