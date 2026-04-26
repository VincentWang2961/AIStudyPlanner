import crypto from "crypto";
import { promisify } from "util";
import { pool } from "../config/db";

const scryptAsync = promisify(crypto.scrypt);
const PASSWORD_KEY_LENGTH = 64;
const SESSION_COOKIE_NAME = "study_planner_session";
const SESSION_DURATION_DAYS = 7;

export type AuthUser = {
  id: string;
  email: string;
};

type StoredUser = {
  id: string;
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

function sessionExpiry(): Date {
  return new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
}

function toAuthUser(user: { id: string | number; email: string }): AuthUser {
  return {
    id: String(user.id),
    email: user.email,
  };
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
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

export async function registerUser(emailInput: string, password: string): Promise<{ user: AuthUser; sessionToken: string }> {
  const email = normaliseEmail(emailInput);
  validateEmail(email);
  validatePassword(password);

  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = await hashPassword(password, salt);

  try {
    const result = await pool.query(
      `
      INSERT INTO users (email, password_hash, password_salt)
      VALUES ($1, $2, $3)
      RETURNING id, email
      `,
      [email, passwordHash, salt]
    );

    const user = toAuthUser(result.rows[0]);
    const sessionToken = await createSession(user.id);

    return { user, sessionToken };
  } catch (error: any) {
    if (error?.code === "23505") {
      throw Object.assign(new Error("An account already exists for this email address."), { status: 409 });
    }

    throw error;
  }
}

export async function loginUser(emailInput: string, password: string): Promise<{ user: AuthUser; sessionToken: string }> {
  const email = normaliseEmail(emailInput);
  validateEmail(email);

  const result = await pool.query(
    `
    SELECT id, email, password_hash, password_salt
    FROM users
    WHERE email = $1
    `,
    [email]
  );

  const user = result.rows[0] as StoredUser | undefined;
  const invalidError = Object.assign(new Error("Email or password is incorrect."), { status: 401 });

  if (!user) {
    throw invalidError;
  }

  const attemptedHash = await hashPassword(password, user.password_salt);

  if (!safeEqualHex(attemptedHash, user.password_hash)) {
    throw invalidError;
  }

  const sessionToken = await createSession(user.id);

  return {
    user: toAuthUser(user),
    sessionToken,
  };
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);

  await pool.query(
    `
    INSERT INTO user_sessions (user_id, token_hash, expires_at)
    VALUES ($1, $2, $3)
    `,
    [userId, tokenHash, sessionExpiry()]
  );

  return token;
}

export async function getUserBySessionToken(token: string | undefined): Promise<AuthUser | null> {
  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const result = await pool.query(
    `
    SELECT u.id, u.email
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = $1
      AND s.expires_at > NOW()
    `,
    [tokenHash]
  );

  return result.rows[0] ? toAuthUser(result.rows[0]) : null;
}

export async function deleteSession(token: string | undefined): Promise<void> {
  if (!token) {
    return;
  }

  await pool.query(
    `
    DELETE FROM user_sessions
    WHERE token_hash = $1
    `,
    [hashSessionToken(token)]
  );
}
