import type { FastifyPluginAsync } from "fastify";
import { PandalYearModel } from "@durgapandals/database";

export const pandalYearsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { pandalId: string } }>("/:pandalId", async (request) => {
    // Historical years stay addressable (spec §7.3) — no filtering to the
    // active festival year here, only to what's published.
    return PandalYearModel.find({
      pandalId: request.params.pandalId,
      publicationStatus: "PUBLISHED",
    }).sort({ year: -1 });
  });

  app.get<{ Params: { pandalId: string; year: string } }>(
    "/:pandalId/:year",
    async (request, reply) => {
      const pandalYear = await PandalYearModel.findOne({
        pandalId: request.params.pandalId,
        year: Number(request.params.year),
        publicationStatus: "PUBLISHED",
      });
      if (!pandalYear) return reply.code(404).send({ error: "Not found" });
      return pandalYear;
    }
  );
};
