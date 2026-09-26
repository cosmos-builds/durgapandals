import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyAdminSession } from "@durgapandals/auth";

// Backend authorization is the real security boundary (spec §20, §21) — this
// guard is what actually protects every admin route, independent of whether
// the admin frontend even renders a link to it.
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return reply.code(401).send({ error: "Missing admin session" });
  }

  try {
    const payload = await verifyAdminSession(token, request.server.env.ADMIN_SESSION_SECRET);
    request.admin = payload;
  } catch {
    return reply.code(401).send({ error: "Invalid or expired session" });
  }
}
