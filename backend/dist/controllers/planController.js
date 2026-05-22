"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPlans = listPlans;
exports.getPlan = getPlan;
exports.savePlan = savePlan;
exports.removePlan = removePlan;
const authService_1 = require("../services/authService");
const planService_1 = require("../services/planService");
const cookies_1 = require("../utils/cookies");
async function resolvePlanOwner(req, res) {
    const user = await (0, authService_1.getUserBySessionToken)((0, cookies_1.getCookieValue)(req.headers.cookie, (0, authService_1.getSessionCookieName)()));
    if (user) {
        return {
            type: "user",
            id: user.id,
        };
    }
    const guestToken = (0, cookies_1.getCookieValue)(req.headers.cookie, (0, authService_1.getGuestCookieName)());
    const existingGuest = await (0, authService_1.getGuestByToken)(guestToken);
    if (existingGuest) {
        return {
            type: "guest",
            id: existingGuest.id,
        };
    }
    const guest = await (0, authService_1.createGuestSession)();
    res.setHeader("Set-Cookie", (0, authService_1.buildGuestCookie)(guest.token));
    return {
        type: "guest",
        id: guest.id,
    };
}
function getPlanId(req) {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) {
        throw Object.assign(new Error("Plan id must be numeric."), { status: 400 });
    }
    return id;
}
function getSavePayload(req) {
    const { id, name, courseCode, program, config, planData } = req.body ?? {};
    if (!planData || typeof planData !== "object") {
        throw Object.assign(new Error("planData is required."), { status: 400 });
    }
    if (id !== undefined && typeof id !== "string") {
        throw Object.assign(new Error("Plan id must be a string."), { status: 400 });
    }
    return {
        id,
        name: typeof name === "string" ? name : undefined,
        courseCode: typeof courseCode === "string" ? courseCode : null,
        program: typeof program === "string" ? program : null,
        config: config && typeof config === "object" ? config : null,
        planData,
    };
}
async function listPlans(req, res, next) {
    try {
        const owner = await resolvePlanOwner(req, res);
        const plans = await (0, planService_1.listStudyPlans)(owner);
        return res.status(200).json({
            ok: true,
            plans,
        });
    }
    catch (error) {
        return next(error);
    }
}
async function getPlan(req, res, next) {
    try {
        const owner = await resolvePlanOwner(req, res);
        const plan = await (0, planService_1.getStudyPlan)(owner, getPlanId(req));
        if (!plan) {
            return res.status(404).json({
                ok: false,
                error: "Study plan was not found.",
            });
        }
        return res.status(200).json({
            ok: true,
            plan,
        });
    }
    catch (error) {
        return next(error);
    }
}
async function savePlan(req, res, next) {
    try {
        const owner = await resolvePlanOwner(req, res);
        const plan = await (0, planService_1.saveStudyPlan)(owner, getSavePayload(req));
        return res.status(200).json({
            ok: true,
            plan,
        });
    }
    catch (error) {
        return next(error);
    }
}
async function removePlan(req, res, next) {
    try {
        const owner = await resolvePlanOwner(req, res);
        const deleted = await (0, planService_1.deleteStudyPlan)(owner, getPlanId(req));
        if (!deleted) {
            return res.status(404).json({
                ok: false,
                error: "Study plan was not found.",
            });
        }
        return res.status(200).json({
            ok: true,
        });
    }
    catch (error) {
        return next(error);
    }
}
