import { Router } from "express";
import { search } from "./search.controller";
import { requireAuth } from "../../middleware/auth";
import { searchLimiter } from "../../lib/rate-limit";

export const searchRouter: Router = Router();

searchRouter.use(requireAuth);
searchRouter.use(searchLimiter);

searchRouter.get("/", search);