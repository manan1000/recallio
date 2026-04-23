import { Router } from "express";
import { createDocument, listDocuments, getDocument, getDocumentStatus, deleteDocument, downloadDocument, updateDocument } from "./documents.controller";
import { requireAuth } from "../../middleware/auth";

export const documentsRouter: Router = Router();

documentsRouter.use(requireAuth);

documentsRouter.post("/", createDocument);
documentsRouter.get("/", listDocuments);
documentsRouter.get("/:id", getDocument);
documentsRouter.get("/:id/status", getDocumentStatus);
documentsRouter.patch("/:id", updateDocument);
documentsRouter.delete("/:id", deleteDocument);
documentsRouter.get("/:id/download", downloadDocument);