import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRouter } from "./features/auth/auth.routes";
import { documentsRouter } from "./features/documents/documents.routes";
import { uploadsRouter } from "./features/uploads/uploads.routes";
import { chatRouter } from "./features/chats/chats.routes";
import { searchRouter } from "./features/search/search.routes";
import { generalLimiter } from "./lib/rate-limit";

const app: Express = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
app.use(generalLimiter);

app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/chats", chatRouter);
app.use("/api/search", searchRouter);

export default app;