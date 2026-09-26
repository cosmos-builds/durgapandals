import { notFound } from "next/navigation";
import { fetchCityBySlug } from "@/lib/api";
import { TopHeader } from "@/components/top-header";
import { BottomNav } from "@/components/bottom-nav";

// Scoped to the (tabs) route group — Map/Explore/Saved share this persistent
// header+nav chrome, same as the design's tab screens. Add Pandal and the
// pandal detail page live outside this group on purpose: both have their own
// contextual back-button header in the design with no shared chrome, so
// nesting them here would stack two headers and the back button would
// visually collide with the logo.
// TopHeader/BottomNav are rendered exactly once here so Next.js keeps them
// mounted across client-side navigation between the tabs instead of
// remounting/flickering on every route change.
export default async function CityLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ citySlug: string }>;
}) {
  const { citySlug } = await params;
  const city = await fetchCityBySlug(citySlug);
  if (!city) notFound();

  return (
    <div className="relative min-h-dvh bg-ground">
      <TopHeader citySlug={city.slug} cityName={city.name} />
      {children}
      <BottomNav citySlug={city.slug} />
    </div>
  );
}
