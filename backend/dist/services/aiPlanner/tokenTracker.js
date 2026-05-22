"use strict";
/**
 * Token Usage Tracker
 *
 * Tracks OpenAI API token consumption per day. Stores usage in PostgreSQL
 * via Prisma for persistence across application restarts.
 *
 * Also maintains an in-memory cache for fast lookups during a single process lifetime.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDailyUsage = getDailyUsage;
exports.checkRateLimit = checkRateLimit;
exports.recordTokenUsage = recordTokenUsage;
exports.getDailyTokenLimit = getDailyTokenLimit;
exports.getMaxRequestsPerDay = getMaxRequestsPerDay;
exports.flushCache = flushCache;
const prisma_1 = require("../../config/prisma");
const DAILY_TOKEN_LIMIT = 1000000; // 1M tokens per day
const MAX_REQUESTS_PER_DAY = 50;
// In-memory cache
const usageCache = new Map();
function getToday() {
    const now = new Date();
    return now.toISOString().slice(0, 10); // "YYYY-MM-DD"
}
async function loadUsageFromDb(date) {
    try {
        const record = await prisma_1.prisma.token_usage.findUnique({
            where: { date },
        });
        if (record) {
            return {
                date: record.date,
                tokensUsed: Number(record.tokens_used),
                requestCount: record.request_count,
            };
        }
    }
    catch (err) {
        console.warn('[tokenTracker] Failed to load usage from DB:', err);
    }
    return { date, tokensUsed: 0, requestCount: 0 };
}
async function saveUsageToDb(usage) {
    try {
        await prisma_1.prisma.token_usage.upsert({
            where: { date: usage.date },
            update: {
                tokens_used: BigInt(usage.tokensUsed),
                request_count: usage.requestCount,
            },
            create: {
                date: usage.date,
                tokens_used: BigInt(usage.tokensUsed),
                request_count: usage.requestCount,
            },
        });
    }
    catch (err) {
        console.warn('[tokenTracker] Failed to save usage to DB:', err);
    }
}
/**
 * Get the current daily usage, loading from DB cache if not in memory.
 */
async function getDailyUsage() {
    const today = getToday();
    if (!usageCache.has(today)) {
        const fromDb = await loadUsageFromDb(today);
        usageCache.set(today, fromDb);
    }
    return usageCache.get(today);
}
/**
 * Check whether the caller would exceed limits with a given token count.
 * Returns remaining tokens; negative means the limit would be exceeded.
 */
async function checkRateLimit(estimatedTokens) {
    const usage = await getDailyUsage();
    const tokensRemaining = DAILY_TOKEN_LIMIT - usage.tokensUsed - estimatedTokens;
    const requestsRemaining = MAX_REQUESTS_PER_DAY - usage.requestCount - 1;
    if (requestsRemaining < 0) {
        return {
            allowed: false,
            dailyTokensRemaining: DAILY_TOKEN_LIMIT - usage.tokensUsed,
            dailyRequestsRemaining: 0,
            reason: `Daily request limit of ${MAX_REQUESTS_PER_DAY} reached. Resets at midnight UTC.`,
        };
    }
    if (tokensRemaining < 0) {
        return {
            allowed: false,
            dailyTokensRemaining: Math.max(0, DAILY_TOKEN_LIMIT - usage.tokensUsed),
            dailyRequestsRemaining: MAX_REQUESTS_PER_DAY - usage.requestCount,
            reason: `Daily token limit of ${DAILY_TOKEN_LIMIT.toLocaleString()} exceeded or would be exceeded. Resets at midnight UTC.`,
        };
    }
    return {
        allowed: true,
        dailyTokensRemaining: DAILY_TOKEN_LIMIT - usage.tokensUsed,
        dailyRequestsRemaining: MAX_REQUESTS_PER_DAY - usage.requestCount,
    };
}
/**
 * Record token consumption after a successful API call.
 * Token count should come from the OpenAI API response (usage.total_tokens).
 */
async function recordTokenUsage(tokensUsed) {
    const today = getToday();
    const current = await getDailyUsage();
    current.tokensUsed += tokensUsed;
    current.requestCount += 1;
    usageCache.set(today, current);
    await saveUsageToDb(current);
    console.log(`[tokenTracker] Recorded ${tokensUsed} tokens (daily total: ${current.tokensUsed.toLocaleString()}/${DAILY_TOKEN_LIMIT.toLocaleString()})`);
}
/**
 * Returns the configured daily token limit.
 */
function getDailyTokenLimit() {
    return DAILY_TOKEN_LIMIT;
}
/**
 * Returns the configured max requests per day.
 */
function getMaxRequestsPerDay() {
    return MAX_REQUESTS_PER_DAY;
}
/**
 * Flush the in-memory cache (useful for testing).
 */
function flushCache() {
    usageCache.clear();
}
