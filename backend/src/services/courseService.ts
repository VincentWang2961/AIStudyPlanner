import { prisma } from "../config/prisma";

export async function fetchCourseByCode(code: string) {
  // TODO: Fetch course basic info from courses table
  return null;
}

export async function fetchUnitsForCourse(code: string) {
  // TODO: Fetch units linked to this course using course_units -> units
  return [];
}

export async function fetchGroupsForCourse(code: string) {
  // TODO: Fetch groups linked to this course from course_groups
  return [];
}

export async function fetchUnitsForGroup(groupId: number) {
  // TODO: Fetch units linked to this group using group_units -> units
  return [];
}