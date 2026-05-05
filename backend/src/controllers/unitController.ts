import { Request, Response } from "express";
import { fetchAllUnits, fetchUnitByCode } from "../services/courseService";

// Recursively remove all *_raw fields from any nested object
function removeRawFields(obj: any) {
  if (!obj || typeof obj !== "object") return obj;

  // Convert numeric-keyed objects back into arrays
  const isArrayLike = Object.keys(obj).every(k => /^\d+$/.test(k));

  const clean: any = isArrayLike ? [] : {};

  for (const key of Object.keys(obj)) {
    if (key.endsWith("_raw")) continue;

    const value = obj[key];

    const cleanedValue =
      typeof value === "object" && value !== null
        ? removeRawFields(value)
        : value;

    if (isArrayLike) {
      clean.push(cleanedValue);
    } else {
      clean[key] = cleanedValue;
    }
  }

  return clean;
}


export async function getAllUnits(_req: Request, res: Response) {
  try {
    const units = await fetchAllUnits();

    // Convert Prisma objects → plain JSON
    const plainUnits = JSON.parse(JSON.stringify(units));

    // Deep clean every unit
    const cleanUnits = plainUnits.map((u: any) => removeRawFields(u));

    return res.json({
      success: true,
      units: cleanUnits,
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

    // Convert Prisma object → plain JSON
    const plainUnit = JSON.parse(JSON.stringify(unit));

    // Deep clean the unit object
    const cleanUnit = removeRawFields(plainUnit);

    return res.json({
      success: true,
      unit: cleanUnit,
    });
  } catch (error) {
    console.error("Failed to fetch unit:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch unit",
    });
  }
}
