import type { FastifyPluginAsync } from "fastify";
import { reactionToggleSchema } from "@durgapandals/validation";
import { ReactionModel } from "@durgapandals/database";

export const reactionsRoutes: FastifyPluginAsync = async (app) => {
  // Tight limit on top of the global one — likes are the cheapest thing to
  // spam (spec §13.4).
  await app.register(import("@fastify/rate-limit"), {
    max: 20,
    timeWindow: "1 minute",
  });

  app.post("/toggle", async (request, reply) => {
    const body = reactionToggleSchema.parse(request.body);

    const existing = await ReactionModel.findOne({
      pandalYearId: body.pandalYearId,
      anonymousVisitorId: body.anonymousVisitorId,
    });

    if (existing) {
      await existing.deleteOne();
      const count = await ReactionModel.countDocuments({ pandalYearId: body.pandalYearId });
      return { liked: false, count };
    }

    await ReactionModel.create({
      pandalYearId: body.pandalYearId,
      anonymousVisitorId: body.anonymousVisitorId,
      type: "LIKE",
    });
    const count = await ReactionModel.countDocuments({ pandalYearId: body.pandalYearId });
    return reply.code(201).send({ liked: true, count });
  });

  app.get<{ Querystring: { pandalYearId: string } }>("/count", async (request) => {
    const count = await ReactionModel.countDocuments({
      pandalYearId: request.query.pandalYearId,
    });
    return { count };
  });
};
