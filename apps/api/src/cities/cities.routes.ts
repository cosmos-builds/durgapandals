import type { FastifyPluginAsync } from "fastify";
import { citySearchQuerySchema, cityResolveSchema } from "@durgapandals/validation";
import { CityModel, type CityDocument } from "@durgapandals/database";
import { slugify, uniqueSlug, getIndianStateCode } from "@durgapandals/utils";
import { distanceMeters } from "@durgapandals/deduplication";
import type { HydratedDocument } from "mongoose";

interface PhotonFeature {
  properties: {
    name?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    countrycode?: string;
    osm_key?: string;
    osm_value?: string;
  };
  geometry: { coordinates: [number, number] };
}

interface PhotonResponse {
  features: PhotonFeature[];
}

const SETTLEMENT_TYPES = new Set(["city", "town", "village", "municipality", "hamlet", "suburb", "state"]);

// Nominatim tokenizes on whole words and doesn't prefix-match the term
// being typed, so "obaidul" returned nothing for "Obaidullaganj" even
// though the DB substring match below would have found it if the city
// existed locally. Photon (Komoot's OSM-backed geocoder) is built for
// autocomplete — its index does edge-ngram/prefix matching — and needs no
// API key, so it's a drop-in free replacement for the "any place in India"
// half of city search.
const EXTERNAL_SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const externalSearchCache = new Map<string, { expiresAt: number; results: ExternalCityCandidate[] }>();

interface ExternalCityCandidate {
  name: string;
  state: string;
  latitude: number;
  longitude: number;
}

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

async function searchExternalCities(q: string): Promise<ExternalCityCandidate[]> {
  const cacheKey = q.trim().toLowerCase();
  const cached = externalSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.results;

  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "10");
  url.searchParams.set("lang", "en");
  // Photon's `bbox` is a hard filter (unlike Nominatim's `countrycodes`,
  // which only biases ranking), so this actually excludes non-Indian
  // results instead of just deprioritizing them.
  url.searchParams.set(
    "bbox",
    `${INDIA_BOUNDS.minLng},${INDIA_BOUNDS.minLat},${INDIA_BOUNDS.maxLng},${INDIA_BOUNDS.maxLat}`
  );

  const response = await fetch(url, {
    headers: { "User-Agent": "DurgaPandals.com (contact: verify@durgapandals.com)" },
  });
  if (!response.ok) return [];

  const data = (await response.json()) as PhotonResponse;
  const results = data.features
    .filter((f) => f.properties.osm_key === "place" && (!f.properties.osm_value || SETTLEMENT_TYPES.has(f.properties.osm_value)))
    .filter((f) => !f.properties.countrycode || f.properties.countrycode.toUpperCase() === "IN")
    .map((f) => ({
      name: f.properties.name || f.properties.city || f.properties.town || f.properties.village || "",
      state: f.properties.state ?? "",
      latitude: f.geometry.coordinates[1],
      longitude: f.geometry.coordinates[0],
    }))
    .filter((r) => r.name && r.state);

  externalSearchCache.set(cacheKey, { expiresAt: Date.now() + EXTERNAL_SEARCH_CACHE_TTL_MS, results });
  return results;
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
  // Registering the plugin here sets the default bucket for any route in
  // this file that doesn't override it below. `/search` gets its own bucket
  // (typing-driven, many small requests) so heavy use of it can't also
  // starve plain navigation calls to `/` and `/:slug`, which now share one
  // generous default instead.
  await app.register(import("@fastify/rate-limit"), {
    max: 60,
    timeWindow: "1 minute",
  });

  // MAJOR-tier cities sort first (alphabetically "MAJOR" < "MINOR" already
  // does this) so any caller that just takes the first ACTIVE result — like
  // the root page's default-city redirect — lands on a curated city instead
  // of whatever happens to be alphabetically first overall.
  app.get("/", async () => {
    const cities = await CityModel.find({ status: { $ne: "DISABLED" } }).sort({ tier: 1, name: 1 });
    return cities;
  });

  app.get<{ Params: { slug: string } }>(
    "/:slug",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const city = await CityModel.findOne({ slug: request.params.slug });
      if (!city) return reply.code(404).send({ error: "City not found" });
      return city;
    }
  );

  // Merges already-known cities with live results from OpenStreetMap
  // (via Photon) so search isn't limited to whatever an admin has
  // pre-created — callers tell the two apart via `source` and only need to
  // call /resolve for a "nominatim" result.
  app.get(
    "/search",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request) => {
      const query = citySearchQuerySchema.parse(request.query);

      const dbMatches = await CityModel.find({
        name: { $regex: query.q, $options: "i" },
        status: { $ne: "DISABLED" },
      }).limit(5);
      dbMatches.sort((a, b) => (a.tier === b.tier ? a.name.localeCompare(b.name) : a.tier === "MAJOR" ? -1 : 1));

      const dbResults = dbMatches.map(toDbResult);

      const externalMatches = await searchExternalCities(query.q);
      const newResults = externalMatches
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
    }
  );

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
