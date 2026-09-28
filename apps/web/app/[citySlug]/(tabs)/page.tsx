import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { fetchCityBySlug, fetchPandalsForCityOrThrow } from "@/lib/api";
import { MapHome } from "@/components/map-home";
import { SEEN_INTRO_COOKIE } from "@/lib/visitor";

const MAP_TILES_URL =
  process.env.NEXT_PUBLIC_MAP_TILES_URL ?? "https://tiles.openfreemap.org/styles/liberty";

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

  // A visitor who has never dismissed the intro overlay is about to see a
  // full-screen city picker on top of this page and may well pick a
  // different city — fetching this city's pandal list server-side would be
  // thrown away in that case. MapHome re-fetches once the overlay closes
  // (see its `initialPandals`/`showIntro` handling), so skipping here just
  // avoids the wasted round trip on a cold first visit; returning visitors
  // (cookie present) get the normal eager fetch.
  const hasSeenIntro = (await cookies()).get(SEEN_INTRO_COOKIE)?.value === "1";
  const year = yearParam ? Number(yearParam) : city.activeFestivalYear;
  const pandals = hasSeenIntro ? await fetchPandalsForCityOrThrow(city.slug, undefined, year) : [];
  const availableYears = [city.activeFestivalYear, city.activeFestivalYear - 1, city.activeFestivalYear - 2];

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
