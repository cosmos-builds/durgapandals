import { notFound } from "next/navigation";
import { fetchCityBySlug, fetchPandalsForCity } from "@/lib/api";
import { MapHome } from "@/components/map-home";

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

  const year = yearParam ? Number(yearParam) : city.activeFestivalYear;
  const pandals = await fetchPandalsForCity(city.slug, undefined, year);
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
