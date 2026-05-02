import { Request, Response, NextFunction } from "express";
import {
  buildGuestCookie,
  createGuestSession,
  getGuestByToken,
  getGuestCookieName,
  getSessionCookieName,
  getUserBySessionToken,
} from "../services/authService";
import {
  deleteStudyPlan,
  getStudyPlan,
  listStudyPlans,
  saveStudyPlan,
  type PlanOwner,
} from "../services/planService";
import { getCookieValue } from "../utils/cookies";

async function resolvePlanOwner(req: Request, res: Response): Promise<PlanOwner> {
  const user = await getUserBySessionToken(getCookieValue(req.headers.cookie, getSessionCookieName()));

  if (user) {
    return {
      type: "user",
      id: user.id,
    };
  }

  const guestToken = getCookieValue(req.headers.cookie, getGuestCookieName());
  const existingGuest = await getGuestByToken(guestToken);

  if (existingGuest) {
    return {
      type: "guest",
      id: existingGuest.id,
    };
  }

  const guest = await createGuestSession();
  res.setHeader("Set-Cookie", buildGuestCookie(guest.token));

  return {
    type: "guest",
    id: guest.id,
  };
}

function getPlanId(req: Request): string {
  const { id } = req.params;

  if (!/^\d+$/.test(id)) {
    throw Object.assign(new Error("Plan id must be numeric."), { status: 400 });
  }

  return id;
}

function getSavePayload(req: Request) {
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

export async function listPlans(req: Request, res: Response, next: NextFunction) {
  try {
    const owner = await resolvePlanOwner(req, res);
    const plans = await listStudyPlans(owner);

    return res.status(200).json({
      ok: true,
      plans,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const owner = await resolvePlanOwner(req, res);
    const plan = await getStudyPlan(owner, getPlanId(req));

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
  } catch (error) {
    return next(error);
  }
}

export async function savePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const owner = await resolvePlanOwner(req, res);
    const plan = await saveStudyPlan(owner, getSavePayload(req));

    return res.status(200).json({
      ok: true,
      plan,
    });
  } catch (error) {
    return next(error);
  }
}

export async function removePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const owner = await resolvePlanOwner(req, res);
    const deleted = await deleteStudyPlan(owner, getPlanId(req));

    if (!deleted) {
      return res.status(404).json({
        ok: false,
        error: "Study plan was not found.",
      });
    }

    return res.status(200).json({
      ok: true,
    });
  } catch (error) {
    return next(error);
  }
}
