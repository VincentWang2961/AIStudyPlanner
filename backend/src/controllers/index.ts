import { Router } from 'express';
import PlanController from './planController';
import ChatController from './chatController';
import UnitController from './unitController';

const router = Router();

const planController = new PlanController();
const chatController = new ChatController();
const unitController = new UnitController();

// Planning routes
router.post('/plans', planController.createPlan);
router.get('/plans/:id', planController.getPlan);
router.put('/plans/:id', planController.updatePlan);
router.delete('/plans/:id', planController.deletePlan);

// Chat routes
router.post('/chat', chatController.handleChat);
router.get('/chat/history', chatController.getChatHistory);

// Unit routes
router.post('/units', unitController.createUnit);
router.get('/units/:id', unitController.getUnit);
router.put('/units/:id', unitController.updateUnit);
router.delete('/units/:id', unitController.deleteUnit);

export default router;