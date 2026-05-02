import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export type PlanOwner =
  | { type: "user"; id: string }
  | { type: "guest"; id: string };

export interface SaveStudyPlanInput {
  id?: string;
  name?: string;
  courseCode?: string | null;
  program?: string | null;
  config?: Prisma.InputJsonValue | null;
  planData: Prisma.InputJsonValue;
}

function ownerFilter(owner: PlanOwner) {
  return owner.type === "user"
    ? { user_id: BigInt(owner.id) }
    : { guest_id: BigInt(owner.id), user_id: null };
}

function ownerCreateData(owner: PlanOwner) {
  return owner.type === "user"
    ? { user_id: BigInt(owner.id), guest_id: null }
    : { user_id: null, guest_id: BigInt(owner.id) };
}

function toSavedPlan(plan: {
  id: bigint;
  name: string;
  course_code: string | null;
  program: string | null;
  config: Prisma.JsonValue | null;
  plan_data: Prisma.JsonValue;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: String(plan.id),
    name: plan.name,
    courseCode: plan.course_code,
    program: plan.program,
    config: plan.config,
    planData: plan.plan_data,
    createdAt: plan.created_at.toISOString(),
    updatedAt: plan.updated_at.toISOString(),
  };
}

export async function listStudyPlans(owner: PlanOwner) {
  const plans = await prisma.study_plans.findMany({
    where: ownerFilter(owner),
    orderBy: {
      updated_at: "desc",
    },
  });

  return plans.map(toSavedPlan);
}

export async function getStudyPlan(owner: PlanOwner, id: string) {
  const plan = await prisma.study_plans.findFirst({
    where: {
      id: BigInt(id),
      ...ownerFilter(owner),
    },
  });

  return plan ? toSavedPlan(plan) : null;
}

export async function saveStudyPlan(owner: PlanOwner, input: SaveStudyPlanInput) {
  const data = {
    name: input.name?.trim() || "Untitled Study Plan",
    course_code: input.courseCode ?? null,
    program: input.program ?? null,
    config: input.config ?? Prisma.JsonNull,
    plan_data: input.planData,
    updated_at: new Date(),
  };

  if (input.id) {
    const existing = await getStudyPlan(owner, input.id);

    if (!existing) {
      throw Object.assign(new Error("Study plan was not found."), { status: 404 });
    }

    const updated = await prisma.study_plans.update({
      where: {
        id: BigInt(input.id),
      },
      data,
    });

    return toSavedPlan(updated);
  }

  const created = await prisma.study_plans.create({
    data: {
      ...data,
      ...ownerCreateData(owner),
    },
  });

  return toSavedPlan(created);
}

export async function deleteStudyPlan(owner: PlanOwner, id: string): Promise<boolean> {
  const result = await prisma.study_plans.deleteMany({
    where: {
      id: BigInt(id),
      ...ownerFilter(owner),
    },
  });

  return result.count > 0;
}
