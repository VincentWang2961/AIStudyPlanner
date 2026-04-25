import { Request, Response, NextFunction } from "express";
import {
  buildExpiredSessionCookie,
  buildSessionCookie,
  deleteSession,
  getSessionCookieName,
  getUserBySessionToken,
  loginUser,
  registerUser,
} from "../services/authService";
import { getCookieValue } from "../utils/cookies";

function getCredentials(req: Request): { email: string; password: string } {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string") {
    throw Object.assign(new Error("Email and password are required."), { status: 400 });
  }

  return { email, password };
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = getCredentials(req);
    const { user, sessionToken } = await registerUser(email, password);

    res.setHeader("Set-Cookie", buildSessionCookie(sessionToken));

    return res.status(201).json({
      ok: true,
      user,
    });
  } catch (error) {
    return next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = getCredentials(req);
    const { user, sessionToken } = await loginUser(email, password);

    res.setHeader("Set-Cookie", buildSessionCookie(sessionToken));

    return res.status(200).json({
      ok: true,
      user,
    });
  } catch (error) {
    return next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteSession(getCookieValue(req.headers.cookie, getSessionCookieName()));
    res.setHeader("Set-Cookie", buildExpiredSessionCookie());

    return res.status(200).json({
      ok: true,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getCurrentUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await getUserBySessionToken(getCookieValue(req.headers.cookie, getSessionCookieName()));

    return res.status(200).json({
      ok: true,
      user,
    });
  } catch (error) {
    return next(error);
  }
}
