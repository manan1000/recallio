import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { RedisStore, RedisReply } from "rate-limit-redis";
import { redis } from "@repo/queue";
import { Request } from "express";
import { failure } from "./response";
import { ERROR_CODES } from "@repo/types";

const createStore = (prefix: string) =>
    new RedisStore({
        sendCommand: (...args: string[]) => redis.call(...args as [string, ...string[]]) as Promise<RedisReply>,
        prefix,
    });

// general API limit — 100 requests per minute per user
export const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    keyGenerator: (req: Request) => req.user?.id ?? ipKeyGenerator(req.ip!) ?? "unknown",
    store: createStore("rl:general:"),
    handler: (_req, res) => {
        return failure(res,ERROR_CODES.RATE_LIMITED,"Too many requests, please slow down");
    },
    skip: (req: Request) => !req.user, // auth routes handle their own limiting
});

// chat limit — 20 requests per minute per user (OpenAI calls)
export const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    keyGenerator: (req: Request) => req.user?.id ?? ipKeyGenerator(req.ip!) ?? "unknown",
    store: createStore("rl:chat:"),
    handler: (_req, res) => {
        return failure(res,ERROR_CODES.RATE_LIMITED,"Too many messages, please wait a moment");
    },
});

// search limit — 30 requests per minute per user
export const searchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    keyGenerator: (req: Request) => req.user?.id ?? ipKeyGenerator(req.ip!) ?? "unknown",
    store: createStore("rl:search:"),
    handler: (_req, res) => {
        return failure(res,ERROR_CODES.RATE_LIMITED,"Too many search requests, please slow down");
    },
});

// auth limit — 10 requests per minute per IP (brute force protection)
export const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: (req: Request) => ipKeyGenerator(req.ip!) ?? "unknown",
    store: createStore("rl:auth:"),
    handler: (_req, res) => {
        return failure(res,ERROR_CODES.RATE_LIMITED,"Too many attempts, please try again later");
    },
});