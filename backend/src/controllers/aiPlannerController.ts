import { Request, Response, NextFunction } from 'express';
import { generateStudyPlan } from '../services/aiPlanner';
import { buildUsageKey } from '../services/aiPlanner/tokenUsageService';
import { getCookieValue } from '../utils/cookies';

function getClientUsageKey(req: Request): string {
  const sessionToken = getCookieValue(req.headers.cookie, 'study_planner_session');
  const forwardedFor = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(',')[0]?.trim() || req.ip;

  return buildUsageKey([
    sessionToken ? `session:${sessionToken}` : undefined,
    ip ? `ip:${ip}` : undefined,
    req.headers['user-agent'],
  ]);
}

export function getAiPlannerDebugStatus(_req: Request, res: Response) {
  const configuredModel = process.env.OPENAI_MODEL || 'gpt-5.4';
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY || process.env.LLM_API_KEY);

  return res.status(200).json({
    ok: true,
    data: {
      hasOpenAiKey,
      configuredModel,
      defaultProgramCode: '62510',
    },
  });
}

export async function generateStudyPlanResponse(req: Request, res: Response, next: NextFunction) {
  try {
    const { userMessage, programCode } = req.body ?? {};

    if (!userMessage || typeof userMessage !== 'string') {
      return res.status(400).json({
        error: 'userMessage is required and must be a string.',
      });
    }

    const effectiveProgramCode = typeof programCode === 'string' && programCode.trim().length > 0
      ? programCode.trim()
      : '62510';

    const plan = await generateStudyPlan({
      userMessage,
      programCode: effectiveProgramCode,
      usageKey: getClientUsageKey(req),
    });

    return res.status(200).json({
      ok: true,
      data: plan,
    });
  } catch (error) {
    return next(error);
  }
}

export const generateDebugStudyPlan = generateStudyPlanResponse;
