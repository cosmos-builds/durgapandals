import { notFound } from "next/navigation";
import { fetchCityBySlug, fetchPandalDetail } from "@/lib/api";
import { PandalDetail } from "@/components/pandal-detail";

const MAP_TILES_URL =
  process.env.NEXT_PUBLIC_MAP_TILES_URL ?? "https://tiles.openfreemap.org/styles/liberty";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ citySlug: string; slug: string }>;
}) {
  const { slug } = await params;
  return {
    title: `${slug.replace(/-/g, " ")} · DurgaPandals.com`,
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

  return <PandalDetail citySlug={city.slug} cityName={city.name} pandal={pandal} mapTilesUrl={MAP_TILES_URL} />;
}
