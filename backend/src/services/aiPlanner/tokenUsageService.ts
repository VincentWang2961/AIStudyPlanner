import crypto from 'crypto';
import { pool } from '../../config/db';

export const DAILY_TOKEN_LIMIT = 1_000_000;

export function buildUsageKey(parts: Array<string | undefined>): string {
  const source = parts.find((part) => part && part.trim().length > 0) ?? 'anonymous';
  return crypto.createHash('sha256').update(source).digest('hex');
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getTokensUsedToday(usageKey: string): Promise<number> {
  const result = await pool.query(
    `
    SELECT tokens_used
    FROM ai_token_usage
    WHERE usage_key = $1
      AND usage_date = $2
    `,
    [usageKey, todayUtc()]
  );

  return Number(result.rows[0]?.tokens_used ?? 0);
}

export async function assertDailyTokenBudget(usageKey: string, requestedTokens: number): Promise<void> {
  const usedToday = await getTokensUsedToday(usageKey);

  if (usedToday + requestedTokens > DAILY_TOKEN_LIMIT) {
    const remaining = Math.max(0, DAILY_TOKEN_LIMIT - usedToday);
    throw Object.assign(
      new Error(`Daily AI token limit exceeded. Remaining tokens today: ${remaining}.`),
      { status: 429 }
    );
  }
}

export async function recordTokenUsage(usageKey: string, tokensUsed: number): Promise<void> {
  if (tokensUsed <= 0) {
    return;
  }

  await pool.query(
    `
    INSERT INTO ai_token_usage (usage_key, usage_date, tokens_used)
    VALUES ($1, $2, $3)
    ON CONFLICT (usage_key, usage_date) DO UPDATE SET
      tokens_used = ai_token_usage.tokens_used + EXCLUDED.tokens_used,
      updated_at = NOW()
    `,
    [usageKey, todayUtc(), tokensUsed]
  );
}
