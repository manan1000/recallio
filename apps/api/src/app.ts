import express, { type Express } from "express";
import cors from "cors";
import { errorHandler } from "./middleware/error";
import { authRouter } from "./features/auth/auth.routes";

const app: Express = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    credentials: true,
}));
app.use(express.json());

app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);

export default app;