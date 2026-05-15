/**
 * Token Usage Tracker
 * 
 * Tracks OpenAI API token consumption per day. Stores usage in PostgreSQL
 * via Prisma for persistence across application restarts.
 * 
 * Also maintains an in-memory cache for fast lookups during a single process lifetime.
 */

import { prisma } from '../../config/prisma';

const DAILY_TOKEN_LIMIT = 1_000_000;  // 1M tokens per day
const MAX_REQUESTS_PER_DAY = 50;

interface DailyUsage {
  date: string;        // YYYY-MM-DD
  tokensUsed: number;
  requestCount: number;
}

// In-memory cache
const usageCache = new Map<string, DailyUsage>();

function getToday(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

async function loadUsageFromDb(date: string): Promise<DailyUsage> {
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

async function saveUsageToDb(usage: DailyUsage): Promise<void> {
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

/**
 * Get the current daily usage, loading from DB cache if not in memory.
 */
export async function getDailyUsage(): Promise<DailyUsage> {
  const today = getToday();

  if (!usageCache.has(today)) {
    const fromDb = await loadUsageFromDb(today);
    usageCache.set(today, fromDb);
  }

  return usageCache.get(today)!;
}

/**
 * Check whether the caller would exceed limits with a given token count.
 * Returns remaining tokens; negative means the limit would be exceeded.
 */
export async function checkRateLimit(estimatedTokens: number): Promise<{
  allowed: boolean;
  dailyTokensRemaining: number;
  dailyRequestsRemaining: number;
  reason?: string;
}> {
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
export async function recordTokenUsage(tokensUsed: number): Promise<void> {
  const today = getToday();
  const current = await getDailyUsage();

  current.tokensUsed += tokensUsed;
  current.requestCount += 1;

  usageCache.set(today, current);
  await saveUsageToDb(current);

  console.log(
    `[tokenTracker] Recorded ${tokensUsed} tokens (daily total: ${current.tokensUsed.toLocaleString()}/${DAILY_TOKEN_LIMIT.toLocaleString()})`,
  );
}

/**
 * Returns the configured daily token limit.
 */
export function getDailyTokenLimit(): number {
  return DAILY_TOKEN_LIMIT;
}

/**
 * Returns the configured max requests per day.
 */
export function getMaxRequestsPerDay(): number {
  return MAX_REQUESTS_PER_DAY;
}

/**
 * Flush the in-memory cache (useful for testing).
 */
export function flushCache(): void {
  usageCache.clear();
}
