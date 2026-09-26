import { notFound } from "next/navigation";
import { fetchCityBySlug, fetchPandalsForCity } from "@/lib/api";
import { MapHome } from "@/components/map-home";

const MAP_TILES_URL =
  process.env.NEXT_PUBLIC_MAP_TILES_URL ?? "https://tiles.openfreemap.org/styles/liberty";

export default async function CityMapPage({ params }: { params: Promise<{ citySlug: string }> }) {
  const { citySlug } = await params;
  const city = await fetchCityBySlug(citySlug);
  if (!city || city.status === "DISABLED") notFound();

  const pandals = await fetchPandalsForCity(city.slug);

  return (
    <MapHome
      citySlug={city.slug}
      cityName={city.name}
      center={{ latitude: city.latitude, longitude: city.longitude }}
      zoom={city.defaultMapZoom}
      mapTilesUrl={MAP_TILES_URL}
      pandals={pandals}
    />
  );
}
