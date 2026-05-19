"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listStudyPlans = listStudyPlans;
exports.getStudyPlan = getStudyPlan;
exports.saveStudyPlan = saveStudyPlan;
exports.deleteStudyPlan = deleteStudyPlan;
const client_1 = require("@prisma/client");
const prisma_1 = require("../config/prisma");
function ownerFilter(owner) {
    return owner.type === "user"
        ? { user_id: BigInt(owner.id) }
        : { guest_id: BigInt(owner.id), user_id: null };
}
function ownerCreateData(owner) {
    return owner.type === "user"
        ? { user_id: BigInt(owner.id), guest_id: null }
        : { user_id: null, guest_id: BigInt(owner.id) };
}
function toSavedPlan(plan) {
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
async function listStudyPlans(owner) {
    const plans = await prisma_1.prisma.study_plans.findMany({
        where: ownerFilter(owner),
        orderBy: {
            updated_at: "desc",
        },
    });
    return plans.map(toSavedPlan);
}
async function getStudyPlan(owner, id) {
    const plan = await prisma_1.prisma.study_plans.findFirst({
        where: {
            id: BigInt(id),
            ...ownerFilter(owner),
        },
    });
    return plan ? toSavedPlan(plan) : null;
}
async function saveStudyPlan(owner, input) {
    const data = {
        name: input.name?.trim() || "Untitled Study Plan",
        course_code: input.courseCode ?? null,
        program: input.program ?? null,
        config: input.config ?? client_1.Prisma.JsonNull,
        plan_data: input.planData,
        updated_at: new Date(),
    };
    if (input.id) {
        const existing = await getStudyPlan(owner, input.id);
        if (!existing) {
            throw Object.assign(new Error("Study plan was not found."), { status: 404 });
        }
        const updated = await prisma_1.prisma.study_plans.update({
            where: {
                id: BigInt(input.id),
            },
            data,
        });
        return toSavedPlan(updated);
    }
    const created = await prisma_1.prisma.study_plans.create({
        data: {
            ...data,
            ...ownerCreateData(owner),
        },
    });
    return toSavedPlan(created);
}
async function deleteStudyPlan(owner, id) {
    const result = await prisma_1.prisma.study_plans.deleteMany({
        where: {
            id: BigInt(id),
            ...ownerFilter(owner),
        },
    });
    return result.count > 0;
}
