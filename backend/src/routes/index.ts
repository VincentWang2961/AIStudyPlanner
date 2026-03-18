import { Router } from 'express';
import planRoutes from './planRoutes';
import chatRoutes from './chatRoutes';
import unitRoutes from './unitRoutes';

const router = Router();

router.use('/plans', planRoutes);
router.use('/chat', chatRoutes);
router.use('/units', unitRoutes);

export default router;