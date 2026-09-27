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
}

export async function fetchCities(): Promise<CityApiModel[]> {
  const response = await fetch(`${API_BASE_URL}/cities`, { next: { revalidate: 300 } });
  return safeJson(response, []);
}

export async function fetchCityBySlug(slug: string): Promise<CityApiModel | null> {
  const response = await fetch(`${API_BASE_URL}/cities/${slug}`, { next: { revalidate: 300 } });
  return safeJson(response, null);
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
  openingHours?: string;
  parkingInfo?: string;
  entryInfo?: string;
}

export interface PandalSummary {
  id: string;
  slug: string;
  canonicalName: string;
  organizerName?: string;
  latitude: number;
  longitude: number;
  address: string;
  locality: string;
  landmark?: string;
  verificationStatus: string;
  year: PandalYearSummary | null;
  likes: number;
}

export interface BoundingBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

// `bbox` powers "Search this area" on the Map page — omitting it keeps the
// original "every published pandal in the city" behavior (the initial load
// still wants the whole city, not just the starting viewport).
export async function fetchPandalsForCity(citySlug: string, bbox?: BoundingBox): Promise<PandalSummary[]> {
  const params = new URLSearchParams({ citySlug });
  if (bbox) {
    params.set("minLat", String(bbox.minLat));
    params.set("minLng", String(bbox.minLng));
    params.set("maxLat", String(bbox.maxLat));
    params.set("maxLng", String(bbox.maxLng));
  }
  const response = await fetch(`${API_BASE_URL}/pandals?${params}`, {
    cache: bbox ? "no-store" : undefined,
    next: bbox ? undefined : { revalidate: 30 },
  });
  return safeJson(response, []);
}

export async function fetchPandalDetail(cityId: string, slug: string): Promise<PandalSummary | null> {
  const response = await fetch(`${API_BASE_URL}/pandals/${cityId}/${slug}`, {
    next: { revalidate: 30 },
  });
  return safeJson(response, null);
}

export interface NearbyPandal {
  id: string;
  canonicalName: string;
  locality: string;
}

// Live duplicate check as a pin is dropped (spec §17.1) — location-only, no
// name needed yet, so this is a plain GET with no debouncing concerns beyond
// what the caller adds.
export async function fetchNearbyPandals(
  cityId: string,
  latitude: number,
  longitude: number
): Promise<NearbyPandal[]> {
  const url = `${API_BASE_URL}/pandals/nearby?cityId=${cityId}&latitude=${latitude}&longitude=${longitude}`;
  const response = await fetch(url, { cache: "no-store" });
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
