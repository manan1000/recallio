import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";
import { prisma } from "@repo/db";

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies.auth_token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
        const payload = verifyToken(token);
        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: { id: true, email: true, name: true },
        });
        if (!user) return res.status(401).json({ error: "User not found" });
        req.user = user;
        next();
    } catch {
        res.status(401).json({ error: "Invalid or expired token" });
    }
};