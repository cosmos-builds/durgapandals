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
// proxies the request server-side, biased to the selected city's viewbox so
// "MP Nagar" resolves near Bhopal and not some other MP Nagar worldwide.
export const geocodingRoutes: FastifyPluginAsync = async (app) => {
  await app.register(import("@fastify/rate-limit"), {
    max: 30,
    timeWindow: "1 minute",
  });

  app.get("/search", async (request, reply) => {
    const query = searchQuerySchema.parse(request.query);
    const city = await CityModel.findOne({ slug: query.citySlug });
    if (!city) return reply.code(404).send({ error: "City not found" });

    // Tight box (~6km) around the bias point when we have one (the live pin),
    // wider (~35km, city-scale) when we only know the city centre.
    const biasLat = query.lat ?? city.latitude;
    const biasLon = query.lon ?? city.longitude;
    const delta = query.lat != null ? 0.06 : 0.35;
    const viewbox = [biasLon - delta, biasLat + delta, biasLon + delta, biasLat - delta].join(",");

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query.q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "6");
    url.searchParams.set("viewbox", viewbox);
    // Hard-restrict to the viewbox — bounded=0 only "prefers" it, which let
    // a textually-closer match on the other side of the country outrank an
    // actually-nearby result. This is what was causing far-away results.
    url.searchParams.set("bounded", "1");
    url.searchParams.set("countrycodes", city.countryCode.toLowerCase());

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
