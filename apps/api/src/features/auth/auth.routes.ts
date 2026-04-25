import { Router } from "express";
import { register, login, me, googleRedirect, googleCallback, logout } from "./auth.controller";
import { requireAuth } from "../../middleware/auth";
import { authLimiter } from "../../lib/rate-limit";
import { updateProfile } from "./auth.controller";

export const authRouter: Router = Router();

authRouter.post("/register", authLimiter, register);
authRouter.post("/login", authLimiter, login);
authRouter.post("/logout", requireAuth, logout);

authRouter.get("/google", googleRedirect);
authRouter.get("/google/callback", googleCallback);

authRouter.get("/me", requireAuth, me);
authRouter.patch("/profile", requireAuth, updateProfile);