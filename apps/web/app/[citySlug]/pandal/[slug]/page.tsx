import { notFound } from "next/navigation";
import { fetchCityBySlug, fetchPandalDetail, fetchPandalDetailOrThrow, fetchNearbyRadiusPandals } from "@/lib/api";
import { PandalDetail } from "@/components/pandal-detail";
import { JsonLd } from "@/components/json-ld";
import { absoluteUrl } from "@/lib/seo";

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

  const yearLabel = pandal.year?.year ?? city!.activeFestivalYear;
  const title = `${pandal.canonicalName} — Durga Puja ${yearLabel}, ${pandal.locality}, ${city!.name}`;
  const description = pandal.year?.theme
    ? `${pandal.canonicalName} Durga Puja ${yearLabel} in ${pandal.locality}, ${city!.name} — theme: ${pandal.year.theme}. Photos, timings and directions for your Durga Darshan.`
    : `${pandal.canonicalName} Durga Puja ${yearLabel} in ${pandal.locality}, ${city!.name}. Location, photos, timings and directions for your Durga Darshan.`;

  // No `openGraph.images` here on purpose — this segment's own
  // opengraph-image.tsx (the pandal's real photo) already supplies it, and
  // Next.js merges file-convention images with metadata title/description.
  return {
    title,
    description,
    openGraph: { title, description },
    // Ignores `?year=` — the sitemap only lists the bare slug URL (see
    // app/sitemap.ts), so a past-year visit should canonicalize back to it
    // instead of being indexed as a separate near-duplicate per year.
    alternates: { canonical: `/${citySlug}/pandal/${slug}` },
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
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Place",
            name: pandal.canonicalName,
            description: pandal.year?.theme ?? undefined,
            url: absoluteUrl(`/${city.slug}/pandal/${slug}`),
            image: pandal.year?.coverImage ?? undefined,
            geo: { "@type": "GeoCoordinates", latitude: pandal.latitude, longitude: pandal.longitude },
            address: {
              "@type": "PostalAddress",
              streetAddress: pandal.address,
              addressLocality: city.name,
              addressCountry: "IN",
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
              { "@type": "ListItem", position: 2, name: city.name, item: absoluteUrl(`/${city.slug}`) },
              {
                "@type": "ListItem",
                position: 3,
                name: pandal.canonicalName,
                item: absoluteUrl(`/${city.slug}/pandal/${slug}`),
              },
            ],
          },
        ]}
      />
      <PandalDetail citySlug={city.slug} cityName={city.name} pandal={pandal} nearby={nearby} mapTilesUrl={MAP_TILES_URL} />
    </>
  );
}
