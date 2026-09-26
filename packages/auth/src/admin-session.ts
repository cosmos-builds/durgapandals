import { SignJWT, jwtVerify } from "jose";
import type { AdminRole } from "@durgapandals/types";

export interface AdminSessionPayload {
  sub: string; // admin user id
  email: string;
  role: AdminRole;
}

const SESSION_TTL = "8h";

export async function signAdminSession(
  payload: AdminSessionPayload,
  secret: string
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(new TextEncoder().encode(secret));
}

export async function verifyAdminSession(
  token: string,
  secret: string
): Promise<AdminSessionPayload> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
  return payload as unknown as AdminSessionPayload;
}
