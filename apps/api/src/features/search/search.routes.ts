import { Router } from "express";
import { search } from "./search.controller";
import { requireAuth } from "../../middleware/auth";

export const searchRouter: Router = Router();

searchRouter.use(requireAuth);
searchRouter.get("/", search);