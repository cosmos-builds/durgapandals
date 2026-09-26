import type { FastifyPluginAsync } from "fastify";
import { CityModel } from "@durgapandals/database";

export const citiesRoutes: FastifyPluginAsync = async (app) => {
  // Supported cities live in the database, never hardcoded (spec §5.4, §31.1).
  app.get("/", async () => {
    const cities = await CityModel.find({ status: { $ne: "DISABLED" } }).sort({ name: 1 });
    return cities;
  });

  app.get<{ Params: { slug: string } }>("/:slug", async (request, reply) => {
    const city = await CityModel.findOne({ slug: request.params.slug });
    if (!city) return reply.code(404).send({ error: "City not found" });
    return city;
  });
};
