import { Router } from 'express';
import { generateDebugStudyPlan, getAiPlannerDebugStatus } from '../controllers/aiPlannerController';

const router = Router();

// Reports runtime configuration relevant to AI planning.
router.get('/debug-status', getAiPlannerDebugStatus);

// Debug endpoint for browser-console testing before frontend integration.
router.post('/debug-generate-plan', generateDebugStudyPlan);

export default router;
