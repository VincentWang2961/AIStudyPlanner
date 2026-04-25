import express from "express";
import cors from "cors";
import courseRoutes from "./routes/courseRoutes";
import unitRoutes from "./routes/unitRoutes";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/courses", courseRoutes);
app.use("/api/units", unitRoutes);

app.get("/", (_req, res) => {
  res.json({ message: "AI Study Planner backend is running" });
});

export default app;