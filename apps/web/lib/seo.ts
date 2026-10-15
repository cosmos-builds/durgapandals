export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://durgapandal.com";
export const SITE_NAME = "DurgaPandal.com";

// People search for the same thing many ways — "Durga Puja", "Durga Pooja",
// "Durga Darshan", "Durgotsav", "Navratri pandal" — and a page only ranks
// for wording it actually contains, so titles/descriptions/copy rotate
// through these instead of repeating just "pandals".
export function cityTitle(cityName: string, year: number): string {
  return `Durga Puja Pandals in ${cityName} ${year} — Durga Darshan Map & Pandal List`;
}

export function cityDescription(cityName: string, year: number): string {
  return `Find every Durga Puja (Durga Pooja) and Navratri pandal in ${cityName} for ${year}. Plan your Durga Darshan and pandal hopping with a live map, themes, timings, photos and directions.`;
}

export function exploreTitle(cityName: string, year: number): string {
  return `${cityName} Durga Puja ${year}: Pandal List, Themes & Locations`;
}

export function exploreDescription(cityName: string, year: number): string {
  return `Browse the full list of ${cityName} Durga Puja ${year} pandals — Durga Darshan by area, with themes, organisers, addresses and directions.`;
}

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path}`;
}
