import { Router } from 'express';
import { generateDebugStudyPlan } from '../controllers/aiPlannerController';

const router = Router();

// Debug endpoint for browser-console testing before frontend integration.
router.post('/debug-generate-plan', generateDebugStudyPlan);

export default router;
