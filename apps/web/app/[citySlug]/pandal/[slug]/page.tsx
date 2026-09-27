import { notFound } from "next/navigation";
import { fetchCityBySlug, fetchPandalDetail, fetchNearbyRadiusPandals } from "@/lib/api";
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
}: {
  params: Promise<{ citySlug: string; slug: string }>;
}) {
  const { citySlug, slug } = await params;
  const city = await fetchCityBySlug(citySlug);
  if (!city) notFound();

  const pandal = await fetchPandalDetail(city._id, slug);
  if (!pandal) notFound();

  const nearby = pandal.year
    ? await fetchNearbyRadiusPandals(city._id, pandal.id, pandal.latitude, pandal.longitude, pandal.year.year)
    : [];

  return (
    <PandalDetail citySlug={city.slug} cityName={city.name} pandal={pandal} nearby={nearby} mapTilesUrl={MAP_TILES_URL} />
  );
}
