import { Router } from "express";
import { register, login, me, googleRedirect, googleCallback } from "./auth.controller";
import { requireAuth } from "../../middleware/auth";
import { authLimiter } from "../../lib/rate-limit";

export const authRouter: Router = Router();

authRouter.post("/register", authLimiter, register);
authRouter.post("/login", authLimiter, login);

authRouter.get("/google", googleRedirect);
authRouter.get("/google/callback", googleCallback);

authRouter.get("/me", requireAuth, me);