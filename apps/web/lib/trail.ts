import { MAX_TRAIL_STOPS } from "@durgapandals/maps";

// A "trail" is an ordered list of pandal slugs the visitor wants to hop
// between in one outing — purely local, no account, same accountless
// pattern as Saved (see visitor.ts's SAVED_KEY_BY_CITY). Namespaced by city
// for the same reason saves are: a slug is only unique within a city.
const TRAIL_KEY_BY_CITY = "durgapandals_trail_by_city";

function readTrailMap(): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(TRAIL_KEY_BY_CITY) ?? "{}");
  } catch {
    return {};
  }
}

function writeTrailMap(map: Record<string, string[]>) {
  window.localStorage.setItem(TRAIL_KEY_BY_CITY, JSON.stringify(map));
  // Same-tab listeners (TrailFab, TrailButton) don't get the native `storage`
  // event — that only fires in *other* tabs — so this synthesizes an
  // equivalent one they can all subscribe to instead of each polling state.
  window.dispatchEvent(new CustomEvent("durgapandals:trail-changed"));
}

export function getTrail(citySlug: string): string[] {
  return readTrailMap()[citySlug] ?? [];
}

export function isInTrail(citySlug: string, slug: string): boolean {
  return getTrail(citySlug).includes(slug);
}

// Returns false (and leaves the trail unchanged) once MAX_TRAIL_STOPS is hit
// — Google's directions URL silently drops anything past that, so the UI
// needs to refuse the add rather than let the visitor build a trail that
// quietly loses its last few stops on export.
export function addToTrail(citySlug: string, slug: string): boolean {
  const map = readTrailMap();
  const current = map[citySlug] ?? [];
  if (current.includes(slug)) return true;
  if (current.length >= MAX_TRAIL_STOPS) return false;
  map[citySlug] = [...current, slug];
  writeTrailMap(map);
  return true;
}

export function removeFromTrail(citySlug: string, slug: string) {
  const map = readTrailMap();
  const current = map[citySlug] ?? [];
  map[citySlug] = current.filter((s) => s !== slug);
  writeTrailMap(map);
}

export function toggleTrail(citySlug: string, slug: string): boolean {
  if (isInTrail(citySlug, slug)) {
    removeFromTrail(citySlug, slug);
    return false;
  }
  return addToTrail(citySlug, slug);
}

export function reorderTrail(citySlug: string, orderedSlugs: string[]) {
  const map = readTrailMap();
  map[citySlug] = orderedSlugs;
  writeTrailMap(map);
}

export function clearTrail(citySlug: string) {
  const map = readTrailMap();
  delete map[citySlug];
  writeTrailMap(map);
}

export const TRAIL_CHANGED_EVENT = "durgapandals:trail-changed";
