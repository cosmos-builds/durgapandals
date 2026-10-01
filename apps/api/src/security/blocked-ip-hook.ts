import type { FastifyReply, FastifyRequest } from "fastify";
import { BlockedIpModel } from "@durgapandals/database";

// Runs before every route except /health and the /admin panel itself — an
// admin who mistakenly blocks their own office/home IP must still be able
// to reach the one place that can undo it. Reads the list admins manage
// from apps/api/src/admin/blocked-ips.admin-routes.ts.
export async function checkBlockedIp(request: FastifyRequest, reply: FastifyReply) {
  if (request.url === "/health" || request.url.startsWith("/admin")) return;

  const blocked = await BlockedIpModel.findOne({ ip: request.ip });
  if (!blocked) return;
  // An expired temporary block is a no-op, not a dangling permanent one —
  // left in place for the admin's own record rather than auto-deleted.
  if (blocked.expiresAt && blocked.expiresAt.getTime() < Date.now()) return;

  return reply.code(403).send({ error: "Access blocked", reason: blocked.reason });
}
