import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createPandalSchema, updatePandalSchema, pandalYearSchema } from "@durgapandals/validation";
import { PandalModel, PandalYearModel, ReactionModel, fromGeoPoint } from "@durgapandals/database";
import { uniqueSlug } from "@durgapandals/utils";
import { normalizePageRequest, buildPageResult } from "@durgapandals/utils";
import { findNearbyDuplicates } from "../pandals/pandals.service";
import { CloudinaryProvider } from "../media/cloudinary-provider";

const listQuerySchema = z.object({
  cityId: z.string().optional(),
  status: z.string().optional(),
  verificationStatus: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
});

const bulkStatusSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  publicationStatus: z.enum(["DRAFT", "PENDING", "PUBLISHED", "ARCHIVED", "REJECTED"]).optional(),
  verificationStatus: z.enum(["UNVERIFIED", "VERIFIED", "DUPLICATE"]).optional(),
});

// Admin CRUD for the canonical Pandal + its yearly records (spec §23) — admin
// can create/edit/publish directly, but still runs the shared duplicate
// scoring so a manually-entered pandal doesn't silently shadow an existing
// one (spec §17.4).
export function registerPandalsAdminRoutes(app: FastifyInstance) {
  // Same provider construction as apps/api/src/media/media.routes.ts — reused
  // here (rather than an HTTP call to that route) so a hard delete's photo
  // cleanup is a direct function call, not a self-fetch loop.
  const mediaProvider = new CloudinaryProvider({
    cloudName: app.env.CLOUDINARY_CLOUD_NAME ?? "",
    apiKey: app.env.CLOUDINARY_API_KEY ?? "",
    apiSecret: app.env.CLOUDINARY_API_SECRET ?? "",
  });

  // Best-effort: a Cloudinary cleanup failure shouldn't fail the whole
  // delete, since the DB records are already gone by the time this runs.
  async function bestEffortDeletePhotos(urls: string[]) {
    await Promise.all(
      urls.map((url) =>
        mediaProvider.delete(url).catch((error) => app.log.error(error))
      )
    );
  }

  app.get("/pandals", async (request) => {
    const query = listQuerySchema.parse(request.query);
    const { page, pageSize } = normalizePageRequest(query);

    const filter: Record<string, unknown> = {};
    if (query.cityId) filter.cityId = query.cityId;
    if (query.status) filter.publicationStatus = query.status;
    if (query.verificationStatus) filter.verificationStatus = query.verificationStatus;
    if (query.search) filter.$text = { $search: query.search };

    const [items, total] = await Promise.all([
      PandalModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize),
      PandalModel.countDocuments(filter),
    ]);

    // The list previously showed just a name — an admin had no way to tell
    // whether a pandal has any history at all, or whether it already has an
    // entry for the current festival year, without opening its detail page.
    // One grouped query for the current page's ids is cheap (25 rows) and
    // avoids an N+1 per-row lookup.
    const ids = items.map((item) => item._id);
    const yearRows = await PandalYearModel.find({ pandalId: { $in: ids } }, { pandalId: 1, year: 1 });
    const yearsByPandal = new Map<string, number[]>();
    for (const row of yearRows) {
      const key = String(row.pandalId);
      const list = yearsByPandal.get(key) ?? [];
      list.push(row.year);
      yearsByPandal.set(key, list);
    }
    const currentYear = new Date().getFullYear();
    const itemsWithYears = items.map((item) => {
      const years = yearsByPandal.get(String(item._id)) ?? [];
      return {
        ...item.toObject(),
        yearCount: years.length,
        hasCurrentYearEntry: years.includes(currentYear),
      };
    });

    return buildPageResult(itemsWithYears, total, { page, pageSize });
  });

  // Flattened lat/lng for every published pandal, across all cities — backs
  // the dashboard's clustered map (spec: Google-Maps-style overview) without
  // the client having to unpack GeoJSON itself.
  app.get("/pandals-map", async () => {
    const pandals = await PandalModel.find({ publicationStatus: { $ne: "ARCHIVED" } }, {
      canonicalName: 1,
      location: 1,
      publicationStatus: 1,
      cityId: 1,
    });
    return pandals.map((pandal) => ({
      id: String(pandal._id),
      canonicalName: pandal.canonicalName,
      publicationStatus: pandal.publicationStatus,
      cityId: String(pandal.cityId),
      ...fromGeoPoint(pandal.location),
    }));
  });

  app.post("/pandals/bulk-status", async (request, reply) => {
    const body = bulkStatusSchema.parse(request.body);
    if (!body.publicationStatus && !body.verificationStatus) {
      return reply.code(400).send({ error: "Nothing to update" });
    }
    const update: Record<string, unknown> = {};
    if (body.publicationStatus) update.publicationStatus = body.publicationStatus;
    if (body.verificationStatus) update.verificationStatus = body.verificationStatus;

    const result = await PandalModel.updateMany({ _id: { $in: body.ids } }, update);
    return { matched: result.matchedCount, modified: result.modifiedCount };
  });

  app.get<{ Params: { id: string } }>("/pandals/:id", async (request, reply) => {
    const pandal = await PandalModel.findById(request.params.id);
    if (!pandal) return reply.code(404).send({ error: "Pandal not found" });
    const years = await PandalYearModel.find({ pandalId: pandal._id }).sort({ year: -1 });
    // Likes are otherwise invisible in admin (spec audit item) — one count
    // query per year, same ReactionModel the public API already uses.
    const yearsWithLikes = await Promise.all(
      years.map(async (year) => ({
        ...year.toObject(),
        likes: await ReactionModel.countDocuments({ pandalYearId: year._id }),
      }))
    );
    return { pandal, years: yearsWithLikes };
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
      addedBy: "ADMIN",
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

  // Hard delete — for a pandal that should never have existed (test entry,
  // duplicate created by mistake, wrong city/year), not for hiding a real
  // one from the public (that's what ARCHIVED is for). Cascades to every
  // PandalYear under it and their reactions/likes, since nothing else
  // references this pandal once it's gone.
  app.delete<{ Params: { id: string } }>("/pandals/:id", async (request, reply) => {
    const pandal = await PandalModel.findById(request.params.id);
    if (!pandal) return reply.code(404).send({ error: "Pandal not found" });

    const years = await PandalYearModel.find({ pandalId: pandal._id }, { photos: 1 });
    const yearIds = years.map((year) => year._id);
    const photoUrls = years.flatMap((year) => year.photos.map((photo) => photo.url));

    await ReactionModel.deleteMany({ pandalYearId: { $in: yearIds } });
    await PandalYearModel.deleteMany({ pandalId: pandal._id });
    await PandalModel.deleteOne({ _id: pandal._id });
    await bestEffortDeletePhotos(photoUrls);

    return reply.code(204).send();
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

  // Hard delete for a single mistaken year (e.g. a festival year created for
  // the wrong pandal, or one that doesn't actually exist yet) — the pandal
  // itself and its other years are untouched.
  app.delete<{ Params: { id: string } }>("/pandal-years/:id", async (request, reply) => {
    const pandalYear = await PandalYearModel.findById(request.params.id);
    if (!pandalYear) return reply.code(404).send({ error: "Pandal year not found" });

    await ReactionModel.deleteMany({ pandalYearId: pandalYear._id });
    await PandalYearModel.deleteOne({ _id: pandalYear._id });
    await bestEffortDeletePhotos(pandalYear.photos.map((photo) => photo.url));

    return reply.code(204).send();
  });
}
