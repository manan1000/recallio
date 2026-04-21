import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "@repo/db";
import { signToken } from "../../lib/jwt";
import { registerSchema, loginSchema } from "./auth.schema";
import { google } from "../../lib/oauth2";
import { generateState, generateCodeVerifier, decodeIdToken } from "arctic";

export const register = async (req: Request, res: Response) => {
    try {
        const parsed = registerSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: {
                    issue: parsed.error.issues[0]?.path[0],
                    message: parsed.error.issues[0]?.message
                }
            });
        }

        const { email, password, name } = parsed.data;

        //TODO 
        // Sanitate the inputs remove spaces 

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return res.status(409).json({ error: "An account with this email already exists" });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                email,
                password: passwordHash,
                name: name?.trim()
            },
            select: { id: true, email: true, name: true },
        });

        const token = signToken({ userId: user.id, email: user.email });
        return res.status(201).json({ token, user });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Something went wrong" });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: {
                    issue: parsed.error.issues[0]?.path[0],
                    message: parsed.error.issues[0]?.message
                }
            });
        }

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.password) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = signToken({ userId: user.id, email: user.email });
        return res.status(200).json({
            token,
            user: { id: user.id, email: user.email, name: user.name },
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Something went wrong" });
    }
};



export const oauthCallback = async (provider: string, providerId: string, data: { email: string; name?: string; avatar?: string }, res: Response) => {
    try {
        // Step 1 — check if OAuth account already exists
        const existingOAuth = await prisma.oAuthAccount.findUnique({
            where: { provider_providerId: { provider, providerId } },
            include: {
                user: { select: { id: true, email: true, name: true } }
            },
        });

        if (existingOAuth) {
            const token = signToken({ userId: existingOAuth.user.id, email: existingOAuth.user.email });
            return res.status(200).json({
                token,
                user: {
                    id: existingOAuth.user.id,
                    email: existingOAuth.user.email,
                    name: existingOAuth.user.name,
                },
            });
        }

        // Step 2 — check if user with this email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (existingUser) {
            // Step 3a — attach OAuth account to existing user
            await prisma.oAuthAccount.create({
                data: {
                    provider,
                    providerId,
                    userId: existingUser.id
                }
            });

            const token = signToken({ userId: existingUser.id, email: existingUser.email });
            return res.status(200).json({
                token,
                user: {
                    id: existingUser.id,
                    email: existingUser.email,
                    name: existingUser.name,
                },
            });
        }

        // Step 3b — create new user + OAuth account
        const newUser = await prisma.user.create({
            data: {
                email: data.email,
                name: data.name,
                avatar: data.avatar,
                oauthAccounts: {
                    create: { provider, providerId },
                },
            },
            select: { id: true, email: true, name: true },
        });

        const token = signToken({ userId: newUser.id, email: newUser.email });
        return res.status(201).json({ token, user: newUser });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Something went wrong" });
    }
};

// ── Google ──────────────────────────────────────────────

export const googleRedirect = async (req: Request, res: Response) => {
    try {
        const state = generateState();
        const codeVerifier = generateCodeVerifier();

        // store state + verifier in cookies to validate on callback
        res.cookie("google_oauth_state", state, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 10 * 1000, // 10 minutes
        });
        res.cookie("google_code_verifier", codeVerifier, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 10 * 1000,
        });

        const url = google.createAuthorizationURL(state, codeVerifier, [
            "openid",
            "profile",
            "email",
        ]);

        return res.redirect(url.toString());
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Something went wrong" });
    }
};

export const googleCallback = async (req: Request, res: Response) => {
    try {
        const { code, state } = req.query as { code: string; state: string };
        const storedState = req.cookies.google_oauth_state;
        const codeVerifier = req.cookies.google_code_verifier;

        // validate state to prevent CSRF
        if (!code || !state || state !== storedState || !codeVerifier) {
            return res.status(400).json({ error: "Invalid OAuth state" });
        }

        const tokens = await google.validateAuthorizationCode(code, codeVerifier);
        const idToken = tokens.idToken();
        const claims = decodeIdToken(idToken) as {
            sub: string;
            email: string;
            name?: string;
            picture?: string;
        };
        // (provider: string, providerId: string, data: { email: string; name?: string; avatar?: string }, res: Response)
        return oauthCallback(
            "google",
            claims.sub,
            {
                email: claims.email,
                name: claims.name,
                avatar: claims.picture,
            },
            res
        );
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Something went wrong" });
    }
};

export const me = async (req: Request, res: Response) => {
    try {
        return res.status(200).json({ user: req.user });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Something went wrong" });
    }
};