"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const aiPlannerController_1 = require("../controllers/aiPlannerController");
const router = (0, express_1.Router)();
// Reports runtime configuration relevant to AI planning.
router.get('/debug-status', aiPlannerController_1.getAiPlannerDebugStatus);
// Main endpoint used by the planner UI.
router.post('/generate-plan', aiPlannerController_1.generateStudyPlanResponse);
// Debug endpoint for browser-console testing before frontend integration.
router.post('/debug-generate-plan', aiPlannerController_1.generateDebugStudyPlan);
exports.default = router;
