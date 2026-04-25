import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import {
  fetchCourseByCode,
  fetchUnitsForCourse,
  fetchGroupsForCourse,
  fetchUnitsForGroup,
} from "../services/courseService";

export async function getAllCourseNames(_req: Request, res: Response) {
  try {
    const courses = await prisma.courses.findMany({
      select: {
        code: true,
        title: true,
        specialisations: true,
      }
    });

    res.json({
      success: true,
      courses,
    });
  } catch (error) {
    console.error("Failed to fetch course names:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch course names",
    });
  }
}

// TODO : Implement getFullCourseDetails to fetch complete course structure
export async function getFullCourseDetails(req: Request, res: Response) {
  const { code } = req.params;

  try {
    // TODO:
    // 1. Fetch course basic info
    const course = await fetchCourseByCode(code);

    // 2. Fetch all course units
    const units = await fetchUnitsForCourse(code);

    // 3. Fetch all groups
    const groups = await fetchGroupsForCourse(code);

    // 4. Attach units to each group
    const groupsWithUnits = [];

    for (const group of groups) {
      const groupUnits = await fetchUnitsForGroup(group.id);

      groupsWithUnits.push({
        ...group,
        units: groupUnits,
      });
    }

    // 5. Return combined object
    return res.json({
      success: true,
      course: {
        ...course,
        units,
        groups: groupsWithUnits,
      },
    });
  } catch (error) {
    console.error("Failed to fetch full course details:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch course details",
    });
  }
}
