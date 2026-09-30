import { notFound } from "next/navigation";
import { fetchCityBySlug, fetchPandalDetailOrThrow } from "@/lib/api";
import { ReportPandalFlow } from "@/components/report-pandal-flow";

export default async function ReportPandalPage({
  params,
}: {
  params: Promise<{ citySlug: string; slug: string }>;
}) {
  const { citySlug, slug } = await params;
  const city = await fetchCityBySlug(citySlug);
  if (!city) notFound();

  const pandal = await fetchPandalDetailOrThrow(city._id, slug);
  if (!pandal) notFound();

  return (
    <ReportPandalFlow
      citySlug={city.slug}
      cityName={city.name}
      cityId={city._id}
      activeFestivalYear={city.activeFestivalYear}
      pandalId={pandal.id}
      pandalName={pandal.canonicalName}
    />
  );
}
