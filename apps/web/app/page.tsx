import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchCities } from "@/lib/api";
import { LAST_CITY_COOKIE } from "@/lib/visitor";

// Root always resolves to a real ACTIVE city's Map page (spec §4) — which
// city is data from the API, never hardcoded here (spec §31.1). A returning
// visitor resumes at whichever city they last actually looked at (tracked
// via LastCityTracker); only a genuinely first-ever "/" visit falls back to
// the algorithmic default — the API's own sort already puts a MAJOR-tier
// city first among ACTIVE ones, rather than whatever's alphabetically first
// overall.
export default async function RootPage() {
  const cities = await fetchCities();
  const lastCitySlug = (await cookies()).get(LAST_CITY_COOKIE)?.value;
  const lastCity = lastCitySlug ? cities.find((c) => c.slug === lastCitySlug && c.status === "ACTIVE") : undefined;
  const active = lastCity ?? cities.find((city) => city.status === "ACTIVE") ?? cities[0];

  if (!active) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ground p-8 text-center text-ink">
        <p className="font-body text-ink-muted">
          No cities are configured yet. Add one in the admin app to get started.
        </p>
      </main>
    );
  }

  redirect(`/${active.slug}`);
}
