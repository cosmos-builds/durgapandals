import { notFound } from "next/navigation";
import { fetchCityBySlug } from "@/lib/api";
import { AddPandalFlow } from "@/components/add-pandal-flow";

const MAP_TILES_URL =
  process.env.NEXT_PUBLIC_MAP_TILES_URL ?? "https://tiles.openfreemap.org/styles/liberty";

export default async function AddPandalPage({ params }: { params: Promise<{ citySlug: string }> }) {
  const { citySlug } = await params;
  const city = await fetchCityBySlug(citySlug);
  if (!city) notFound();

  return (
    <AddPandalFlow
      cityId={city._id}
      citySlug={city.slug}
      cityName={city.name}
      center={{ latitude: city.latitude, longitude: city.longitude }}
      zoom={city.defaultMapZoom}
      activeFestivalYear={city.activeFestivalYear}
      mapTilesUrl={MAP_TILES_URL}
    />
  );
}
