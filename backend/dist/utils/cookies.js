"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCookieValue = getCookieValue;
function getCookieValue(cookieHeader, name) {
    if (!cookieHeader) {
        return undefined;
    }
    const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
    const prefix = `${name}=`;
    const cookie = cookies.find((item) => item.startsWith(prefix));
    if (!cookie) {
        return undefined;
    }
    return decodeURIComponent(cookie.slice(prefix.length));
}
