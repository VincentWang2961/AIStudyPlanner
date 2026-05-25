/**
 * Token Usage Tracker
 *
 * Tracks API token consumption per day. Stores usage in PostgreSQL
 * via Prisma for persistence across application restarts.
 */

import { prisma } from '../../config/prisma';

const DAILY_TOKEN_LIMIT = 10_000_000; // 10M tokens per day
const MAX_REQUESTS_PER_DAY = 50;

// In-memory cache
const usageCache = new Map<string, { date: string; tokensUsed: number; requestCount: number }>();

function getToday(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

async function loadUsageFromDb(date: string) {
  try {
    const record = await prisma.token_usage.findUnique({
      where: { date },
    });
    if (record) {
      return {
        date: record.date,
        tokensUsed: Number(record.tokens_used),
        requestCount: record.request_count,
      };
    }
  } catch (err) {
    console.warn('[tokenTracker] Failed to load usage from DB:', err);
  }
  return { date, tokensUsed: 0, requestCount: 0 };
}

async function saveUsageToDb(usage: { date: string; tokensUsed: number; requestCount: number }) {
  try {
    await prisma.token_usage.upsert({
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
  } catch (err) {
    console.warn('[tokenTracker] Failed to save usage to DB:', err);
  }
}

export async function getDailyUsage() {
  const today = getToday();
  if (!usageCache.has(today)) {
    const fromDb = await loadUsageFromDb(today);
    usageCache.set(today, fromDb);
  }
  return usageCache.get(today)!;
}

interface RateLimitResult {
  allowed: boolean;
  dailyTokensRemaining: number;
  dailyRequestsRemaining: number;
  reason?: string;
}

export async function checkRateLimit(estimatedTokens: number): Promise<RateLimitResult> {
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
      reason: `Daily token limit of ${DAILY_TOKEN_LIMIT.toLocaleString()} exceeded. Resets at midnight UTC.`,
    };
  }

  return {
    allowed: true,
    dailyTokensRemaining: DAILY_TOKEN_LIMIT - usage.tokensUsed,
    dailyRequestsRemaining: MAX_REQUESTS_PER_DAY - usage.requestCount,
  };
}

export async function recordTokenUsage(tokensUsed: number) {
  const today = getToday();
  const current = await getDailyUsage();
  current.tokensUsed += tokensUsed;
  current.requestCount += 1;
  usageCache.set(today, current);
  await saveUsageToDb(current);
}

export function getDailyTokenLimit(): number {
  return DAILY_TOKEN_LIMIT;
}

export function getMaxRequestsPerDay(): number {
  return MAX_REQUESTS_PER_DAY;
}

export function flushCache() {
  usageCache.clear();
}
