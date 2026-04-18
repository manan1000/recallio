import { z } from "zod";

export const createDocumentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("LINK"),
    url: z.string().url("Invalid URL"),
    title: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal("YOUTUBE"),
    url: z.string().url("Invalid URL").refine(
      (url) => url.includes("youtube.com") || url.includes("youtu.be"),
      "Must be a YouTube URL"
    ),
    title: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal("NOTE"),
    content: z.string().min(1, "Note content cannot be empty"),
    title: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal("PDF"),
    title: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal("IMAGE"),
    title: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal("DOCUMENT"),
    title: z.string().min(1).optional(),
  }),
]);

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;