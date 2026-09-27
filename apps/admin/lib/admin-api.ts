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
