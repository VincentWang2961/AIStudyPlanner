"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const courseController_1 = require("../controllers/courseController");
const router = (0, express_1.Router)();
router.get("/", courseController_1.getAllCourseNames);
// Example: GET /api/courses
router.get("/:code/full", courseController_1.getFullCourseDetails);
// Example: GET /api/courses/62510/full
exports.default = router;
