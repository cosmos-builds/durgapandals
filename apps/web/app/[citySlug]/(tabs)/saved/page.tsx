import { notFound } from "next/navigation";
import { fetchCityBySlug, fetchPandalsForCityOrThrow, type PandalSummary } from "@/lib/api";
import { SavedList } from "@/components/saved-list";

export default async function SavedPage({ params }: { params: Promise<{ citySlug: string }> }) {
  const { citySlug } = await params;
  const city = await fetchCityBySlug(citySlug);
  if (!city) notFound();

  // A pandal saved while browsing a past festival year has no entry in the
  // *current* year's list (the API only returns a pandal if it has a
  // published PandalYear for the requested year) — fetching only the active
  // year meant such a save just silently vanished from this page. Merging
  // the last three years (newest first, first-write-wins) means a saved
  // pandal keeps showing with its most recent available year's data even if
  // it isn't live this year.
  const years = [city.activeFestivalYear, city.activeFestivalYear - 1, city.activeFestivalYear - 2];
  const yearLists = await Promise.all(years.map((year) => fetchPandalsForCityOrThrow(city.slug, undefined, year)));
  const byId = new Map<string, PandalSummary>();
  for (const list of yearLists) {
    for (const pandal of list) {
      if (!byId.has(pandal.id)) byId.set(pandal.id, pandal);
    }
  }

  return <SavedList citySlug={city.slug} cityName={city.name} allPandals={[...byId.values()]} />;
}
