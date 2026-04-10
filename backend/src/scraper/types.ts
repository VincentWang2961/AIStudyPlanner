export type PrerequisiteRule =
  | { type: "unit"; code: string }
  | { type: "and"; rules: PrerequisiteRule[] }
  | { type: "or"; rules: PrerequisiteRule[] }
  | { type: "points"; minimumPoints: number; inCourses?: string[] }
  | { type: "enrolment"; courseCodes: string[] }

export interface PointsRequirement {
  minimumPoints: number;
  inCourses?: string[];
}

export interface Unit {
  code: string;
  name: string;
  availability: string[];
  prerequisites?: PrerequisiteRule;
  corequisites?: PrerequisiteRule;
  incompatibilities?: string[];
  pointsRequirement?: PointsRequirement;
  enrolmentRequirements?: string[];
}

export interface UnitGroup {
  name: string;
  units: Unit[];
}

export interface Specialisation {
  code: string;
  name: string;
  groups: UnitGroup[];
}

export interface CourseData {
  courseCode: string;
  specialisations: Specialisation[];
  courseStructure: UnitGroup[];
}