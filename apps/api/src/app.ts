import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { authRouter } from "./features/auth/auth.routes";
import { documentsRouter } from "./features/documents/documents.routes";
import { uploadsRouter } from "./features/uploads/uploads.routes";
const app: Express = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/uploads", uploadsRouter);

export default app;