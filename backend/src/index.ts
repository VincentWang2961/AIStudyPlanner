import express, { Request, Response, NextFunction } from "express";
import { json } from "body-parser";
import planRoutes from "./routes/planRoutes";
import chatRoutes from "./routes/chatRoutes";
import unitRoutes from "./routes/unitRoutes";

const app = express();

// Middleware
app.use(json());

// Routes
app.use("/api/plans", planRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/units", unitRoutes);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

export default app;
