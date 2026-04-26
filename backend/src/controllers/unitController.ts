import { Request, Response } from "express";
import { fetchAllUnits, fetchUnitByCode } from "../services/courseService";

export async function getAllUnits(_req: Request, res: Response) {
  try {
    const units = await fetchAllUnits();

    return res.json({
      success: true,
      units,
    });
  } catch (error) {
    console.error("Failed to fetch units:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch units",
    });
  }
}

export async function getUnitByCode(req: Request, res: Response) {
  try {
    const unit = await fetchUnitByCode(req.params.code);

    if (!unit) {
      return res.status(404).json({
        success: false,
        message: "Unit not found",
      });
    }

    return res.json({
      success: true,
      unit,
    });
  } catch (error) {
    console.error("Failed to fetch unit:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch unit",
    });
  }
}
