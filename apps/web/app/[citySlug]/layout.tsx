import { notFound } from "next/navigation";
import { fetchCityBySlug } from "@/lib/api";
import { TopHeader } from "@/components/top-header";
import { LastCityTracker } from "@/components/last-city-tracker";

// Wraps every screen under a city — (tabs) [Home/Explore/Saved], add, and
// pandal/[slug] — so the desktop persistent top nav bar (spec §5) appears on
// all of them, not just the tab screens. It's desktop-only (see TopHeader);
// each screen supplies its own mobile-appropriate header instead of sharing
// one across breakpoints.
export default async function CityShellLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ citySlug: string }>;
}) {
  const { citySlug } = await params;
  const city = await fetchCityBySlug(citySlug);
  if (!city) notFound();

  const availableYears = [city.activeFestivalYear, city.activeFestivalYear - 1, city.activeFestivalYear - 2];

  return (
    <div className="relative min-h-dvh bg-ground">
      <LastCityTracker citySlug={city.slug} />
      <TopHeader citySlug={city.slug} cityName={city.name} activeFestivalYear={city.activeFestivalYear} availableYears={availableYears} />
      {children}
    </div>
  );
}
