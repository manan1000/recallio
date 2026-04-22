import { Request, Response } from "express";
import { createPresignedUpload } from "@repo/storage";
import { presignSchema } from "./uploads.schema";
import { success, failure, validationFailure } from "../../lib/response";
import { ERROR_CODES } from "@repo/types";

export const presignUpload = async (req: Request, res: Response) => {
    try {
        const parsed = presignSchema.safeParse(req.body);
        if (!parsed.success) {
            return validationFailure(res, parsed.error);
        }

        const { fileName, mimeType, fileSize } = parsed.data;

        const result = await createPresignedUpload(
            req.user!.id,
            fileName,
            mimeType,
            fileSize
        );

        return success(res, result);
    } catch (err: any) {
        if (err.message === "File type not supported" || err.message === "File size exceeds 20MB limit") {
            return failure(res, ERROR_CODES.VALIDATION_ERROR, err.message);
        }
        console.error(err);
        return failure(res, ERROR_CODES.INTERNAL_ERROR, "Something went wrong");
    }
};