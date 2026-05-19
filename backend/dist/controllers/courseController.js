"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllCourseNames = getAllCourseNames;
exports.getFullCourseDetails = getFullCourseDetails;
const courseService_1 = require("../services/courseService");
async function getAllCourseNames(_req, res) {
    try {
        const courses = await (0, courseService_1.fetchAllCourses)();
        res.json({
            success: true,
            courses,
        });
    }
    catch (error) {
        console.error("Failed to fetch course names:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch course names",
        });
    }
}
//  Implement getFullCourseDetails to fetch complete course structure
async function getFullCourseDetails(req, res) {
    const { code } = req.params;
    try {
        const course = await (0, courseService_1.fetchCourseByCode)(code);
        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found",
            });
        }
        const units = await (0, courseService_1.fetchUnitsForCourse)(code);
        const groups = await (0, courseService_1.fetchGroupsForCourse)(code);
        const groupsWithUnits = await Promise.all(groups.map(async (group) => ({
            ...group,
            units: await (0, courseService_1.fetchUnitsForGroup)(group.id),
        })));
        return res.json({
            success: true,
            course: {
                ...course,
                units,
                groups: groupsWithUnits,
            },
        });
    }
    catch (error) {
        console.error("Failed to fetch full course details:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch course details",
        });
    }
}
