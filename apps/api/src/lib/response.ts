import { Response } from "express";
import { ZodError } from "zod";
import { ErrorCode, ERROR_CODES } from "@repo/types";

// maps each error code to its HTTP status code
// one place to change status codes — never hardcode them in controllers
export const ERROR_STATUS: Record<ErrorCode, number> = {
    VALIDATION_ERROR: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    RATE_LIMITED: 429,
    INTERNAL_ERROR: 500,
    NOT_IMPLEMENTED: 501,
};

// success — wraps any data in the success envelope
// status defaults to 200, pass 201 for created resources
export const success = <T>(res: Response, data: T, status = 200): Response => {
    return res.status(status).json({
        success: true,
        data,
    });
};

// failure — wraps any error in the error envelope
// looks up the HTTP status from ERROR_STATUS automatically
export const failure = (res: Response, code: ErrorCode, message: string): Response => {
    return res.status(ERROR_STATUS[code]).json({
        success: false,
        error: { message, code },
    });
};

// validationFailure — specific helper for Zod parse errors
// formats ZodError into { field, message } pairs
export const validationFailure = (res: Response, error: ZodError): Response => {
    return res.status(ERROR_STATUS[ERROR_CODES.VALIDATION_ERROR]).json({
        success: false,
        error: {
            message: "Validation failed",
            code: ERROR_CODES.VALIDATION_ERROR,
            fields: error.issues.map((e) => ({
                field: String(e.path[0] ?? "unknown"),
                message: e.message,
            })),
        },
    });
};