import { notFound } from "next/navigation";
import { fetchCityBySlug, fetchPandalsForCity } from "@/lib/api";
import { SavedList } from "@/components/saved-list";

export default async function SavedPage({ params }: { params: Promise<{ citySlug: string }> }) {
  const { citySlug } = await params;
  const city = await fetchCityBySlug(citySlug);
  if (!city) notFound();

  const pandals = await fetchPandalsForCity(city.slug);

  return <SavedList citySlug={city.slug} cityName={city.name} allPandals={pandals} />;
}
