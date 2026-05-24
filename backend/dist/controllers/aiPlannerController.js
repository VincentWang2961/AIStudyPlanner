"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDebugStudyPlan = void 0;
exports.getAiPlannerDebugStatus = getAiPlannerDebugStatus;
exports.generateStudyPlanResponse = generateStudyPlanResponse;
const aiPlanner_1 = require("../services/aiPlanner");
function getAiPlannerDebugStatus(_req, res) {
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
async function generateStudyPlanResponse(req, res, next) {
    try {
        const { userMessage, programCode, specialisation, completedUnits, preferredSemesterCount, unitsPerSemester, preferences, } = req.body ?? {};
        if (!userMessage || typeof userMessage !== 'string') {
            return res.status(400).json({
                error: 'userMessage is required and must be a string.',
            });
        }
        const effectiveProgramCode = typeof programCode === 'string' && programCode.trim().length > 0
            ? programCode.trim()
            : '62510';
        const plan = await (0, aiPlanner_1.generateStudyPlan)({
            userMessage,
            programCode: effectiveProgramCode,
            specialisation: typeof specialisation === 'string' ? specialisation : undefined,
            completedUnits: Array.isArray(completedUnits) ? completedUnits : undefined,
            preferredSemesterCount: typeof preferredSemesterCount === 'number' ? preferredSemesterCount : undefined,
            unitsPerSemester: typeof unitsPerSemester === 'number' ? unitsPerSemester : undefined,
            preferences: typeof preferences === 'string' ? preferences : undefined,
        });
        return res.status(200).json({
            ok: true,
            data: plan,
        });
    }
    catch (error) {
        return next(error);
    }
}
exports.generateDebugStudyPlan = generateStudyPlanResponse;
