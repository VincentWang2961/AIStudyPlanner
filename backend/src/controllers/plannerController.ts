import { Request, Response } from "express";
import { validatePlan } from "../services/validation/planValidationService";

export async function validatePlannerPlan(req: Request, res: Response) {
  try {
    const result = await validatePlan(req.body);

    return res.json({
      success: true,
      validation: result,
    });
  } catch (error) {
    console.error("Failed to validate planner plan:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to validate planner plan",
    });
  }
}