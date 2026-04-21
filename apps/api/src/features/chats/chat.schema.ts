import { z } from "zod";

export const createChatSchema = z.object({
  title: z.string().trim().min(1).optional(),
  documentId: z.string().trim().min(1).optional(),
}).strict();

export const sendMessageSchema = z.object({
  message: z.string().trim().min(1, "Message cannot be empty"),
}).strict();

export type CreateChatInput = z.infer<typeof createChatSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;