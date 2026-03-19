import { Request, Response } from 'express';

export default class UnitController {
  // POST /units
  createUnit = async (req: Request, res: Response) => {
    // TODO: implement actual logic
    res.status(201).json({ message: 'Unit created (stub)' });
  };

  // GET /units/:id
  getUnit = async (req: Request, res: Response) => {
    // TODO: implement actual logic
    res.status(200).json({ message: 'Unit fetched (stub)', id: req.params.id });
  };

  // PUT /units/:id
  updateUnit = async (req: Request, res: Response) => {
    // TODO: implement actual logic
    res.status(200).json({ message: 'Unit updated (stub)', id: req.params.id });
  };

  // DELETE /units/:id
  deleteUnit = async (req: Request, res: Response) => {
    // TODO: implement actual logic
    res.status(204).send();
  };
}