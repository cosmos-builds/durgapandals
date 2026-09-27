import { notFound } from "next/navigation";
import { fetchCityBySlug } from "@/lib/api";
import { BottomNav } from "@/components/bottom-nav";

// Scoped to the (tabs) route group — Map/Explore/Saved get the mobile bottom
// tab bar (a mobile-only pattern, spec §4); Add Pandal and the pandal detail
// page live outside this group since neither has a bottom-tab presence in
// the design. The desktop persistent top nav bar lives one level up, in
// `[citySlug]/layout.tsx`, since it spans these routes too.
export default async function TabsLayout({
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
    <>
      {children}
      <BottomNav citySlug={city.slug} />
    </>
  );
}
