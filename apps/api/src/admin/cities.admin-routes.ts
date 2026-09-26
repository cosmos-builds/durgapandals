import type { FastifyInstance } from "fastify";
import { citySchema } from "@durgapandals/validation";
import { CityModel } from "@durgapandals/database";
import { slugify } from "@durgapandals/utils";

// Slug is optional on input — the admin form only requires a name, the
// server derives a readable slug from it (spec §5.5) unless one is given.
const createCitySchema = citySchema.extend({ slug: citySchema.shape.slug.optional() });

// This is the only way new cities enter the system (spec §5.1, §31.1) —
// there is no hardcoded city list anywhere in product code, so activating a
// third city is just a row here.
export function registerCitiesAdminRoutes(app: FastifyInstance) {
  app.get("/cities", async () => {
    return CityModel.find().sort({ name: 1 });
  });

  app.post("/cities", async (request, reply) => {
    const body = createCitySchema.parse(request.body);
    const slug = body.slug || slugify(body.name);
    const existing = await CityModel.findOne({ slug });
    if (existing) return reply.code(409).send({ error: "A city with this slug already exists" });

    const city = await CityModel.create({ ...body, slug });
    return reply.code(201).send(city);
  });

  app.patch<{ Params: { id: string } }>("/cities/:id", async (request, reply) => {
    const body = citySchema.partial().parse(request.body);
    const city = await CityModel.findByIdAndUpdate(request.params.id, body, { new: true });
    if (!city) return reply.code(404).send({ error: "City not found" });
    return city;
  });
}
