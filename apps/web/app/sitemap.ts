import type { MetadataRoute } from "next";
import { fetchCities, fetchPandalsForCity } from "@/lib/api";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://durgapandal.com";

export const revalidate = 3600;

// `/`, `/[citySlug]/add`, and `/[citySlug]/saved` are deliberately excluded:
// `/` is just a redirect to a city, `/add` is a submission form with no
// unique content to index, and `/saved` is a personal, client-side-only
// list that renders the same empty shell for every visitor server-side.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cities = await fetchCities();
  const activeCities = cities.filter((city) => city.status === "ACTIVE");

  const pandalsByCity = await Promise.all(activeCities.map((city) => fetchPandalsForCity(city.slug)));

  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/about`, changeFrequency: "yearly", priority: 0.3 },
  ];

  activeCities.forEach((city, index) => {
    entries.push({ url: `${SITE_URL}/${city.slug}`, changeFrequency: "daily", priority: 0.9 });
    entries.push({ url: `${SITE_URL}/${city.slug}/explore`, changeFrequency: "daily", priority: 0.7 });

    for (const pandal of pandalsByCity[index] ?? []) {
      entries.push({
        url: `${SITE_URL}/${city.slug}/pandal/${pandal.slug}`,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  });

  return entries;
}
