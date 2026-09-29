import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const searchQuerySchema = z.object({
  q: z.string().min(2).max(200),
  // No longer used to restrict results (search is always India-wide — see
  // below) — kept optional so existing callers that still send it don't
  // break; safely ignored otherwise.
  citySlug: z.string().optional(),
  // Optional: bias to wherever the user is actually looking (e.g. the
  // current pending pin in the Add Pandal flow / admin picker) rather than
  // always the city's fixed centre — "near me" should mean near the pin,
  // not near city hall.
  lat: z.coerce.number().optional(),
  lon: z.coerce.number().optional(),
});

const reverseQuerySchema = z.object({
  lat: z.coerce.number(),
  lon: z.coerce.number(),
});

// Roughly India's mainland + island territories bounding box — same
// constant apps/api/src/cities/cities.routes.ts already uses for its Photon
// city search, kept in sync here rather than shared, since it's a single
// literal and pulling in a shared module for one array isn't worth it.
const INDIA_BBOX = "68,6,98,38";

interface PhotonFeature {
  properties: {
    name?: string;
    housenumber?: string;
    street?: string;
    locality?: string;
    suburb?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
  };
  geometry: { coordinates: [number, number] };
}

interface PhotonResponse {
  features: PhotonFeature[];
}

function buildLabel(p: PhotonFeature["properties"]): string {
  const streetLine = [p.housenumber, p.street].filter(Boolean).join(" ") || p.name;
  const parts = [streetLine, p.locality ?? p.suburb ?? p.district, p.city, p.state, p.country].filter(
    (part): part is string => Boolean(part)
  );
  // A locality search often repeats itself across two of these fields (e.g.
  // name === locality) — dedup while preserving order so the label doesn't
  // read "Anna Nagar, Anna Nagar, Chennai".
  return Array.from(new Set(parts)).join(", ");
}

function toResult(feature: PhotonFeature) {
  const p = feature.properties;
  return {
    label: buildLabel(p),
    latitude: feature.geometry.coordinates[1],
    longitude: feature.geometry.coordinates[0],
    locality: p.locality ?? p.suburb ?? p.district,
    road: p.street,
  };
}

// Free-tier geocoding behind a provider boundary (spec §5.4, §31.5) — the
// browser can't send Photon/Nominatim's required User-Agent header itself,
// so this proxies the request server-side.
//
// Runs on Photon (Komoot's OSM-backed geocoder), the same provider
// apps/api/src/cities/cities.routes.ts already uses for city search — it
// does edge-ngram/prefix matching (unlike Nominatim, which tokenizes on
// whole words and returned nothing for a still-being-typed query), and its
// public instance tolerates the request rate an interactive search box
// produces. Nominatim's public server enforces a strict ~1 request/second
// limit; this endpoint's previous Nominatim-backed version was silently
// rate-limited by ordinary fast typing, which looked exactly like "no
// results" with no error surfaced anywhere.
//
// Pandals can be added anywhere in India (not just near the visitor's
// currently-selected city), so this always searches all of India — the
// live pin (when present) only nudges ranking toward it via Photon's native
// lat/lon bias, it never excludes a legitimately distant, correctly-named
// result.
export const geocodingRoutes: FastifyPluginAsync = async (app) => {
  await app.register(import("@fastify/rate-limit"), {
    max: 30,
    timeWindow: "1 minute",
  });

  app.get("/search", async (request, reply) => {
    const query = searchQuerySchema.parse(request.query);

    const url = new URL("https://photon.komoot.io/api/");
    url.searchParams.set("q", query.q);
    url.searchParams.set("limit", "8");
    url.searchParams.set("lang", "en");
    // Hard filter, not a ranking bias — Photon's `bbox` actually excludes
    // non-Indian results instead of just deprioritizing them.
    url.searchParams.set("bbox", INDIA_BBOX);
    if (query.lat != null && query.lon != null) {
      url.searchParams.set("lat", String(query.lat));
      url.searchParams.set("lon", String(query.lon));
    }

    const response = await fetch(url, {
      headers: { "User-Agent": "DurgaPandal.com (contact: verify@durgapandal.com)" },
    });
    if (!response.ok) return reply.code(502).send({ error: "Geocoding provider unavailable" });

    const data = (await response.json()) as PhotonResponse;
    return data.features.map(toResult);
  });

  // Backs the "drag the pin, address fills in" pattern from Google Maps —
  // without this, dragging the map did nothing visible and the Continue
  // button stayed disabled since locality/address are required fields with
  // nothing populating them.
  app.get("/reverse", async (request, reply) => {
    const query = reverseQuerySchema.parse(request.query);

    const url = new URL("https://photon.komoot.io/reverse");
    url.searchParams.set("lat", String(query.lat));
    url.searchParams.set("lon", String(query.lon));
    url.searchParams.set("lang", "en");

    const response = await fetch(url, {
      headers: { "User-Agent": "DurgaPandal.com (contact: verify@durgapandal.com)" },
    });
    if (!response.ok) return reply.code(502).send({ error: "Geocoding provider unavailable" });

    const data = (await response.json()) as PhotonResponse;
    const feature = data.features[0];
    if (!feature) return reply.code(404).send({ error: "No address found for this location" });
    return toResult(feature);
  });
};
