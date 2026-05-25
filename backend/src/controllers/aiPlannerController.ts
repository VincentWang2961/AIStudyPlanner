import { Request, Response, NextFunction } from 'express';
import { generateStudyPlan } from '../services/aiPlanner';

export function getAiPlannerDebugStatus(_req: Request, res: Response) {
  const configuredModel = process.env.OPENAI_MODEL || 'gpt-4o';
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY || process.env.LLM_API_KEY);

  return res.status(200).json({
    ok: true,
    data: {
      hasOpenAiKey,
      configuredModel,
      defaultProgramCode: '62510',
      availableEndpoints: {
        generatePlan: '/api/ai/generate-plan (POST)',
        debugStatus: '/api/ai/debug-status (GET)',
        debugGenerate: '/api/ai/debug-generate-plan (POST)',
      },
      supportedInputs: {
        userMessage: 'string (required)',
        programCode: 'string (optional, defaults to 62510)',
        specialisation: 'string (optional)',
        completedUnits: 'string[] (optional)',
        preferredSemesterCount: 'number (optional)',
        unitsPerSemester: 'number (optional)',
        preferences: 'string (optional)',
      },
    },
  });
}

export async function generateStudyPlanResponse(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      userMessage,
      programCode,
      specialisation,
      completedUnits,
      preferredSemesterCount,
      unitsPerSemester,
      startTerm,
      preferences,
    } = req.body ?? {};

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
      specialisation: typeof specialisation === 'string' ? specialisation : undefined,
      completedUnits: Array.isArray(completedUnits) ? completedUnits : undefined,
      preferredSemesterCount: typeof preferredSemesterCount === 'number' ? preferredSemesterCount : undefined,
      unitsPerSemester: typeof unitsPerSemester === 'number' ? unitsPerSemester : undefined,
      startTerm: typeof startTerm === 'string' && (startTerm === 'S1' || startTerm === 'S2') ? startTerm : undefined,
      preferences: typeof preferences === 'string' ? preferences : undefined,
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
