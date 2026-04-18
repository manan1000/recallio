import { Request, Response, NextFunction } from "express";
import { registerSchema, loginSchema } from "./auth.schema";
import { registerUser, loginUser } from "./auth.service";

export const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const input = registerSchema.parse(req.body);
        const result = await registerUser(input);
        res.status(201).json(result);
    } catch (err) {
        next(err);
    }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const input = loginSchema.parse(req.body);
        const result = await loginUser(input);
        res.json(result);
    } catch (err) {
        next(err);
    }
};

export const me = async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.json({ user: req.user });
    } catch (err) {
        next(err);
    }
};