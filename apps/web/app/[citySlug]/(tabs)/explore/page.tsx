import { notFound } from "next/navigation";
import { fetchCityBySlug, fetchPandalsForCityOrThrow } from "@/lib/api";
import { ExploreBrowser } from "@/components/explore-browser";

// This list view (unlike the map page) already renders every pandal as a
// real server-rendered <a href="/city/pandal/slug"> with visible text — the
// strongest page on the site for search engines to actually crawl and
// index individual pandals from. It still inherited the generic sitewide
// title/description before this, same gap the map page had.
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
  const title = `Explore Durga Pandals in ${city.name} ${year}`;
  const description = `Browse every Durga Puja pandal in ${city.name} for ${year} — themes, localities, organisers and directions, searchable and filterable by area.`;

  return {
    title,
    description,
    openGraph: { title, description },
    alternates: { canonical: `/${citySlug}/explore` },
  };
}

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
