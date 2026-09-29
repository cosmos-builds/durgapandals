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

// Pandal slugs are only unique *within* a city (Pandal's own unique index is
// `{cityId, slug}`), so the original flat "durgapandals_saved_pandals" array
// could show a save in City A as also saved in City B whenever two different
// pandals happened to slugify to the same string. Saves are now namespaced
// by city under this key instead; exported so SavedList can listen for the
// `storage` event and pick up a save/unsave made in another tab.
export const SAVED_KEY_BY_CITY = "durgapandals_saved_pandals_by_city";

function readSavedMap(): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(SAVED_KEY_BY_CITY) ?? "{}");
  } catch {
    return {};
  }
}

function writeSavedMap(map: Record<string, string[]>) {
  window.localStorage.setItem(SAVED_KEY_BY_CITY, JSON.stringify(map));
}

// One-time migration of pre-namespacing saves into whichever city the
// visitor happens to be looking at the first time this runs after the
// change — most visitors only ever used one city, so this recovers their
// existing bookmarks instead of silently dropping them; the old key is then
// removed so this only ever runs once.
function migrateLegacySavedSlugs(citySlug: string) {
  if (typeof window === "undefined") return;
  const legacyRaw = window.localStorage.getItem(SAVED_KEY);
  if (!legacyRaw) return;
  try {
    const legacySlugs: unknown = JSON.parse(legacyRaw);
    if (Array.isArray(legacySlugs) && legacySlugs.length > 0) {
      const map = readSavedMap();
      const merged = new Set([...(map[citySlug] ?? []), ...(legacySlugs as string[])]);
      map[citySlug] = [...merged];
      writeSavedMap(map);
    }
  } catch {
    // malformed legacy data — nothing worth recovering
  }
  window.localStorage.removeItem(SAVED_KEY);
}

export function getSavedPandalSlugs(citySlug: string): string[] {
  migrateLegacySavedSlugs(citySlug);
  return readSavedMap()[citySlug] ?? [];
}

export function toggleSavedPandal(citySlug: string, slug: string): boolean {
  migrateLegacySavedSlugs(citySlug);
  const map = readSavedMap();
  const saved = new Set(map[citySlug] ?? []);
  let isSaved: boolean;
  if (saved.has(slug)) {
    saved.delete(slug);
    isSaved = false;
  } else {
    saved.add(slug);
    isSaved = true;
  }
  map[citySlug] = [...saved];
  writeSavedMap(map);
  return isSaved;
}

// Drops any saved slug that no longer matches a real pandal — called by
// SavedList after a *successful* fetch of the city's pandal list, so an
// empty/short result here means "genuinely not found," not "the request
// failed" (a failed fetch throws instead of returning [], see
// fetchPandalsForCityOrThrow).
export function pruneSavedSlugs(citySlug: string, validSlugs: string[]) {
  const map = readSavedMap();
  const current = map[citySlug];
  if (!current) return;
  const validSet = new Set(validSlugs);
  const pruned = current.filter((slug) => validSet.has(slug));
  if (pruned.length !== current.length) {
    map[citySlug] = pruned;
    writeSavedMap(map);
  }
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

// The mobile "no pandals yet, add one" empty-state banner (see MapHome) is
// dismissible; remembered per city+year so it doesn't reappear on every
// visit to a still-empty city, but comes back once that city/year actually
// gets pandals (a fresh empty-state, e.g. next year, should still show).
const DISMISSED_ADD_BANNER_KEY = "durgapandals_dismissed_add_banner";

export function hasDismissedAddPandalBanner(citySlug: string, year: number): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DISMISSED_ADD_BANNER_KEY) === `${citySlug}:${year}`;
}

export function dismissAddPandalBanner(citySlug: string, year: number) {
  window.localStorage.setItem(DISMISSED_ADD_BANNER_KEY, `${citySlug}:${year}`);
}

// Lets a bare "/" visit resume wherever the visitor actually was, instead of
// always falling back to the algorithmic default city — set on every city
// page view (see LastCityTracker), read server-side by the root page.
export function rememberLastCity(citySlug: string) {
  setCookie(LAST_CITY_COOKIE, citySlug);
}
