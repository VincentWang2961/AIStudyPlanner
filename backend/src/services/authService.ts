import crypto from "crypto";
import { promisify } from "util";
import { prisma } from "../config/prisma";

const scryptAsync = promisify(crypto.scrypt);
const PASSWORD_KEY_LENGTH = 64;
const SESSION_COOKIE_NAME = "study_planner_session";
const GUEST_COOKIE_NAME = "study_planner_guest";
const SESSION_DURATION_DAYS = 7;
const GUEST_DURATION_DAYS = 90;

export type AuthUser = {
  id: string;
  email: string;
};

type StoredUser = {
  id: bigint;
  email: string;
  password_hash: string;
  password_salt: string;
};

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validateEmail(email: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error("Enter a valid email address."), { status: 400 });
  }
}

function validatePassword(password: string): void {
  if (password.length < 8) {
    throw Object.assign(new Error("Password must be at least 8 characters."), { status: 400 });
  }
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await scryptAsync(password, salt, PASSWORD_KEY_LENGTH);
  return (key as Buffer).toString("hex");
}

function safeEqualHex(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function toAuthUser(user: { id: string | number | bigint; email: string }): AuthUser {
  return {
    id: String(user.id),
    email: user.email,
  };
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}

export function getGuestCookieName(): string {
  return GUEST_COOKIE_NAME;
}

export function buildSessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const maxAge = SESSION_DURATION_DAYS * 24 * 60 * 60;

  return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

export function buildExpiredSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";

  return `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

export function buildGuestCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const maxAge = GUEST_DURATION_DAYS * 24 * 60 * 60;

  return `${GUEST_COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

export function buildExpiredGuestCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";

  return `${GUEST_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

export async function registerUser(emailInput: string, password: string): Promise<{ user: AuthUser; sessionToken: string }> {
  const email = normaliseEmail(emailInput);
  validateEmail(email);
  validatePassword(password);

  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = await hashPassword(password, salt);

  try {
    const createdUser = await prisma.users.create({
      data: {
        email,
        password_hash: passwordHash,
        password_salt: salt,
      },
      select: {
        id: true,
        email: true,
      },
    });

    const user = toAuthUser(createdUser);
    const sessionToken = await createSession(user.id);

    return { user, sessionToken };
  } catch (error: any) {
    if (error?.code === "P2002") {
      throw Object.assign(new Error("An account already exists for this email address."), { status: 409 });
    }

    throw error;
  }
}

export async function loginUser(emailInput: string, password: string): Promise<{ user: AuthUser; sessionToken: string }> {
  const email = normaliseEmail(emailInput);
  validateEmail(email);

  const user = await prisma.users.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      password_hash: true,
      password_salt: true,
    },
  }) as StoredUser | null;
  const invalidError = Object.assign(new Error("Email or password is incorrect."), { status: 401 });

  if (!user) {
    throw invalidError;
  }

  const attemptedHash = await hashPassword(password, user.password_salt);

  if (!safeEqualHex(attemptedHash, user.password_hash)) {
    throw invalidError;
  }

  const sessionToken = await createSession(String(user.id));

  return {
    user: toAuthUser(user),
    sessionToken,
  };
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);

  await prisma.user_sessions.create({
    data: {
      user_id: BigInt(userId),
      token_hash: tokenHash,
      expires_at: daysFromNow(SESSION_DURATION_DAYS),
    },
  });

  return token;
}

export async function getUserBySessionToken(token: string | undefined): Promise<AuthUser | null> {
  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const session = await prisma.user_sessions.findFirst({
    where: {
      token_hash: tokenHash,
      expires_at: {
        gt: new Date(),
      },
    },
    select: {
      users: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  return session?.users ? toAuthUser(session.users) : null;
}

export async function deleteSession(token: string | undefined): Promise<void> {
  if (!token) {
    return;
  }

  await prisma.user_sessions.deleteMany({
    where: {
      token_hash: hashSessionToken(token),
    },
  });
}

export async function createGuestSession(): Promise<{ id: string; token: string }> {
  const token = crypto.randomBytes(32).toString("base64url");
  const guest = await prisma.guest_sessions.create({
    data: {
      token_hash: hashSessionToken(token),
    },
    select: {
      id: true,
    },
  });

  return {
    id: String(guest.id),
    token,
  };
}

export async function getGuestByToken(token: string | undefined): Promise<{ id: string } | null> {
  if (!token) {
    return null;
  }

  const guest = await prisma.guest_sessions.updateMany({
    where: {
      token_hash: hashSessionToken(token),
    },
    data: {
      last_seen_at: new Date(),
    },
  });

  if (guest.count === 0) {
    return null;
  }

  const session = await prisma.guest_sessions.findUnique({
    where: {
      token_hash: hashSessionToken(token),
    },
    select: {
      id: true,
    },
  });

  return session ? { id: String(session.id) } : null;
}

export async function migrateGuestPlansToUser(guestToken: string | undefined, userId: string): Promise<void> {
  const guest = await getGuestByToken(guestToken);

  if (!guest) {
    return;
  }

  await prisma.study_plans.updateMany({
    where: {
      guest_id: BigInt(guest.id),
      user_id: null,
    },
    data: {
      user_id: BigInt(userId),
      guest_id: null,
    },
  });
}
