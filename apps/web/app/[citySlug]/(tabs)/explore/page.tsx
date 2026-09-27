import { notFound } from "next/navigation";
import { fetchCityBySlug, fetchPandalsForCity } from "@/lib/api";
import { ExploreBrowser } from "@/components/explore-browser";

export default async function ExplorePage({ params }: { params: Promise<{ citySlug: string }> }) {
  const { citySlug } = await params;
  const city = await fetchCityBySlug(citySlug);
  if (!city) notFound();

  const pandals = await fetchPandalsForCity(city.slug);

  return <ExploreBrowser citySlug={city.slug} cityName={city.name} pandals={pandals} />;
}
