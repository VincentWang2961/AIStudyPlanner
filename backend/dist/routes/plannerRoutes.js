"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const plannerController_1 = require("../controllers/plannerController");
const router = (0, express_1.Router)();
router.post("/validate", plannerController_1.validatePlannerPlan);
// Example: POST /api/planner/validate
exports.default = router;
