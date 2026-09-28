import { notFound } from "next/navigation";
import { fetchCityBySlug, fetchPandalsForCityOrThrow } from "@/lib/api";
import { ExploreBrowser } from "@/components/explore-browser";

export default async function ExplorePage({
  params,
  searchParams,
}: {
  params: Promise<{ citySlug: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { citySlug } = await params;
  const { year: yearParam } = await searchParams;
  const city = await fetchCityBySlug(citySlug);
  if (!city) notFound();

  const year = yearParam ? Number(yearParam) : city.activeFestivalYear;
  const pandals = await fetchPandalsForCityOrThrow(city.slug, undefined, year);

  return <ExploreBrowser citySlug={city.slug} cityName={city.name} year={year} pandals={pandals} />;
}
