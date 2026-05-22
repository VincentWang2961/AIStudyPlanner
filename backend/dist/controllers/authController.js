"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.logout = logout;
exports.getCurrentUser = getCurrentUser;
exports.createGuest = createGuest;
const authService_1 = require("../services/authService");
const cookies_1 = require("../utils/cookies");
function getCredentials(req) {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string") {
        throw Object.assign(new Error("Email and password are required."), { status: 400 });
    }
    return { email, password };
}
async function register(req, res, next) {
    try {
        const { email, password } = getCredentials(req);
        const { user, sessionToken } = await (0, authService_1.registerUser)(email, password);
        await (0, authService_1.migrateGuestPlansToUser)((0, cookies_1.getCookieValue)(req.headers.cookie, (0, authService_1.getGuestCookieName)()), user.id);
        res.setHeader("Set-Cookie", [(0, authService_1.buildSessionCookie)(sessionToken), (0, authService_1.buildExpiredGuestCookie)()]);
        return res.status(201).json({
            ok: true,
            user,
        });
    }
    catch (error) {
        return next(error);
    }
}
async function login(req, res, next) {
    try {
        const { email, password } = getCredentials(req);
        const { user, sessionToken } = await (0, authService_1.loginUser)(email, password);
        await (0, authService_1.migrateGuestPlansToUser)((0, cookies_1.getCookieValue)(req.headers.cookie, (0, authService_1.getGuestCookieName)()), user.id);
        res.setHeader("Set-Cookie", [(0, authService_1.buildSessionCookie)(sessionToken), (0, authService_1.buildExpiredGuestCookie)()]);
        return res.status(200).json({
            ok: true,
            user,
        });
    }
    catch (error) {
        return next(error);
    }
}
async function logout(req, res, next) {
    try {
        await (0, authService_1.deleteSession)((0, cookies_1.getCookieValue)(req.headers.cookie, (0, authService_1.getSessionCookieName)()));
        res.setHeader("Set-Cookie", (0, authService_1.buildExpiredSessionCookie)());
        return res.status(200).json({
            ok: true,
        });
    }
    catch (error) {
        return next(error);
    }
}
async function getCurrentUser(req, res, next) {
    try {
        const user = await (0, authService_1.getUserBySessionToken)((0, cookies_1.getCookieValue)(req.headers.cookie, (0, authService_1.getSessionCookieName)()));
        return res.status(200).json({
            ok: true,
            user,
        });
    }
    catch (error) {
        return next(error);
    }
}
async function createGuest(req, res, next) {
    try {
        const guest = await (0, authService_1.createGuestSession)();
        res.setHeader("Set-Cookie", (0, authService_1.buildGuestCookie)(guest.token));
        return res.status(201).json({
            ok: true,
            guest: {
                id: guest.id,
            },
        });
    }
    catch (error) {
        return next(error);
    }
}
