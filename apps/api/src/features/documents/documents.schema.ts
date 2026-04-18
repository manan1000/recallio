import { z } from "zod";

const optionalTitle = z.string().trim().min(1).optional();

const validUrl = z.string().trim().pipe(
  z.httpUrl({ normalize: true, message: "Must be a valid HTTP or HTTPS URL"})
).refine((url) => {
  try {
    const { hostname } = new URL(url);
    const parts = hostname.split(".");
    const tld = parts[parts.length - 1];
    return (
      parts.length >= 2 &&
      tld !== undefined &&
      tld.length >= 2 &&
      parts.every((part) => part.length > 0)
    );
  } catch {
    return false;
  }
}, "Invalid URL");

const youtubeUrl = validUrl.refine((url) => {
  const { hostname } = new URL(url);
  return ["youtube.com", "www.youtube.com", "youtu.be"].includes(hostname);
}, "Must be a valid YouTube URL");

export const createDocumentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("LINK"),
    url: validUrl,
    title: optionalTitle,
  }).strict(),

  z.object({
    type: z.literal("YOUTUBE"),
    url: youtubeUrl,
    title: optionalTitle,
  }).strict(),

  z.object({
    type: z.literal("NOTE"),
    content: z.string().trim().min(1, "Note content cannot be empty"),
    title: optionalTitle,
  }).strict(),

  z.object({
    type: z.literal("PDF"),
    fileUrl: validUrl,
    fileName: z.string().trim().min(1),
    fileSize: z.number().positive().optional(),
    title: optionalTitle,
  }).strict(),

  z.object({
    type: z.literal("IMAGE"),
    fileUrl: validUrl,
    fileName: z.string().trim().min(1),
    fileSize: z.number().positive().optional(),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
    title: optionalTitle,
  }).strict(),

  z.object({
    type: z.literal("DOCUMENT"),
    fileUrl: validUrl,
    fileName: z.string().trim().min(1),
    fileSize: z.number().positive().optional(),
    title: optionalTitle,
  }).strict(),
]);

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;