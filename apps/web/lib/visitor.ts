const VISITOR_ID_KEY = "durgapandals_visitor_id";
const SAVED_KEY = "durgapandals_saved_pandals";
const SEEN_INTRO_KEY = "durgapandals_seen_intro";

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
}
