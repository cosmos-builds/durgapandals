import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ContributorModel } from "@durgapandals/database";

const blockSchema = z.object({ blocked: z.boolean() });

// The actual answer to "how do I block someone spamming submissions" — a
// blocked contributor's POST /submissions is rejected outright regardless
// of whether OTP verification is required (see submissions.routes.ts).
export function registerContributorsAdminRoutes(app: FastifyInstance) {
  app.patch<{ Params: { id: string } }>("/contributors/:id", async (request, reply) => {
    const body = blockSchema.parse(request.body);
    const contributor = await ContributorModel.findByIdAndUpdate(
      request.params.id,
      { blocked: body.blocked },
      { new: true }
    );
    if (!contributor) return reply.code(404).send({ error: "Contributor not found" });
    return contributor;
  });
}
