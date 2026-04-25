import express from "express";
import cors from "cors";
import courseRoutes from "./routes/courseRoutes";
import unitRoutes from "./routes/unitRoutes";
import aiPlannerRoutes from "./routes/aiPlannerRoutes";
import errorHandler from "./middlewares/errorHandler";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/courses", courseRoutes);
app.use("/api/units", unitRoutes);
app.use("/api/ai", aiPlannerRoutes);

app.get("/", (_req, res) => {
  res.json({ message: "AI Study Planner backend is running" });
});

app.use(errorHandler);

export default app;
