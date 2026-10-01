import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { BlockedIpModel } from "@durgapandals/database";

const createSchema = z.object({
  ip: z.string().min(3).max(64),
  reason: z.enum(["SPAM_LIKES", "SPAM_SUBMISSIONS", "ABUSE", "SCRAPING", "OTHER"]),
  notes: z.string().max(1000).optional(),
  // ISO date string — omitted means a permanent block.
  expiresAt: z.string().datetime().optional(),
});

// The actual enforcement point lives in server.ts's global onRequest hook
// (checkBlockedIp) — this is just the admin CRUD for managing the list it
// reads from.
export function registerBlockedIpsAdminRoutes(app: FastifyInstance) {
  app.get("/blocked-ips", async () => {
    return BlockedIpModel.find().sort({ createdAt: -1 });
  });

  app.post("/blocked-ips", async (request, reply) => {
    const body = createSchema.parse(request.body);
    const existing = await BlockedIpModel.findOne({ ip: body.ip });
    if (existing) return reply.code(409).send({ error: "This IP is already blocked" });

    const blocked = await BlockedIpModel.create({
      ip: body.ip,
      reason: body.reason,
      notes: body.notes,
      blockedBy: request.admin!.email,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });
    return reply.code(201).send(blocked);
  });

  app.delete<{ Params: { id: string } }>("/blocked-ips/:id", async (request, reply) => {
    const deleted = await BlockedIpModel.findByIdAndDelete(request.params.id);
    if (!deleted) return reply.code(404).send({ error: "Blocked IP not found" });
    return { unblocked: true };
  });
}
