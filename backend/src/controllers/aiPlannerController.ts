import { Request, Response, NextFunction } from 'express';
import { generateStudyPlan } from '../services/aiPlanner';

export async function generateDebugStudyPlan(req: Request, res: Response, next: NextFunction) {
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
    });

    return res.status(200).json({
      ok: true,
      data: plan,
    });
  } catch (error) {
    return next(error);
  }
}
