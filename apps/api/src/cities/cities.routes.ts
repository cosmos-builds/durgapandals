import type { FastifyPluginAsync } from "fastify";
import { citySearchQuerySchema, cityResolveSchema } from "@durgapandals/validation";
import { CityModel, type CityDocument } from "@durgapandals/database";
import { slugify, uniqueSlug, getIndianStateCode } from "@durgapandals/utils";
import { distanceMeters } from "@durgapandals/deduplication";
import type { HydratedDocument } from "mongoose";

interface NominatimSearchResult {
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  class?: string;
  addresstype?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    country_code?: string;
  };
}

const SETTLEMENT_TYPES = new Set(["city", "town", "village", "municipality", "hamlet", "suburb", "state"]);

// Roughly India's mainland + island territories bounding box — rejects a
// resolve request whose coordinates couldn't plausibly be an Indian city,
// independent of whether the client actually went through Nominatim first
// (this is a public write endpoint; it must not trust the caller).
const INDIA_BOUNDS = { minLat: 6, maxLat: 38, minLng: 68, maxLng: 98 };

function isWithinIndia(latitude: number, longitude: number): boolean {
  return (
    latitude >= INDIA_BOUNDS.minLat &&
    latitude <= INDIA_BOUNDS.maxLat &&
    longitude >= INDIA_BOUNDS.minLng &&
    longitude <= INDIA_BOUNDS.maxLng
  );
}

function toDbResult(city: HydratedDocument<CityDocument>) {
  return {
    source: "db" as const,
    _id: String(city._id),
    slug: city.slug,
    name: city.name,
    state: city.state,
    status: city.status,
    tier: city.tier,
    activeFestivalYear: city.activeFestivalYear,
    latitude: city.latitude,
    longitude: city.longitude,
  };
}

async function searchNominatimCities(q: string): Promise<{ name: string; state: string; latitude: number; longitude: number }[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "10");
  url.searchParams.set("countrycodes", "in");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "DurgaPandals.com (contact: verify@durgapandals.com)",
      "Accept-Language": "en",
    },
  });
  if (!response.ok) return [];

  const results = (await response.json()) as NominatimSearchResult[];
  return results
    .filter((r) => (r.addresstype ? SETTLEMENT_TYPES.has(r.addresstype) : r.class === "place"))
    .map((r) => ({
      name: r.name || r.address?.city || r.address?.town || r.address?.village || r.address?.municipality || (r.display_name.split(",")[0] ?? "").trim(),
      state: r.address?.state ?? "",
      latitude: Number(r.lat),
      longitude: Number(r.lon),
    }))
    .filter((r) => r.name && r.state);
}

// A City row not yet created (finds an existing near-duplicate first) — used
// both by the resolve endpoint below and to keep dedup logic in one place.
async function findOrCreateCity(input: { name: string; state: string; latitude: number; longitude: number }) {
  const candidateSlug = slugify(input.name);

  const exactSlugMatch = await CityModel.findOne({ slug: candidateSlug });
  if (exactSlugMatch && distanceMeters(exactSlugMatch, input) <= 50_000) return exactSlugMatch;

  // No exact slug match — check for a same-place-different-spelling row
  // nearby (e.g. "Bombay" vs "Mumbai", a slightly different Nominatim admin
  // pick) before creating a duplicate. City has no geo index, so this is a
  // coarse box prefetch + haversine filter, not a $near query.
  const nearby = await CityModel.find({
    latitude: { $gte: input.latitude - 0.5, $lte: input.latitude + 0.5 },
    longitude: { $gte: input.longitude - 0.5, $lte: input.longitude + 0.5 },
  });
  const closest = nearby
    .map((city) => ({ city, distance: distanceMeters(city, input) }))
    .filter(({ distance }) => distance <= 15_000)
    .sort((a, b) => a.distance - b.distance)[0];
  if (closest) return closest.city;

  const slug = await uniqueSlug(input.name, async (candidate) => (await CityModel.findOne({ slug: candidate })) != null);

  try {
    return await CityModel.create({
      name: input.name,
      slug,
      state: input.state,
      stateCode: getIndianStateCode(input.state),
      countryCode: "IN",
      latitude: input.latitude,
      longitude: input.longitude,
      status: "ACTIVE",
      tier: "MINOR",
      activeFestivalYear: new Date().getFullYear(),
    });
  } catch (error) {
    // Two concurrent resolves for the same brand-new city raced on the
    // unique slug index — resolve is idempotent by design, so return the
    // row the other request just created instead of erroring.
    if ((error as { code?: number }).code === 11000) {
      const winner = await CityModel.findOne({ slug });
      if (winner) return winner;
    }
    throw error;
  }
}

export const citiesRoutes: FastifyPluginAsync = async (app) => {
  // Supported cities live in the database, never hardcoded (spec §5.4,
  // §31.1) — this plugin is also where any Indian city, not just an
  // admin-curated one, can be searched for and materialized into a real row.
  await app.register(import("@fastify/rate-limit"), {
    max: 30,
    timeWindow: "1 minute",
  });

  app.get("/", async () => {
    const cities = await CityModel.find({ status: { $ne: "DISABLED" } }).sort({ name: 1 });
    return cities;
  });

  app.get<{ Params: { slug: string } }>("/:slug", async (request, reply) => {
    const city = await CityModel.findOne({ slug: request.params.slug });
    if (!city) return reply.code(404).send({ error: "City not found" });
    return city;
  });

  // Merges already-known cities with live results from OpenStreetMap
  // Nominatim so search isn't limited to whatever an admin has pre-created —
  // callers tell the two apart via `source` and only need to call /resolve
  // for a "nominatim" result.
  app.get("/search", async (request) => {
    const query = citySearchQuerySchema.parse(request.query);

    const dbMatches = await CityModel.find({
      name: { $regex: query.q, $options: "i" },
      status: { $ne: "DISABLED" },
    }).limit(5);
    dbMatches.sort((a, b) => (a.tier === b.tier ? a.name.localeCompare(b.name) : a.tier === "MAJOR" ? -1 : 1));

    const dbResults = dbMatches.map(toDbResult);

    const nominatimMatches = await searchNominatimCities(query.q);
    const newResults = nominatimMatches
      .filter(
        (candidate) =>
          !dbResults.some(
            (existing) =>
              existing.name.toLowerCase() === candidate.name.toLowerCase() ||
              distanceMeters(existing, candidate) <= 15_000
          )
      )
      .map((candidate) => ({ source: "nominatim" as const, ...candidate }));

    return [...dbResults, ...newResults].slice(0, 8);
  });

  // Idempotent find-or-create for a city picked from a "nominatim" search
  // result — public and unauthenticated on purpose (both anonymous web
  // visitors and the admin app need it), so abuse is mitigated by the
  // rate limit above, the India bounding-box check, and dedup rather than a
  // login wall.
  app.post(
    "/resolve",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = cityResolveSchema.parse(request.body);
      if (!isWithinIndia(body.latitude, body.longitude)) {
        return reply.code(400).send({ error: "Coordinates are outside India" });
      }
      const city = await findOrCreateCity(body);
      return city;
    }
  );
};
