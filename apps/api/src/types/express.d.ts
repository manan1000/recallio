import type { User } from "@repo/db";

declare global {
  namespace Express {
    interface Request {
      user?: Pick<User, "id" | "email" | "name">;
    }
  }
}