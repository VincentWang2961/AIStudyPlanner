"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionCookieName = getSessionCookieName;
exports.getGuestCookieName = getGuestCookieName;
exports.buildSessionCookie = buildSessionCookie;
exports.buildExpiredSessionCookie = buildExpiredSessionCookie;
exports.buildGuestCookie = buildGuestCookie;
exports.buildExpiredGuestCookie = buildExpiredGuestCookie;
exports.registerUser = registerUser;
exports.loginUser = loginUser;
exports.createSession = createSession;
exports.getUserBySessionToken = getUserBySessionToken;
exports.deleteSession = deleteSession;
exports.createGuestSession = createGuestSession;
exports.getGuestByToken = getGuestByToken;
exports.migrateGuestPlansToUser = migrateGuestPlansToUser;
const crypto_1 = __importDefault(require("crypto"));
const util_1 = require("util");
const prisma_1 = require("../config/prisma");
const scryptAsync = (0, util_1.promisify)(crypto_1.default.scrypt);
const PASSWORD_KEY_LENGTH = 64;
const SESSION_COOKIE_NAME = "study_planner_session";
const GUEST_COOKIE_NAME = "study_planner_guest";
const SESSION_DURATION_DAYS = 7;
const GUEST_DURATION_DAYS = 90;
function normaliseEmail(email) {
    return email.trim().toLowerCase();
}
function validateEmail(email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw Object.assign(new Error("Enter a valid email address."), { status: 400 });
    }
}
function validatePassword(password) {
    if (password.length < 8) {
        throw Object.assign(new Error("Password must be at least 8 characters."), { status: 400 });
    }
}
async function hashPassword(password, salt) {
    const key = await scryptAsync(password, salt, PASSWORD_KEY_LENGTH);
    return key.toString("hex");
}
function safeEqualHex(left, right) {
    const leftBuffer = Buffer.from(left, "hex");
    const rightBuffer = Buffer.from(right, "hex");
    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }
    return crypto_1.default.timingSafeEqual(leftBuffer, rightBuffer);
}
function hashSessionToken(token) {
    return crypto_1.default.createHash("sha256").update(token).digest("hex");
}
function daysFromNow(days) {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
function toAuthUser(user) {
    return {
        id: String(user.id),
        email: user.email,
    };
}
function getSessionCookieName() {
    return SESSION_COOKIE_NAME;
}
function getGuestCookieName() {
    return GUEST_COOKIE_NAME;
}
function buildSessionCookie(token) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    const maxAge = SESSION_DURATION_DAYS * 24 * 60 * 60;
    return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}
function buildExpiredSessionCookie() {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    return `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}
function buildGuestCookie(token) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    const maxAge = GUEST_DURATION_DAYS * 24 * 60 * 60;
    return `${GUEST_COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}
function buildExpiredGuestCookie() {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    return `${GUEST_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}
async function registerUser(emailInput, password) {
    const email = normaliseEmail(emailInput);
    validateEmail(email);
    validatePassword(password);
    const salt = crypto_1.default.randomBytes(16).toString("hex");
    const passwordHash = await hashPassword(password, salt);
    try {
        const createdUser = await prisma_1.prisma.users.create({
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
    }
    catch (error) {
        if (error?.code === "P2002") {
            throw Object.assign(new Error("An account already exists for this email address."), { status: 409 });
        }
        throw error;
    }
}
async function loginUser(emailInput, password) {
    const email = normaliseEmail(emailInput);
    validateEmail(email);
    const user = await prisma_1.prisma.users.findUnique({
        where: { email },
        select: {
            id: true,
            email: true,
            password_hash: true,
            password_salt: true,
        },
    });
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
async function createSession(userId) {
    const token = crypto_1.default.randomBytes(32).toString("base64url");
    const tokenHash = hashSessionToken(token);
    await prisma_1.prisma.user_sessions.create({
        data: {
            user_id: BigInt(userId),
            token_hash: tokenHash,
            expires_at: daysFromNow(SESSION_DURATION_DAYS),
        },
    });
    return token;
}
async function getUserBySessionToken(token) {
    if (!token) {
        return null;
    }
    const tokenHash = hashSessionToken(token);
    const session = await prisma_1.prisma.user_sessions.findFirst({
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
async function deleteSession(token) {
    if (!token) {
        return;
    }
    await prisma_1.prisma.user_sessions.deleteMany({
        where: {
            token_hash: hashSessionToken(token),
        },
    });
}
async function createGuestSession() {
    const token = crypto_1.default.randomBytes(32).toString("base64url");
    const guest = await prisma_1.prisma.guest_sessions.create({
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
async function getGuestByToken(token) {
    if (!token) {
        return null;
    }
    const guest = await prisma_1.prisma.guest_sessions.updateMany({
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
    const session = await prisma_1.prisma.guest_sessions.findUnique({
        where: {
            token_hash: hashSessionToken(token),
        },
        select: {
            id: true,
        },
    });
    return session ? { id: String(session.id) } : null;
}
async function migrateGuestPlansToUser(guestToken, userId) {
    const guest = await getGuestByToken(guestToken);
    if (!guest) {
        return;
    }
    await prisma_1.prisma.study_plans.updateMany({
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
