import bcrypt from "bcryptjs";
import { prisma } from "@repo/db";
import { signToken } from "../../lib/jwt";
import { RegisterInput, LoginInput } from "./auth.schema";

export const registerUser = async (input: RegisterInput) => {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });
  if (existing) throw new Error("Email already in use");

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      password: passwordHash,
      name: input.name,
    },
    select: { id: true, email: true, name: true },
  });

  const token = signToken({ userId: user.id, email: user.email });
  return { user, token };
};

export const loginUser = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });
  if (!user || !user.password) {
    throw new Error("Invalid credentials");
  }

  const valid = await bcrypt.compare(input.password, user.password);
  if (!valid) throw new Error("Invalid credentials");

  const token = signToken({ userId: user.id, email: user.email });
  return {
    user: { id: user.id, email: user.email, name: user.name },
    token,
  };
};

export const getOAuthUser = async (
  provider: string,
  providerId: string,
  data: { email: string; name?: string; avatar?: string }
) => {
  const existing = await prisma.oAuthAccount.findUnique({
    where: { provider_providerId: { provider, providerId } },
    include: { user: true },
  });

  if (existing) {
    const token = signToken({
      userId: existing.user.id,
      email: existing.user.email,
    });
    return { user: existing.user, token };
  }

  // create new user + oauth account
  const user = await prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      avatar: data.avatar,
      oauthAccounts: {
        create: { provider, providerId },
      },
    },
  });

  const token = signToken({ userId: user.id, email: user.email });
  return { user, token };
};