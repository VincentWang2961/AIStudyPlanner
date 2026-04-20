import express, { Request, Response, NextFunction } from "express";
import { json } from "body-parser";
import planRoutes from "./routes/planRoutes";
import chatRoutes from "./routes/chatRoutes";
import unitRoutes from "./routes/unitRoutes";
import aiPlannerRoutes from "./routes/aiPlannerRoutes";

const app = express();
const PORT = 3001;

// Middleware
app.use(json());

// Routes
app.use("/api/plans", planRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/units", unitRoutes);
app.use("/api/ai", aiPlannerRoutes);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
