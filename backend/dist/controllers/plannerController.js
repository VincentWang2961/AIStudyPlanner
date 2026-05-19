"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePlannerPlan = validatePlannerPlan;
const planValidationService_1 = require("../services/validation/planValidationService");
async function validatePlannerPlan(req, res) {
    try {
        const result = await (0, planValidationService_1.validatePlan)(req.body);
        return res.json({
            success: true,
            validation: result,
        });
    }
    catch (error) {
        console.error("Failed to validate planner plan:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to validate planner plan",
        });
    }
}
