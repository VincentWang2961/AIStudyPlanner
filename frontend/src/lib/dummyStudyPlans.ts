import type { SavedStudyPlan } from "./planApi";

export const DUMMY_DATA_STORAGE_KEY = "ai-study-planner:dummy-study-plans-enabled";
export const DUMMY_STUDY_PLAN_ID_PREFIX = "dummy-plan-";

const DUMMY_STUDY_PLANS: SavedStudyPlan[] = [
  {
    id: "dummy-plan-mit-balanced",
    name: "Demo: Balanced MIT Structure",
    courseCode: "62510",
    program: "Master of Information Technology",
    config: {
      degreeLevel: "masters",
      program: "62510",
      studyMode: "fulltime",
      semesters: 4,
      unitsPerSemester: 4,
    },
    createdAt: "2026-04-12T09:00:00.000Z",
    updatedAt: "2026-05-06T10:30:00.000Z",
    planData: [
      {
        id: 1,
        name: "Spring 2026",
        units: [
          {
            code: "IT101",
            name: "Programming Foundations",
            credits: 6,
            description: "Core programming concepts, testing basics, and problem solving.",
            prerequisites: [],
            corequisites: [],
            availability: ["Spring 2026", "Fall 2026"],
            type: "core",
          },
          {
            code: "IT102",
            name: "Database Fundamentals",
            credits: 6,
            description: "Data modelling, relational design, and SQL querying.",
            prerequisites: [],
            corequisites: [],
            availability: ["Spring 2026"],
            type: "core",
          },
          {
            code: "IT103",
            name: "Systems Analysis",
            credits: 6,
            description: "Requirements discovery and structured analysis for software projects.",
            prerequisites: [],
            corequisites: [],
            availability: ["Spring 2026", "Fall 2026"],
            type: "core",
          },
        ],
      },
      {
        id: 2,
        name: "Fall 2026",
        units: [
          {
            code: "IT201",
            name: "Web Application Development",
            credits: 6,
            description: "Full-stack web patterns, API integration, and accessible UI delivery.",
            prerequisites: ["IT101"],
            corequisites: [],
            availability: ["Fall 2026"],
            type: "core",
          },
          {
            code: "IT202",
            name: "Cloud Infrastructure",
            credits: 6,
            description: "Cloud services, deployment pipelines, and operational monitoring.",
            prerequisites: ["IT103"],
            corequisites: [],
            availability: ["Fall 2026", "Spring 2027"],
            type: "core",
          },
          {
            code: "IT203",
            name: "Data Analytics Practice",
            credits: 6,
            description: "Applied analytics workflow from data preparation to communication.",
            prerequisites: ["IT102"],
            corequisites: [],
            availability: ["Fall 2026"],
            type: "elective",
          },
        ],
      },
      {
        id: 3,
        name: "Spring 2027",
        units: [
          {
            code: "IT301",
            name: "Cyber Security Principles",
            credits: 6,
            description: "Security controls, threat modelling, and secure development practice.",
            prerequisites: ["IT201"],
            corequisites: [],
            availability: ["Spring 2027"],
            type: "core",
          },
          {
            code: "IT302",
            name: "Software Project Studio",
            credits: 6,
            description: "Team-based delivery of a maintainable software product.",
            prerequisites: ["IT201", "IT202"],
            corequisites: [],
            availability: ["Spring 2027"],
            type: "core",
          },
        ],
      },
    ],
  },
  {
    id: "dummy-plan-commerce-analytics",
    name: "Demo: Commerce Analytics Path",
    courseCode: "41680",
    program: "Master of Commerce",
    config: {
      degreeLevel: "masters",
      program: "41680",
      studyMode: "parttime",
      semesters: 6,
      unitsPerSemester: 2,
    },
    createdAt: "2026-04-18T08:15:00.000Z",
    updatedAt: "2026-05-02T14:20:00.000Z",
    planData: [
      {
        id: 1,
        name: "Spring 2026",
        units: [
          {
            code: "BUS101",
            name: "Accounting and Decision Making",
            credits: 6,
            description: "Accounting information for planning, control, and business decisions.",
            prerequisites: [],
            corequisites: [],
            availability: ["Spring 2026"],
            type: "core",
          },
          {
            code: "BUS102",
            name: "Marketing Management",
            credits: 6,
            description: "Customer insight, market positioning, and campaign planning.",
            prerequisites: [],
            corequisites: [],
            availability: ["Spring 2026", "Fall 2026"],
            type: "core",
          },
        ],
      },
      {
        id: 2,
        name: "Fall 2026",
        units: [
          {
            code: "BUS201",
            name: "Business Analytics",
            credits: 6,
            description: "Quantitative methods and analytics tools for commercial problems.",
            prerequisites: ["BUS101"],
            corequisites: [],
            availability: ["Fall 2026"],
            type: "core",
          },
          {
            code: "BUS202",
            name: "Strategy and Innovation",
            credits: 6,
            description: "Competitive strategy, innovation systems, and organisational change.",
            prerequisites: [],
            corequisites: [],
            availability: ["Fall 2026"],
            type: "elective",
          },
        ],
      },
    ],
  },
  {
    id: "dummy-plan-math-foundation",
    name: "Demo: Mathematics Foundation",
    courseCode: "BP059",
    program: "Bachelor of Mathematics",
    config: {
      degreeLevel: "undergraduate",
      program: "BP059",
      studyMode: "fulltime",
      semesters: 6,
      unitsPerSemester: 4,
    },
    createdAt: "2026-04-22T11:45:00.000Z",
    updatedAt: "2026-04-30T16:00:00.000Z",
    planData: [
      {
        id: 1,
        name: "Spring 2026",
        units: [
          {
            code: "MATH101",
            name: "Calculus I",
            credits: 6,
            description: "Limits, differentiation, integration, and modelling basics.",
            prerequisites: [],
            corequisites: [],
            availability: ["Spring 2026", "Fall 2026"],
            type: "core",
          },
          {
            code: "MATH102",
            name: "Linear Algebra",
            credits: 6,
            description: "Matrices, vector spaces, eigenvalues, and transformations.",
            prerequisites: [],
            corequisites: [],
            availability: ["Spring 2026"],
            type: "core",
          },
          {
            code: "STAT101",
            name: "Statistics Foundations",
            credits: 6,
            description: "Probability, inference, and introductory statistical reasoning.",
            prerequisites: [],
            corequisites: [],
            availability: ["Spring 2026"],
            type: "core",
          },
        ],
      },
      {
        id: 2,
        name: "Fall 2026",
        units: [
          {
            code: "MATH201",
            name: "Calculus II",
            credits: 6,
            description: "Series, multivariable calculus, and applied integration.",
            prerequisites: ["MATH101"],
            corequisites: [],
            availability: ["Fall 2026"],
            type: "core",
          },
          {
            code: "MATH202",
            name: "Discrete Mathematics",
            credits: 6,
            description: "Logic, proofs, combinatorics, and graph theory.",
            prerequisites: [],
            corequisites: [],
            availability: ["Fall 2026"],
            type: "core",
          },
          {
            code: "STAT201",
            name: "Probability Models",
            credits: 6,
            description: "Random variables, distributions, and stochastic modelling.",
            prerequisites: ["STAT101"],
            corequisites: [],
            availability: ["Fall 2026"],
            type: "elective",
          },
        ],
      },
    ],
  },
];

export function getDummyStudyPlans(): SavedStudyPlan[] {
  return DUMMY_STUDY_PLANS.map((plan) => ({
    ...plan,
    config: plan.config ? { ...plan.config } : null,
    planData: plan.planData.map((semester) => ({
      ...semester,
      units: semester.units.map((unit) => ({ ...unit })),
    })),
  }));
}

export function isDummyStudyPlan(plan: Pick<SavedStudyPlan, "id">): boolean {
  return plan.id.startsWith(DUMMY_STUDY_PLAN_ID_PREFIX);
}

export function removeDummyStudyPlans(plans: SavedStudyPlan[]): SavedStudyPlan[] {
  return plans.filter((plan) => !isDummyStudyPlan(plan));
}

