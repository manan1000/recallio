import { Router } from "express";
import { presignUpload } from "./uploads.controller";
import { requireAuth } from "../../middleware/auth";

export const uploadsRouter: Router = Router();

uploadsRouter.use(requireAuth);
uploadsRouter.post("/presign", presignUpload);