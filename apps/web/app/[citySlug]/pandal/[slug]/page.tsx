import { notFound } from "next/navigation";
import { fetchCityBySlug, fetchPandalDetail, fetchPandalDetailOrThrow, fetchNearbyRadiusPandals } from "@/lib/api";
import { PandalDetail } from "@/components/pandal-detail";

const MAP_TILES_URL =
  process.env.NEXT_PUBLIC_MAP_TILES_URL ?? "https://tiles.openfreemap.org/styles/liberty";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ citySlug: string; slug: string }>;
}) {
  const { citySlug, slug } = await params;
  const city = await fetchCityBySlug(citySlug).catch(() => null);
  const pandal = city ? await fetchPandalDetail(city._id, slug).catch(() => null) : null;
  if (!pandal) return { title: slug.replace(/-/g, " ") };

  const description = pandal.year?.theme
    ? `${pandal.year.theme} — ${pandal.locality}, ${city!.name}`
    : `${pandal.locality}, ${city!.name}`;

  // No `openGraph.images` here on purpose — this segment's own
  // opengraph-image.tsx (the pandal's real photo) already supplies it, and
  // Next.js merges file-convention images with metadata title/description.
  return {
    title: pandal.canonicalName,
    description,
    openGraph: { title: pandal.canonicalName, description },
  };
}

export default async function PandalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ citySlug: string; slug: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { citySlug, slug } = await params;
  const { year: yearParam } = await searchParams;
  const city = await fetchCityBySlug(citySlug);
  if (!city) notFound();

  // Matches whichever festival year the visitor was browsing on Explore/Map
  // (they link here with `?year=`) instead of always showing this pandal's
  // latest published year regardless of where the link came from.
  const year = yearParam ? Number(yearParam) : undefined;
  const pandal = await fetchPandalDetailOrThrow(city._id, slug, year);
  if (!pandal) notFound();

  const nearby = pandal.year
    ? await fetchNearbyRadiusPandals(city._id, pandal.id, pandal.latitude, pandal.longitude, pandal.year.year)
    : [];

  return (
    <PandalDetail citySlug={city.slug} cityName={city.name} pandal={pandal} nearby={nearby} mapTilesUrl={MAP_TILES_URL} />
  );
}
