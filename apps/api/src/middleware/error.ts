import { Request, Response, NextFunction } from "express";
import { failure } from "../lib/response";
import { ERROR_CODES } from "@repo/types";

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error("Unhandled error:", err.stack);
  return failure(res, ERROR_CODES.INTERNAL_ERROR, "Something went wrong");
};