import { Router } from "express";
import { register, login, me, googleRedirect, googleCallback } from "./auth.controller";
import { requireAuth } from "../../middleware/auth";

export const authRouter: Router = Router();

authRouter.post("/register", register);
authRouter.post("/login", login);

authRouter.get("/google", googleRedirect);
authRouter.get("/google/callback", googleCallback);

authRouter.get("/me", requireAuth, me);