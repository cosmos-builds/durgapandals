import { notFound } from "next/navigation";
import { fetchCityBySlug, fetchPandalsForCityOrThrow } from "@/lib/api";
import { MapHome } from "@/components/map-home";
import { getAvailableFestivalYears } from "@/lib/festival-years";

const MAP_TILES_URL =
  process.env.NEXT_PUBLIC_MAP_TILES_URL ?? "https://tiles.openfreemap.org/styles/liberty";

// Without this, every city shared the root layout's generic sitewide
// title/description — a search for "durga pandal <city>" had nothing
// city-specific to match against on this, the actual canonical page for
// that city.
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ citySlug: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { citySlug } = await params;
  const { year: yearParam } = await searchParams;
  const city = await fetchCityBySlug(citySlug).catch(() => null);
  if (!city) return {};

  const year = yearParam ? Number(yearParam) : city.activeFestivalYear;
  const title = `Durga Pandals in ${city.name} ${year}`;
  const description = `Explore Durga Puja and Navratri pandals in ${city.name} for ${year} — locations, themes, timings, photos and directions, all on one map.`;

  return {
    title,
    description,
    openGraph: { title, description },
    // Ignores `?year=` on purpose — the sitemap only ever lists the bare
    // `/city` URL (see app/sitemap.ts), so a `?year=2025` visit should point
    // back at that one canonical page rather than being indexed as a
    // separate near-duplicate for each year.
    alternates: { canonical: `/${citySlug}` },
  };
}

export default async function CityMapPage({
  params,
  searchParams,
}: {
  params: Promise<{ citySlug: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { citySlug } = await params;
  const { year: yearParam } = await searchParams;
  const city = await fetchCityBySlug(citySlug);
  if (!city || city.status === "DISABLED") notFound();

  // Always fetched server-side, regardless of whether this visitor has
  // dismissed the intro overlay — this used to be skipped (sending an empty
  // placeholder array) for anyone without the "seen intro" cookie, as a
  // micro-optimization against a fetch the intro's city picker might throw
  // away. But a crawler never carries that cookie, so that gate meant every
  // single crawl of this page saw an empty pandal list with no real content
  // to index, regardless of how many pandals the city actually has. The
  // intro overlay (`<IntroHero>` in MapHome) still renders as a pure visual
  // layer on top of this real data, exactly like the splash screen does.
  const year = yearParam ? Number(yearParam) : city.activeFestivalYear;
  const pandals = await fetchPandalsForCityOrThrow(city.slug, undefined, year);
  const availableYears = getAvailableFestivalYears();

  return (
    <MapHome
      citySlug={city.slug}
      cityName={city.name}
      year={year}
      activeFestivalYear={city.activeFestivalYear}
      availableYears={availableYears}
      center={{ latitude: city.latitude, longitude: city.longitude }}
      zoom={city.defaultMapZoom}
      mapTilesUrl={MAP_TILES_URL}
      pandals={pandals}
    />
  );
}
