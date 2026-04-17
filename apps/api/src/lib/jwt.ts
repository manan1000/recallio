import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET!;

export type JwtPayload = {
  userId: string;
  email: string;
};

export const signToken = (payload: JwtPayload): string =>
  jwt.sign(payload, SECRET, { expiresIn: "7d" });

export const verifyToken = (token: string): JwtPayload =>
  jwt.verify(token, SECRET) as JwtPayload;