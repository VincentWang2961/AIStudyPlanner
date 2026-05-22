"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const courseRoutes_1 = __importDefault(require("./routes/courseRoutes"));
const aiPlannerRoutes_1 = __importDefault(require("./routes/aiPlannerRoutes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const planRoutes_1 = __importDefault(require("./routes/planRoutes"));
const plannerRoutes_1 = __importDefault(require("./routes/plannerRoutes"));
const plannerExport_1 = __importDefault(require("./routes/plannerExport"));
const errorHandler_1 = __importDefault(require("./middlewares/errorHandler"));
const app = (0, express_1.default)();
const allowedOrigins = (process.env.FRONTEND_ORIGIN?.split(",") ?? [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
])
    .map((origin) => origin.trim())
    .filter(Boolean);
app.use((0, cors_1.default)({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    credentials: true,
}));
app.use(express_1.default.json());
app.use("/api/auth", authRoutes_1.default);
app.use("/api/plans", planRoutes_1.default);
app.use("/api/ai", aiPlannerRoutes_1.default);
app.use("/api/courses", courseRoutes_1.default);
app.use("/api/planner", plannerRoutes_1.default);
app.use("/api/planner", plannerExport_1.default);
app.get("/", (_req, res) => {
    res.json({ message: "AI Study Planner backend is running" });
});
app.use(errorHandler_1.default);
exports.default = app;
