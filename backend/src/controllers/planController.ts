import { Request, Response } from 'express';

export default class PlanController {
  // POST /plans
  createPlan = async (req: Request, res: Response) => {
    // TODO: implement actual logic
    res.status(201).json({ message: 'Plan created (stub)' });
  };

  // GET /plans/:id
  getPlan = async (req: Request, res: Response) => {
    // TODO: implement actual logic
    res.status(200).json({ message: 'Plan fetched (stub)', id: req.params.id });
  };

  // PUT /plans/:id
  updatePlan = async (req: Request, res: Response) => {
    // TODO: implement actual logic
    res.status(200).json({ message: 'Plan updated (stub)', id: req.params.id });
  };

  // DELETE /plans/:id
  deletePlan = async (req: Request, res: Response) => {
    // TODO: implement actual logic
    res.status(204).send();
  };
}