import { Router } from "express";
import {
  getAllUnits,
  getUnitDetails,
} from "../controllers/courseController";

const router = Router();

router.get("/", getAllUnits);
router.get("/:code", getUnitDetails);

export default router;
