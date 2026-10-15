import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchCities } from "@/lib/api";
import { LAST_CITY_COOKIE } from "@/lib/visitor";
import { JsonLd } from "@/components/json-ld";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

const TITLE = "Durga Puja Pandals 2026 — Durga Darshan Map & Pandal List Across India";
const DESCRIPTION =
  "Find Durga Puja (Durga Pooja) and Navratri pandals near you. Plan Durga Darshan and pandal hopping with a live map, themes, timings, photos and directions — free, no login.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: TITLE, description: DESCRIPTION },
};

// A returning visitor still resumes at whichever city they last looked at
// (tracked via LastCityTracker); only someone with no saved city — a
// first-time visitor, or a search-engine crawler, which never carries the
// cookie — sees this page. It used to redirect every request, which left
// the site's front door as an empty redirect with nothing for a search
// engine to read, rank, or follow into the city pages.
export default async function RootPage() {
  const cities = await fetchCities();
  const activeCities = cities.filter((city) => city.status === "ACTIVE");

  const lastCitySlug = (await cookies()).get(LAST_CITY_COOKIE)?.value;
  const lastCity = lastCitySlug ? activeCities.find((c) => c.slug === lastCitySlug) : undefined;
  if (lastCity) redirect(`/${lastCity.slug}`);

  if (activeCities.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ground p-8 text-center text-ink">
        <p className="font-body text-ink-muted">
          No cities are configured yet. Add one in the admin app to get started.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-ground px-5 py-14 text-ink">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: SITE_NAME,
            url: SITE_URL,
            description: DESCRIPTION,
          },
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: SITE_NAME,
            url: SITE_URL,
          },
        ]}
      />
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <h1 className="font-display text-3xl font-extrabold tracking-tight md:text-5xl">
          Durga Puja Pandals 2026 — Find Durga Darshan Near You
        </h1>
        <p className="font-body text-base leading-relaxed text-ink-muted">
          DurgaPandal.com is a free, community-sourced map of Durga Puja (Durga Pooja) and Navratri pandals. See every
          pandal near you, with its theme, photos, timings and directions, and plan your pandal hopping and Durga
          Darshan without installing an app.
        </p>

        <h2 className="font-display text-xl font-bold">Choose your city</h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {activeCities.map((city) => (
            <li key={city.slug}>
              <Link
                href={`/${city.slug}`}
                className="flex flex-col gap-1 rounded-2xl border border-border bg-panel p-4 hover:bg-card"
              >
                <span className="font-display text-lg font-bold">Durga Puja in {city.name}</span>
                <span className="font-body text-sm text-ink-muted">
                  {city.name} pandal map &amp; list {city.activeFestivalYear}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <Link href="/about" className="font-body text-sm font-bold text-brand">
          About DurgaPandal.com →
        </Link>
      </div>
    </main>
  );
}
