import { Request, Response } from "express";
import { getDefaultPlan } from "../services/defaultPlanService";

export async function getDefaultPlanController(req: Request, res: Response) {
  try {
    const courseCode = String(req.query.courseCode ?? "").trim();
    const specialisation = String(req.query.specialisation ?? "").trim();
    const startTerm = String(req.query.startTerm ?? "").trim();

    if (!courseCode || !specialisation || !startTerm) {
      return res.status(400).json({
        success: false,
        message: "courseCode, specialisation and startTerm are required.",
      });
    }

    const plan = await getDefaultPlan({
      courseCode,
      specialisation,
      startTerm,
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "No matching default plan found.",
      });
    }

    return res.json({
      success: true,
      plan,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message ?? "Failed to fetch default plan.",
    });
  }
}