import { Router } from "express";
import { createGuest, getCurrentUser, login, logout, register } from "../controllers/authController";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", getCurrentUser);
router.post("/guest", createGuest);

export default router;
