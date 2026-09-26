import { redirect } from "next/navigation";
import { fetchCities } from "@/lib/api";

// Root always resolves to a real ACTIVE city's Map page (spec §4) — which
// city is data from the API, never hardcoded here (spec §31.1).
export default async function RootPage() {
  const cities = await fetchCities();
  const active = cities.find((city) => city.status === "ACTIVE") ?? cities[0];

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
