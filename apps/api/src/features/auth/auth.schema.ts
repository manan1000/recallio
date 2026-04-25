import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).optional(),
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8).optional(),
}).refine((data) => {
  if (data.newPassword && !data.currentPassword) return false;
  return true;
}, { message: "Current password is required to set a new password" });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;