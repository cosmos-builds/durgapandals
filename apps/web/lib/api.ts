// Server Components/generateMetadata/opengraph-image run inside the same
// container as the API — routing that traffic through the public
// NEXT_PUBLIC_API_URL (a forwarded Codespaces URL in dev) was hitting
// GitHub's private-port auth gate and getting an HTML redirect back instead
// of JSON. Only the browser genuinely needs the public URL; server-side
// code should just talk to the API directly. `typeof window` is evaluated
// once per bundle (server vs client are built separately), so this
// resolves correctly in each.
const API_BASE_URL =
  typeof window === "undefined"
    ? (process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000")
    : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000");

// A transient proxy/redirect/error page (HTML, not JSON) previously crashed
// the caller with an unhandled JSON.parse SyntaxError instead of degrading
// gracefully — this treats "response body isn't valid JSON" the same as
// "request failed".
async function safeJson<T>(response: Response, fallback: T): Promise<T> {
  if (!response.ok) return fallback;
  try {
    return await response.json();
  } catch {
    return fallback;
  }
}

export interface CityApiModel {
  _id: string;
  name: string;
  slug: string;
  latitude: number;
  longitude: number;
  defaultMapZoom: number;
  status: "ACTIVE" | "COMING_SOON" | "DISABLED";
  activeFestivalYear: number;
  tier: "MAJOR" | "MINOR";
}

export async function fetchCities(): Promise<CityApiModel[]> {
  const response = await fetch(`${API_BASE_URL}/cities`, { next: { revalidate: 300 } });
  return safeJson(response, []);
}

// Next's fetch cache (the `revalidate` option above) only applies during
// server rendering — in the browser, IntroHero and the city selector sheet
// were each doing their own uncached GET /cities on every mount. This
// shares one recent request between them, and (unlike fetchCities' silent
// []-on-failure) rejects on a real failure so callers can show an actual
// error/retry state instead of a silently empty city list.
let cachedCitiesPromise: Promise<CityApiModel[]> | null = null;
let cachedCitiesAt = 0;
const CLIENT_CITY_CACHE_MS = 60_000;

export function fetchCitiesCached(force = false): Promise<CityApiModel[]> {
  const isStale = Date.now() - cachedCitiesAt > CLIENT_CITY_CACHE_MS;
  if (force || !cachedCitiesPromise || isStale) {
    cachedCitiesAt = Date.now();
    cachedCitiesPromise = fetch(`${API_BASE_URL}/cities`)
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load cities (${response.status})`);
        return response.json() as Promise<CityApiModel[]>;
      })
      .catch((error) => {
        cachedCitiesPromise = null;
        throw error;
      });
  }
  return cachedCitiesPromise;
}

export async function fetchCityBySlug(slug: string): Promise<CityApiModel | null> {
  const response = await fetch(`${API_BASE_URL}/cities/${slug}`, { next: { revalidate: 300 } });
  return safeJson(response, null);
}

// A "db" result is already a real city (has a slug, navigate directly); a
// "nominatim" result is live from OpenStreetMap and has no City row yet —
// call resolveCity() with it before navigating.
export type CitySearchResult =
  | (Pick<CityApiModel, "slug" | "name" | "status" | "tier" | "activeFestivalYear"> & {
      source: "db";
      _id: string;
      state: string;
      latitude: number;
      longitude: number;
    })
  | {
      source: "nominatim";
      name: string;
      state: string;
      latitude: number;
      longitude: number;
    };

export async function searchCities(q: string): Promise<CitySearchResult[]> {
  if (q.trim().length < 2) return [];
  const response = await fetch(`${API_BASE_URL}/cities/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
  return safeJson(response, []);
}

// Materializes a "nominatim" search result into a real City row — idempotent,
// safe to call again for a city that already exists (e.g. two people search
// for the same not-yet-listed city around the same time).
export async function resolveCity(candidate: {
  name: string;
  state: string;
  latitude: number;
  longitude: number;
}): Promise<CityApiModel | null> {
  const response = await fetch(`${API_BASE_URL}/cities/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(candidate),
  });
  return safeJson(response, null);
}

export interface ScheduleEntry {
  time: string;
  label: string;
}

export interface PandalYearSummary {
  id: string;
  year: number;
  theme?: string;
  description?: string;
  coverImage?: string;
  photos: { url: string; altText?: string }[];
  categories: string[];
  tags: string[];
  featured: boolean;
  schedule: ScheduleEntry[];
}

export type AddedBy = "ADMIN" | "ORGANIZER" | "PUBLIC_SUBMISSION";
export type VisitType = "WALKING_DARSHAN" | "PARK_AND_VISIT" | "DARSHAN_AND_GO";

export interface PandalSummary {
  id: string;
  slug: string;
  createdAt: string;
  canonicalName: string;
  organizerName?: string;
  latitude: number;
  longitude: number;
  address: string;
  locality: string;
  landmark?: string;
  verificationStatus: string;
  addedBy: AddedBy;
  parkingAvailable: boolean;
  twoWheelerAccessible: boolean;
  fourWheelerAccessible: boolean;
  foodStallsNearby: boolean;
  streetShopsNearby: boolean;
  visitType: VisitType;
  year: PandalYearSummary | null;
  likes: number;
}

// The pandal detail page always showed a pandal's *latest* published year
// regardless of which festival year the visitor was actually browsing on
// Explore/Map — every link into it now carries `?year=` (the detail page
// and its API call both respect it, see pandals.routes.ts) so the year
// context survives the navigation instead of silently jumping to "latest."
export function pandalDetailHref(citySlug: string, pandal: Pick<PandalSummary, "slug" | "year">): string {
  const base = `/${citySlug}/pandal/${pandal.slug}`;
  return pandal.year ? `${base}?year=${pandal.year.year}` : base;
}

export const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  WALKING_DARSHAN: "Walking darshan",
  PARK_AND_VISIT: "Park & visit",
  DARSHAN_AND_GO: "Darshan & go",
};

export const ADDED_BY_LABELS: Record<AddedBy, string> = {
  ADMIN: "Added by admin",
  ORGANIZER: "Added by organiser",
  PUBLIC_SUBMISSION: "Added by a visitor",
};

export interface BoundingBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

function pandalsFetchInit(bbox?: BoundingBox, year?: number): RequestInit {
  return {
    cache: bbox || year ? "no-store" : undefined,
    next: bbox || year ? undefined : { revalidate: 30 },
  };
}

function pandalsUrl(citySlug: string, bbox?: BoundingBox, year?: number): string {
  const params = new URLSearchParams({ citySlug });
  if (year) params.set("year", String(year));
  if (bbox) {
    params.set("minLat", String(bbox.minLat));
    params.set("minLng", String(bbox.minLng));
    params.set("maxLat", String(bbox.maxLat));
    params.set("maxLng", String(bbox.maxLng));
  }
  return `${API_BASE_URL}/pandals?${params}`;
}

// `bbox` powers "Search this area" on the Map page — omitting it keeps the
// original "every published pandal in the city" behavior (the initial load
// still wants the whole city, not just the starting viewport). `year`
// switches to a historical festival year instead of the city's active one
// (spec §4's combined city+year control). Silently falls back to [] on
// failure — appropriate for a client-triggered incremental refetch (e.g.
// "search this area"), where the page is already rendered and an unhandled
// rejection would be worse than a stale/empty list. For an initial
// server-rendered load, use fetchPandalsForCityOrThrow instead so a real
// API failure can render an actual error state instead of looking like an
// empty city.
export async function fetchPandalsForCity(
  citySlug: string,
  bbox?: BoundingBox,
  year?: number
): Promise<PandalSummary[]> {
  const response = await fetch(pandalsUrl(citySlug, bbox, year), pandalsFetchInit(bbox, year));
  return safeJson(response, []);
}

export async function fetchPandalsForCityOrThrow(
  citySlug: string,
  bbox?: BoundingBox,
  year?: number
): Promise<PandalSummary[]> {
  const response = await fetch(pandalsUrl(citySlug, bbox, year), pandalsFetchInit(bbox, year));
  if (!response.ok) throw new Error(`Failed to load pandals (${response.status})`);
  return response.json();
}

function pandalDetailUrl(cityId: string, slug: string, year?: number): string {
  const params = year ? `?year=${year}` : "";
  return `${API_BASE_URL}/pandals/${cityId}/${slug}${params}`;
}

// `year` matches whatever festival year the visitor was browsing (Explore/
// Map's `?year=`) instead of always showing the pandal's latest — see
// pandals.routes.ts on the API side for the "falls back to latest if that
// year isn't published" behavior. Used by generateMetadata/opengraph-image,
// where the existing graceful-fallback-to-null is appropriate (a broken
// link preview is much lower stakes than the page itself 404ing).
export async function fetchPandalDetail(cityId: string, slug: string, year?: number): Promise<PandalSummary | null> {
  const response = await fetch(pandalDetailUrl(cityId, slug, year), { next: { revalidate: 30 } });
  return safeJson(response, null);
}

// For the page's own initial render: a real 404 (pandal genuinely doesn't
// exist) still resolves to null so the caller can call notFound(), but any
// other failure throws instead of also resolving to null — otherwise a
// transient API error was indistinguishable from "this pandal was never
// real," rendering Next's permanent-looking 404 page for what might just be
// a momentary outage.
export async function fetchPandalDetailOrThrow(cityId: string, slug: string, year?: number): Promise<PandalSummary | null> {
  const response = await fetch(pandalDetailUrl(cityId, slug, year), { next: { revalidate: 30 } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to load pandal (${response.status})`);
  return response.json();
}

export interface NearbyPandal {
  id: string;
  canonicalName: string;
  locality: string;
  latitude: number;
  longitude: number;
}

// Live duplicate check as a pin is dropped (spec §17.1) — location-only, no
// name needed yet, so this is a plain GET with no debouncing concerns beyond
// what the caller adds. Throws on a real failure instead of silently
// returning [] — the caller needs to tell "checked, found nothing nearby"
// apart from "couldn't check," since the latter risks a real duplicate
// submission if it's presented as the former.
export async function fetchNearbyPandals(
  cityId: string,
  latitude: number,
  longitude: number
): Promise<NearbyPandal[]> {
  const url = `${API_BASE_URL}/pandals/nearby?cityId=${cityId}&latitude=${latitude}&longitude=${longitude}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to check nearby pandals (${response.status})`);
  return response.json();
}

export interface NearbyRadiusPandal {
  id: string;
  slug: string;
  canonicalName: string;
  coverImage?: string;
  distanceMeters: number;
}

// Powers the detail page's "Pandals near here (1-2km)" rail (spec §2).
export async function fetchNearbyRadiusPandals(
  cityId: string,
  pandalId: string,
  latitude: number,
  longitude: number,
  year: number
): Promise<NearbyRadiusPandal[]> {
  const params = new URLSearchParams({
    cityId,
    pandalId,
    latitude: String(latitude),
    longitude: String(longitude),
    year: String(year),
  });
  const response = await fetch(`${API_BASE_URL}/pandals/nearby-radius?${params}`, { cache: "no-store" });
  return safeJson(response, []);
}

export async function sendVerificationCode(identifier: string): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/send-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return { ok: false, error: body.error ?? "Could not send code" };
  }
  return { ok: true };
}

export async function verifyCode(identifier: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/verify-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, code }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return { ok: false, error: body.error ?? "Incorrect code" };
  }
  return { ok: true };
}

export interface LocationSearchResult {
  label: string;
  latitude: number;
  longitude: number;
  locality?: string;
  road?: string;
}

export async function searchLocations(
  citySlug: string,
  q: string,
  bias?: { latitude: number; longitude: number }
): Promise<LocationSearchResult[]> {
  if (q.trim().length < 2) return [];
  const params = new URLSearchParams({ citySlug, q });
  if (bias) {
    params.set("lat", String(bias.latitude));
    params.set("lon", String(bias.longitude));
  }
  const response = await fetch(`${API_BASE_URL}/geocode/search?${params}`, { cache: "no-store" });
  return safeJson(response, []);
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<LocationSearchResult | null> {
  const response = await fetch(`${API_BASE_URL}/geocode/reverse?lat=${latitude}&lon=${longitude}`, {
    cache: "no-store",
  });
  return safeJson(response, null);
}

export interface SubmitPandalInput {
  cityId: string;
  type: "NEW_PANDAL" | "UPDATE_PANDAL" | "NEW_YEAR" | "CORRECTION";
  possiblePandalId?: string;
  submittedData: Record<string, unknown>;
  contributorContact: string;
  /** Honeypot — always empty for real visitors, see add-pandal-flow.tsx. */
  website?: string;
}

export async function submitPandal(
  input: SubmitPandalInput
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const response = await fetch(`${API_BASE_URL}/submissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return { ok: false, error: body.error ?? "Could not submit" };
  }
  const body = await safeJson<{ _id?: string }>(response, {});
  return { ok: true, id: body._id };
}

export interface UploadedPhoto {
  url: string;
  width: number;
  height: number;
}

// The resolution cap itself is enforced server-side (Cloudinary transform,
// so it can't be bypassed by a modified client) — this just uploads and
// surfaces a clear error if the API rejects it (wrong type, too large).
export async function uploadPhoto(file: File): Promise<{ ok: boolean; photo?: UploadedPhoto; error?: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/media/upload`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return { ok: false, error: body.error ?? "Could not upload photo" };
  }
  const photo = await safeJson<UploadedPhoto | null>(response, null);
  if (!photo) return { ok: false, error: "Could not upload photo" };
  return { ok: true, photo };
}

// Best-effort cleanup for a photo that was uploaded but never ended up in a
// submission (removed before continuing, or the flow was abandoned) —
// fire-and-forget from the caller's perspective, so failures here are
// swallowed rather than surfaced (there's no user-facing action to retry).
export async function deletePhoto(url: string): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/media/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      keepalive: true,
    });
  } catch {
    // best-effort — nothing the caller can do about a failed cleanup call
  }
}

// Whether *this* anonymous visitor already liked this pandal year — without
// this, the detail/preview screens had no way to tell apart "never liked"
// from "liked in a previous visit," so the heart always rendered unliked
// for a returning visitor and tapping it would silently un-like instead.
export async function fetchLikedStatus(pandalYearId: string, anonymousVisitorId: string): Promise<boolean> {
  const params = new URLSearchParams({ pandalYearId, anonymousVisitorId });
  const response = await fetch(`${API_BASE_URL}/reactions/mine?${params}`, { cache: "no-store" });
  const body = await safeJson<{ liked: boolean }>(response, { liked: false });
  return body.liked;
}

export interface ReactionToggleResult {
  liked: boolean;
  count: number;
}

// Throws on failure (network error or non-2xx) instead of resolving to
// something fake — the caller applies an optimistic update before this
// resolves and needs to be able to tell a real failure apart from success
// in order to roll that update back.
export async function toggleReaction(pandalYearId: string, anonymousVisitorId: string): Promise<ReactionToggleResult> {
  const response = await fetch(`${API_BASE_URL}/reactions/toggle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pandalYearId, anonymousVisitorId }),
  });
  if (!response.ok) throw new Error(`Failed to toggle reaction (${response.status})`);
  return response.json();
}
