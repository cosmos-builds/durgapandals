const VISITOR_ID_KEY = "durgapandals_visitor_id";
const SAVED_KEY = "durgapandals_saved_pandals";
const SEEN_INTRO_KEY = "durgapandals_seen_intro";

// Cookie mirrors of the two localStorage flags above — localStorage isn't
// readable during server-side rendering, so the root page (deciding which
// city to redirect a bare "/" visit to) and the map page (deciding whether
// it's safe to skip the initial pandal fetch behind the intro overlay) read
// these cookie names via next/headers `cookies()` instead. Exported so
// server code and this client code agree on the exact names.
export const LAST_CITY_COOKIE = "durgapandals_last_city";
export const SEEN_INTRO_COOKIE = "durgapandals_seen_intro";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function setCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
}

// No visitor account in V1 (spec §12, §13.2) — a random id in localStorage
// stands in for identity, purely to let the server enforce "one like per
// visitor per PandalYear".
export function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(VISITOR_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_ID_KEY, id);
  }
  return id;
}

export function getSavedPandalSlugs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(SAVED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function toggleSavedPandal(slug: string): boolean {
  const saved = new Set(getSavedPandalSlugs());
  let isSaved: boolean;
  if (saved.has(slug)) {
    saved.delete(slug);
    isSaved = false;
  } else {
    saved.add(slug);
    isSaved = true;
  }
  window.localStorage.setItem(SAVED_KEY, JSON.stringify([...saved]));
  return isSaved;
}

// The festive intro hero (see intro-hero.tsx) shows once ever, site-wide —
// not per-city, so switching cities later doesn't re-trigger it.
export function hasSeenIntro(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(SEEN_INTRO_KEY) === "1";
}

export function markIntroSeen() {
  window.localStorage.setItem(SEEN_INTRO_KEY, "1");
  setCookie(SEEN_INTRO_COOKIE, "1");
}

// Lets a bare "/" visit resume wherever the visitor actually was, instead of
// always falling back to the algorithmic default city — set on every city
// page view (see LastCityTracker), read server-side by the root page.
export function rememberLastCity(citySlug: string) {
  setCookie(LAST_CITY_COOKIE, citySlug);
}
