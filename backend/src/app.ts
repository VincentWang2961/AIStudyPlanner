import express from "express";
import cors from "cors";
import courseRoutes from "./routes/courseRoutes";
import aiPlannerRoutes from "./routes/aiPlannerRoutes";
import authRoutes from "./routes/authRoutes";
import planRoutes from "./routes/planRoutes";
import plannerRoutes from "./routes/plannerRoutes";
import plannerExportRoutes from "./routes/plannerExport";
import errorHandler from "./middlewares/errorHandler";

const app = express();

const allowedOrigins = (
  process.env.FRONTEND_ORIGIN?.split(",") ?? [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]
)
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
  },
  credentials: true,
}));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/ai", aiPlannerRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/planner", plannerRoutes);
app.use("/api/planner", plannerExportRoutes);

app.get("/", (_req, res) => {
  res.json({ message: "AI Study Planner backend is running" });
});

app.use(errorHandler);

export default app;
