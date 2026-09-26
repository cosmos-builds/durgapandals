import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createPandalSchema, updatePandalSchema, pandalYearSchema } from "@durgapandals/validation";
import { PandalModel, PandalYearModel } from "@durgapandals/database";
import { uniqueSlug } from "@durgapandals/utils";
import { normalizePageRequest, buildPageResult } from "@durgapandals/utils";
import { findNearbyDuplicates } from "../pandals/pandals.service";

const listQuerySchema = z.object({
  cityId: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
});

// Admin CRUD for the canonical Pandal + its yearly records (spec §23) — admin
// can create/edit/publish directly, but still runs the shared duplicate
// scoring so a manually-entered pandal doesn't silently shadow an existing
// one (spec §17.4).
export function registerPandalsAdminRoutes(app: FastifyInstance) {
  app.get("/pandals", async (request) => {
    const query = listQuerySchema.parse(request.query);
    const { page, pageSize } = normalizePageRequest(query);

    const filter: Record<string, unknown> = {};
    if (query.cityId) filter.cityId = query.cityId;
    if (query.status) filter.publicationStatus = query.status;
    if (query.search) filter.$text = { $search: query.search };

    const [items, total] = await Promise.all([
      PandalModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize),
      PandalModel.countDocuments(filter),
    ]);

    return buildPageResult(items, total, { page, pageSize });
  });

  app.get<{ Params: { id: string } }>("/pandals/:id", async (request, reply) => {
    const pandal = await PandalModel.findById(request.params.id);
    if (!pandal) return reply.code(404).send({ error: "Pandal not found" });
    const years = await PandalYearModel.find({ pandalId: pandal._id }).sort({ year: -1 });
    return { pandal, years };
  });

  app.post("/pandals/duplicate-check", async (request) => {
    const body = createPandalSchema.parse(request.body);
    return findNearbyDuplicates(body);
  });

  app.post("/pandals", async (request, reply) => {
    const body = createPandalSchema.parse(request.body);

    const slug = await uniqueSlug(
      body.canonicalName,
      async (candidate) =>
        Boolean(await PandalModel.exists({ cityId: body.cityId, slug: candidate }))
    );

    const pandal = await PandalModel.create({
      ...body,
      slug,
      location: { type: "Point", coordinates: [body.longitude, body.latitude] },
      verificationStatus: "VERIFIED",
      publicationStatus: "PUBLISHED",
    });

    return reply.code(201).send(pandal);
  });

  app.patch<{ Params: { id: string } }>("/pandals/:id", async (request, reply) => {
    const body = updatePandalSchema.omit({ id: true }).parse(request.body);
    const update: Record<string, unknown> = { ...body };
    if (body.latitude != null && body.longitude != null) {
      update.location = { type: "Point", coordinates: [body.longitude, body.latitude] };
    }

    const pandal = await PandalModel.findByIdAndUpdate(request.params.id, update, { new: true });
    if (!pandal) return reply.code(404).send({ error: "Pandal not found" });
    return pandal;
  });

  const statusSchema = z.object({
    publicationStatus: z.enum(["DRAFT", "PENDING", "PUBLISHED", "ARCHIVED", "REJECTED"]).optional(),
    verificationStatus: z.enum(["UNVERIFIED", "VERIFIED", "DUPLICATE"]).optional(),
  });

  app.patch<{ Params: { id: string } }>("/pandals/:id/status", async (request, reply) => {
    const body = statusSchema.parse(request.body);
    const pandal = await PandalModel.findByIdAndUpdate(request.params.id, body, { new: true });
    if (!pandal) return reply.code(404).send({ error: "Pandal not found" });
    return pandal;
  });

  // --- Pandal years ---

  app.post("/pandal-years", async (request, reply) => {
    const body = pandalYearSchema.parse(request.body);
    const existing = await PandalYearModel.findOne({ pandalId: body.pandalId, year: body.year });
    if (existing) return reply.code(409).send({ error: "This pandal already has a record for that year" });

    const pandalYear = await PandalYearModel.create({
      ...body,
      publicationStatus: "PUBLISHED",
      verificationStatus: "VERIFIED",
    });
    return reply.code(201).send(pandalYear);
  });

  app.patch<{ Params: { id: string } }>("/pandal-years/:id", async (request, reply) => {
    const body = pandalYearSchema.partial().omit({ pandalId: true, year: true }).parse(request.body);
    const pandalYear = await PandalYearModel.findByIdAndUpdate(request.params.id, body, { new: true });
    if (!pandalYear) return reply.code(404).send({ error: "Pandal year not found" });
    return pandalYear;
  });
}
