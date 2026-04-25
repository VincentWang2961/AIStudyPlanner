import { Router } from "express";
import {
  getAllCourseNames,
  getFullCourseDetails,
} from "../controllers/courseController";

const router = Router();

router.get("/", getAllCourseNames); 
// Example: GET /api/courses

router.get("/:code/full", getFullCourseDetails); 
// Example: GET /api/courses/62510/full

export default router;