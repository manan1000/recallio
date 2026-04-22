import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";
import { prisma } from "@repo/db";
import { failure } from "../lib/response";
import { ERROR_CODES } from "@repo/types";

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies.auth_token;
    if (!token) return failure(res, ERROR_CODES.UNAUTHORIZED, "Unauthorized");

    try {
        const payload = verifyToken(token);
        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: { id: true, email: true, name: true },
        });
        if (!user) return failure(res, ERROR_CODES.UNAUTHORIZED, "User not found");
        req.user = user;
        next();
    } catch {
        return failure(res, ERROR_CODES.UNAUTHORIZED, "Invalid token");
    }
};