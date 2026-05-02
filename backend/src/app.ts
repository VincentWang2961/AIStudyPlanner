import express from "express";
import cors from "cors";
import courseRoutes from "./routes/courseRoutes";
import unitRoutes from "./routes/unitRoutes";
import aiPlannerRoutes from "./routes/aiPlannerRoutes";
import authRoutes from "./routes/authRoutes";
import planRoutes from "./routes/planRoutes";
import errorHandler from "./middlewares/errorHandler";

const app = express();

const allowedOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

app.use(cors({
  origin: allowedOrigin,
  credentials: true,
}));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/units", unitRoutes);
app.use("/api/ai", aiPlannerRoutes);

app.get("/", (_req, res) => {
  res.json({ message: "AI Study Planner backend is running" });
});

app.use(errorHandler);

export default app;
