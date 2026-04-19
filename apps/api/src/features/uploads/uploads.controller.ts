import { Request, Response } from "express";
import { createPresignedUpload } from "@repo/storage";
import { presignSchema } from "./uploads.schema";

export const presignUpload = async (req: Request, res: Response) => {
    try {
        const parsed = presignSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: {
                    issue: parsed.error.issues[0]?.path[0],
                    message: parsed.error.issues[0]?.message
                }
            });
        }

        const { fileName, mimeType, fileSize } = parsed.data;

        const result = await createPresignedUpload(
            req.user!.id,
            fileName,
            mimeType,
            fileSize
        );

        return res.json(result);
    } catch (err: any) {
        if (err.message === "File type not supported" || err.message === "File size exceeds 20MB limit") {
            return res.status(400).json({ error: err.message });
        }
        console.error(err);
        return res.status(500).json({ error: "Something went wrong" });
    }
};