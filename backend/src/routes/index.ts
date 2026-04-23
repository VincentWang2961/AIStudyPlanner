import { Router } from 'express';
import planRoutes from './planRoutes';
import chatRoutes from './chatRoutes';
import unitRoutes from './unitRoutes';
import aiPlannerRoutes from './aiPlannerRoutes';

const router = Router();

router.use('/plans', planRoutes);
router.use('/chat', chatRoutes);
router.use('/units', unitRoutes);
router.use('/ai', aiPlannerRoutes);

export default router;