import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { PandalModel, PandalYearModel, ReactionModel, CityModel, fromGeoPoint } from "@durgapandals/database";
import { findNearbyDuplicates, findNearbyPandals, findNearbyPublishedPandals } from "./pandals.service";

const nearbyQuerySchema = z.object({
  cityId: z.string(),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  canonicalName: z.string(),
  organizerName: z.string().optional(),
  publicContact: z.string().optional(),
});

const listQuerySchema = z.object({
  citySlug: z.string(),
  year: z.coerce.number().optional(),
  // Optional viewport box for "search this area" (Google-Maps-style
  // re-search-on-pan) — backward compatible, omitting these keeps the old
  // "every published pandal in the city" behavior.
  minLat: z.coerce.number().optional(),
  minLng: z.coerce.number().optional(),
  maxLat: z.coerce.number().optional(),
  maxLng: z.coerce.number().optional(),
});

// Shared shape the map, explore list, and preview sheet all render from —
// one Pandal + its current PandalYear + a live like count, joined once here
// instead of three different client-side assemblies.
async function withCurrentYear(pandal: InstanceType<typeof PandalModel>, year?: number) {
  const pandalYear = await PandalYearModel.findOne({
    pandalId: pandal._id,
    ...(year ? { year } : {}),
    publicationStatus: "PUBLISHED",
  }).sort({ year: -1 });

  const likes = pandalYear ? await ReactionModel.countDocuments({ pandalYearId: pandalYear._id }) : 0;

  return {
    id: String(pandal._id),
    slug: pandal.slug,
    createdAt: pandal.createdAt,
    canonicalName: pandal.canonicalName,
    organizerName: pandal.organizerName,
    ...fromGeoPoint(pandal.location),
    address: pandal.address,
    locality: pandal.locality,
    landmark: pandal.landmark,
    verificationStatus: pandal.verificationStatus,
    addedBy: pandal.addedBy,
    parkingAvailable: pandal.parkingAvailable,
    twoWheelerAccessible: pandal.twoWheelerAccessible,
    fourWheelerAccessible: pandal.fourWheelerAccessible,
    foodStallsNearby: pandal.foodStallsNearby,
    streetShopsNearby: pandal.streetShopsNearby,
    visitType: pandal.visitType,
    year: pandalYear
      ? {
          id: String(pandalYear._id),
          year: pandalYear.year,
          theme: pandalYear.theme,
          description: pandalYear.description,
          coverImage: pandalYear.coverImage,
          photos: pandalYear.photos,
          categories: pandalYear.categories,
          tags: pandalYear.tags,
          featured: pandalYear.featured,
          schedule: pandalYear.schedule,
        }
      : null,
    likes,
  };
}

export const pandalsRoutes: FastifyPluginAsync = async (app) => {
  // Powers the map markers + Explore list (spec §6.1, §8.2) — scoped to a
  // city and the city's active festival year unless a historical year is
  // explicitly requested.
  app.get("/", async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const city = await CityModel.findOne({ slug: query.citySlug });
    if (!city) return reply.code(404).send({ error: "City not found" });

    const filter: Record<string, unknown> = { cityId: city._id, publicationStatus: "PUBLISHED" };
    if (query.minLat != null && query.minLng != null && query.maxLat != null && query.maxLng != null) {
      filter.location = {
        $geoWithin: {
          $box: [
            [query.minLng, query.minLat],
            [query.maxLng, query.maxLat],
          ],
        },
      };
    }

    const pandals = await PandalModel.find(filter);
    const year = query.year ?? city.activeFestivalYear;
    const enriched = await Promise.all(pandals.map((pandal) => withCurrentYear(pandal, year)));
    return enriched.filter((item) => item.year != null);
  });

  app.get<{ Params: { cityId: string; slug: string } }>(
    "/:cityId/:slug",
    async (request, reply) => {
      const pandal = await PandalModel.findOne({
        cityId: request.params.cityId,
        slug: request.params.slug,
        publicationStatus: "PUBLISHED",
      });
      if (!pandal) return reply.code(404).send({ error: "Pandal not found" });
      return withCurrentYear(pandal);
    }
  );

  // Powers the "we found pandals near this location" duplicate check shown
  // before a visitor submits a new pandal (spec §17.1).
  app.get("/nearby-duplicates", async (request) => {
    const query = nearbyQuerySchema.parse(request.query);
    return findNearbyDuplicates(query);
  });

  const nearbyOnlySchema = z.object({
    cityId: z.string(),
    latitude: z.coerce.number(),
    longitude: z.coerce.number(),
  });

  app.get("/nearby", async (request) => {
    const query = nearbyOnlySchema.parse(request.query);
    return findNearbyPandals(query);
  });

  const nearbyRadiusSchema = z.object({
    cityId: z.string(),
    pandalId: z.string(),
    latitude: z.coerce.number(),
    longitude: z.coerce.number(),
    year: z.coerce.number(),
  });

  // Powers the detail page's "Pandals near here (1-2km)" rail (spec §2).
  app.get("/nearby-radius", async (request) => {
    const query = nearbyRadiusSchema.parse(request.query);
    return findNearbyPublishedPandals({
      cityId: query.cityId,
      excludePandalId: query.pandalId,
      latitude: query.latitude,
      longitude: query.longitude,
      year: query.year,
    });
  });
};
