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
export async function adminFetch(path: string, init: RequestInit = {}) {
  const token = getAdminToken();
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
  });
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
