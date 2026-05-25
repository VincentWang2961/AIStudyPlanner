import { promises as fs } from "fs";
import path from "path";

type DefaultPlanTerm = {
  sequence: number;
  year: number;
  term: "S1" | "S2";
  units: string[];
};

type DefaultPlan = {
  id: string;
  name: string;
  selectedSpecialisations: string[];
  startTerm: "S1" | "S2";
  startYear: number;
  plan: DefaultPlanTerm[];
};

type DefaultPlansFile = {
  courseCode: string;
  courseTitle: string;
  plans: DefaultPlan[];
};

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

function getDefaultPlansPath(courseCode: string): string {
  const fileNameByCourseCode: Record<string, string> = {
    "62510": "master-of-it-default-plans.json",
    "41680": "master-of-commerce-default-plans.json",
    "BP059": "bachelor-of-mathematics-default-plans.json",
  };

  const fileName = fileNameByCourseCode[courseCode];

  if (!fileName) {
    throw new Error(`Default plans are not configured for course ${courseCode}.`);
  }

  return path.join(process.cwd(), "default_plans", fileName);
}

async function loadDefaultPlans(courseCode: string): Promise<DefaultPlansFile> {
  const filePath = getDefaultPlansPath(courseCode);
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as DefaultPlansFile;
}

export async function getDefaultPlan(params: {
  courseCode: string;
  specialisation: string;
  startTerm: string;
}): Promise<DefaultPlan | null> {
  const courseCode = params.courseCode.trim();
  const specialisation = normalise(params.specialisation);
  const startTerm = params.startTerm.trim().toUpperCase();

  if (startTerm !== "S1" && startTerm !== "S2") {
    throw new Error("startTerm must be S1 or S2.");
  }

  const data = await loadDefaultPlans(courseCode);

  return (
    data.plans.find((plan) => {
      const matchesTerm = plan.startTerm === startTerm;

      const matchesSpecialisation = plan.selectedSpecialisations.some(
        (item) => normalise(item) === specialisation
      );

      return matchesTerm && matchesSpecialisation;
    }) ?? null
  );
}