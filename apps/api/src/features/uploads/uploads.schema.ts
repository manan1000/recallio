import { z } from "zod";

export const presignSchema = z.object({
    fileName: z.string().trim().min(1),
    mimeType: z.string().trim().min(1),
    fileSize: z.number().positive(),
}).strict();