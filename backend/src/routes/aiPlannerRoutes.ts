import { Router } from 'express';
import {
  generateDebugStudyPlan,
  generateStudyPlanResponse,
  getAiPlannerDebugStatus,
} from '../controllers/aiPlannerController';

const router = Router();

// Reports runtime configuration relevant to AI planning.
router.get('/debug-status', getAiPlannerDebugStatus);

// Main endpoint used by the planner UI.
router.post('/generate-plan', generateStudyPlanResponse);

// Debug endpoint for browser-console testing before frontend integration.
router.post('/debug-generate-plan', generateDebugStudyPlan);

export default router;
