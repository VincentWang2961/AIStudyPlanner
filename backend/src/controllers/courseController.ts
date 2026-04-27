import { Request, Response } from "express";
import {
  fetchAllCourses,
  fetchCourseByCode,
  fetchUnitsForCourse,
  fetchGroupsForCourse,
  fetchUnitsForGroup,
} from "../services/courseService";

export async function getAllCourseNames(_req: Request, res: Response) {
  try {
    const courses = await fetchAllCourses();

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


// Fetch full course structure including units and grouped units

export async function getFullCourseDetails(req: Request, res: Response) {
  const { code } = req.params;

  try {
    const course = await fetchCourseByCode(code);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const units = await fetchUnitsForCourse(code);
    const groups = await fetchGroupsForCourse(code);
    
    const groupsWithUnits = await Promise.all(
  groups.map(async (group) => ({
    ...group,
    units: await fetchUnitsForGroup(group.id),
  }))
);


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
