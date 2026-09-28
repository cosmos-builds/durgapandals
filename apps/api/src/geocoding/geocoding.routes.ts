import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { CityModel } from "@durgapandals/database";

const searchQuerySchema = z.object({
  q: z.string().min(2).max(200),
  citySlug: z.string(),
  // Optional: bias to wherever the user is actually looking (e.g. the
  // current pin in the Add Pandal flow) rather than always the city's fixed
  // centre — "near me" should mean near the pin, not near city hall.
  lat: z.coerce.number().optional(),
  lon: z.coerce.number().optional(),
});

const reverseQuerySchema = z.object({
  lat: z.coerce.number(),
  lon: z.coerce.number(),
});

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    suburb?: string;
    neighbourhood?: string;
    city_district?: string;
    city?: string;
  };
}

// Free-tier geocoding behind a provider boundary (spec §5.4, §31.5) — the
// browser can't send Nominatim's required User-Agent header itself, so this
// proxies the request server-side. Pandals can be added anywhere in India
// (not just near the visitor's currently-selected city), so this searches
// all of India like Google Maps would — the live pin (when present) only
// nudges ranking toward it for disambiguating same-named places, it never
// excludes a legitimately distant, correctly-named result.
export const geocodingRoutes: FastifyPluginAsync = async (app) => {
  await app.register(import("@fastify/rate-limit"), {
    max: 30,
    timeWindow: "1 minute",
  });

  app.get("/search", async (request, reply) => {
    const query = searchQuerySchema.parse(request.query);
    const city = await CityModel.findOne({ slug: query.citySlug });
    if (!city) return reply.code(404).send({ error: "City not found" });

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query.q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "8");
    url.searchParams.set("countrycodes", city.countryCode.toLowerCase());

    // Only nudge ranking toward the live pin when we actually have one (mid-
    // flow, dragging the map) — a same-named locality near the pin should
    // outrank an unrelated one elsewhere. No pin yet (first search) means no
    // bias at all: unrestricted India-wide search, same as Google Maps.
    // `bounded` is intentionally omitted — setting it to 1 hard-excludes
    // anything outside the box (e.g. searching "Bhopal" while a Pune pin is
    // active returned zero results); leaving it unset makes viewbox a soft
    // ranking preference instead of a filter.
    if (query.lat != null && query.lon != null) {
      const delta = 0.06;
      const viewbox = [query.lon - delta, query.lat + delta, query.lon + delta, query.lat - delta].join(",");
      url.searchParams.set("viewbox", viewbox);
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "DurgaPandal.com (contact: verify@durgapandal.com)",
        "Accept-Language": "en",
      },
    });

    if (!response.ok) return reply.code(502).send({ error: "Geocoding provider unavailable" });

    const results = (await response.json()) as NominatimResult[];
    return results.map(toResult);
  });

  // Backs the "drag the pin, address fills in" pattern from Google Maps —
  // without this, dragging the map did nothing visible and the Continue
  // button stayed disabled since locality/address are required fields with
  // nothing populating them.
  app.get("/reverse", async (request, reply) => {
    const query = reverseQuerySchema.parse(request.query);

    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(query.lat));
    url.searchParams.set("lon", String(query.lon));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("zoom", "18");

    const response = await fetch(url, {
      headers: {
        "User-Agent": "DurgaPandal.com (contact: verify@durgapandal.com)",
        "Accept-Language": "en",
      },
    });

    if (!response.ok) return reply.code(502).send({ error: "Geocoding provider unavailable" });

    const result = (await response.json()) as NominatimResult;
    return toResult(result);
  });
};

function toResult(result: NominatimResult) {
  return {
    label: result.display_name,
    latitude: Number(result.lat),
    longitude: Number(result.lon),
    locality: result.address?.suburb ?? result.address?.neighbourhood ?? result.address?.city_district,
    road: result.address?.road,
  };
}
