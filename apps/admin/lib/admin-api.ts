import type { CitySearchResult } from "@durgapandals/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "durgapandals_admin_token";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

// Reads the admin's real email straight out of the JWT payload for display
// in the sidebar (spec: admin identity, not a fabricated "Super Admin"
// placeholder) — no signature check needed since this is read-only UI, the
// API independently re-verifies the token's signature on every request.
export function getAdminEmail(): string | null {
  const token = getAdminToken();
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return (JSON.parse(json) as { email?: string }).email ?? null;
  } catch {
    return null;
  }
}

export async function adminLogin(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error("Invalid credentials");
  const { token } = await response.json();
  return token as string;
}

// The frontend gate is UX convenience only — every request still needs a
// valid token because the backend enforces authorization independently
// (spec §20, §21), so a hidden/removed route here is never the real defense.
//
// The 8-hour session token realistically expires mid-session for an admin
// doing a long review pass — before this, a 401 here was treated exactly
// like any other response: `res.ok` was false, so most callers' loaders
// just showed an empty/zero state and most mutations silently did nothing,
// with zero indication the admin needed to log in again. Clearing the token
// and hard-redirecting to /login on any 401 turns that into an actual
// re-auth prompt instead of a mysteriously "broken" app.
export async function adminFetch(path: string, init: RequestInit = {}) {
  const token = getAdminToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
  });
  if (response.status === 401 && typeof window !== "undefined") {
    clearAdminToken();
    window.location.href = "/login";
  }
  return response;
}

export interface MutationResult {
  ok: boolean;
  error?: string;
}

// Shared by every PATCH/POST call site that mutates something and needs to
// know whether it actually worked — previously each one either checked
// `res.ok` inconsistently or, in most cases, not at all, so a failed
// approve/save/toggle looked identical to a successful one.
export async function adminMutate(path: string, init: RequestInit = {}): Promise<MutationResult> {
  const response = await adminFetch(path, init);
  if (response.ok) return { ok: true };
  const body = await response.json().catch(() => ({}));
  return { ok: false, error: body.error ?? "Something went wrong — please try again." };
}

// Mirrors apps/web's searchCities — merges already-listed cities with live
// OpenStreetMap results so an admin adding a pandal isn't limited to
// whatever's already been created via the Cities admin page.
export async function searchCities(q: string): Promise<CitySearchResult[]> {
  if (q.trim().length < 2) return [];
  const res = await adminFetch(`/cities/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  return res.json();
}

export interface ResolvedCity {
  _id: string;
  name: string;
  slug: string;
  latitude: number;
  longitude: number;
  defaultMapZoom: number;
}

// Idempotent find-or-create for a "nominatim" search result — safe to call
// again for a city that already exists.
export async function resolveCity(candidate: {
  name: string;
  state: string;
  latitude: number;
  longitude: number;
}): Promise<ResolvedCity | null> {
  const res = await adminFetch("/cities/resolve", { method: "POST", body: JSON.stringify(candidate) });
  if (!res.ok) return null;
  return res.json();
}

export interface ReverseGeocodeResult {
  label: string;
  latitude: number;
  longitude: number;
  locality?: string;
  road?: string;
}

// Backs the map picker's "drag map, address fills in" behavior (same
// /geocode/reverse route apps/web already uses — it isn't admin- or
// web-specific, just a general geocoding proxy).
export async function reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult | null> {
  const res = await adminFetch(`/geocode/reverse?lat=${latitude}&lon=${longitude}`);
  if (!res.ok) return null;
  return res.json();
}

export interface UploadedPhoto {
  url: string;
  width: number;
  height: number;
}

// Bypasses adminFetch: a multipart upload needs the browser to set its own
// Content-Type boundary, which adminFetch's hardcoded "application/json"
// header would break. Hits the same public, unauthenticated /media/upload
// route apps/web's Add Pandal flow uses (apps/api/src/media/media.routes.ts)
// — the actual admin-authorized action is the PATCH that attaches the
// resulting URL to a PandalYear, which still goes through adminMutate.
export async function uploadAdminPhoto(
  file: File
): Promise<{ ok: boolean; photo?: UploadedPhoto; error?: string }> {
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
  const photo = await response.json().catch(() => null);
  if (!photo) return { ok: false, error: "Could not upload photo" };
  return { ok: true, photo };
}

// Best-effort cleanup for a photo uploaded but never saved onto a
// PandalYear (removed before the PATCH, or the admin navigates away) — same
// fire-and-forget pattern as apps/web's deletePhoto.
export async function deleteAdminPhoto(url: string) {
  await fetch(`${API_BASE_URL}/media/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    keepalive: true,
  }).catch(() => {});
}
