"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { fetchCities, type CityApiModel } from "@/lib/api";
import { useCitySearch } from "@/lib/use-city-search";

export interface CitySelectorSheetProps {
  currentCitySlug: string;
  selectedYear: number;
  availableYears: number[];
  onClose: () => void;
}

// Matches the design's combined city+year sheet (spec §4): MAJOR-tier cities
// are pinned/pre-listed by default. Typing switches from that fixed list to
// a live server-backed search (useCitySearch) spanning every DB city plus
// any city in India via OpenStreetMap — not just admin-curated ones. Coming-
// soon cities show a "Soon" badge instead of pretending they have listings.
export function CitySelectorSheet({ currentCitySlug, selectedYear, availableYears, onClose }: CitySelectorSheetProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [cities, setCities] = useState<CityApiModel[]>([]);
  const [loading, setLoading] = useState(true);
  const { query, setQuery, results, loading: searching, resolving, selectAndGo } = useCitySearch();

  useEffect(() => {
    fetchCities()
      .then(setCities)
      .finally(() => setLoading(false));
  }, []);

  function selectCity(city: CityApiModel) {
    if (city.status !== "ACTIVE") return;
    onClose();
    if (city.slug !== currentCitySlug) router.push(`/${city.slug}`);
  }

  async function selectSearchResult(result: (typeof results)[number]) {
    if (result.source === "db" && result.status !== "ACTIVE") return;
    onClose();
    await selectAndGo(result);
  }

  function selectYear(year: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(year));
    router.push(`${pathname}?${params}`);
    onClose();
  }

  interface DisplayCity {
    key: string;
    name: string;
    activeFestivalYear: number;
    isSelected: boolean;
    onSelect: () => void;
  }

  const isSearching = query.trim().length >= 2;
  // MINOR-tier cities only surface once the visitor is actively searching —
  // otherwise the default list would grow unbounded as more cities go live.
  const defaultVisible = cities.filter((c) => c.tier === "MAJOR");

  const active: DisplayCity[] = isSearching
    ? results
        .filter((r) => r.source === "db" && r.status === "ACTIVE")
        .map((c) => ({
          key: (c as Extract<typeof c, { source: "db" }>)._id,
          name: c.name,
          activeFestivalYear: (c as Extract<typeof c, { source: "db" }>).activeFestivalYear,
          isSelected: (c as Extract<typeof c, { source: "db" }>).slug === currentCitySlug,
          onSelect: () => selectSearchResult(c),
        }))
    : defaultVisible
        .filter((c) => c.status === "ACTIVE")
        .map((c) => ({
          key: c._id,
          name: c.name,
          activeFestivalYear: c.activeFestivalYear,
          isSelected: c.slug === currentCitySlug,
          onSelect: () => selectCity(c),
        }));

  const comingSoon: { key: string; name: string }[] = isSearching
    ? results
        .filter((r) => r.source === "db" && r.status === "COMING_SOON")
        .map((c) => ({ key: (c as Extract<typeof c, { source: "db" }>)._id, name: c.name }))
    : defaultVisible.filter((c) => c.status === "COMING_SOON").map((c) => ({ key: c._id, name: c.name }));

  const newPlaces = isSearching ? results.filter((r) => r.source === "nominatim") : [];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80dvh] flex-col gap-4 rounded-t-[28px] bg-panel p-5 pb-8 shadow-2xl md:inset-0 md:m-auto md:h-fit md:max-h-[600px] md:w-[420px] md:rounded-3xl">
        <div className="mx-auto h-1.5 w-10 flex-none rounded-full bg-white/20 md:hidden" />

        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-extrabold">Choose your city</h2>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-card">
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-xs uppercase tracking-wide text-ink-muted">Festival year</span>
          <div className="flex gap-2">
            {availableYears.map((year) => (
              <button
                key={year}
                onClick={() => selectYear(year)}
                className={`h-10 flex-1 rounded-xl font-body text-sm font-bold ${
                  year === selectedYear ? "bg-brand text-brand-ink" : "bg-card text-ink-dim"
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        <div className="flex h-12 items-center gap-2.5 rounded-2xl bg-ink px-3.5">
          <span className="material-symbols-rounded text-ground/50">search</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any city"
            className="flex-1 bg-transparent font-body text-[15.5px] text-ground outline-none placeholder:text-ground/50"
          />
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto">
          {(loading || (isSearching && searching)) && (
            <p className="py-6 text-center font-body text-sm text-ink-muted">
              {isSearching ? "Searching…" : "Loading…"}
            </p>
          )}

          {!loading && !(isSearching && searching) && active.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="font-mono text-xs uppercase tracking-wide text-ink-muted">Live now</span>
              {active.map((city) => (
                <button
                  key={city.key}
                  onClick={city.onSelect}
                  className={`flex items-center gap-3 rounded-2xl p-2.5 text-left ${city.isSelected ? "bg-card ring-2 ring-brand" : "hover:bg-card/60"}`}
                >
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-chip font-display text-lg font-extrabold text-brand">
                    {city.name.charAt(0)}
                  </span>
                  <span className="flex flex-1 flex-col">
                    <span className="font-body text-[16px] font-bold">{city.name}</span>
                    <span className="font-body text-sm text-ink-muted">Festival year {city.activeFestivalYear}</span>
                  </span>
                  {city.isSelected && (
                    <span className="material-symbols-rounded text-2xl text-brand" style={{ fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {!loading && !(isSearching && searching) && comingSoon.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="font-mono text-xs uppercase tracking-wide text-ink-muted">Coming soon</span>
              {comingSoon.map((city) => (
                <div key={city.key} className="flex h-13 items-center justify-between px-1 font-body text-[15.5px] font-semibold text-ink-muted">
                  {city.name}
                  <span className="rounded-lg bg-card px-2.5 py-1 font-body text-xs font-semibold text-ink-muted">Soon</span>
                </div>
              ))}
            </div>
          )}

          {isSearching && !searching && newPlaces.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="font-mono text-xs uppercase tracking-wide text-ink-muted">Other places in India</span>
              {newPlaces.map((city, index) => (
                <button
                  key={`${city.name}-${index}`}
                  onClick={() => selectSearchResult(city)}
                  disabled={resolving}
                  className="flex items-center gap-3 rounded-2xl p-2.5 text-left hover:bg-card/60 disabled:opacity-60"
                >
                  <span className="material-symbols-rounded flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-chip text-xl text-ink-muted">
                    {resolving ? "sync" : "location_on"}
                  </span>
                  <span className="flex flex-1 flex-col">
                    <span className="font-body text-[16px] font-bold">{city.name}</span>
                    <span className="font-body text-sm text-ink-muted">{city.state} · no pandals added yet</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {isSearching && !searching && active.length === 0 && comingSoon.length === 0 && newPlaces.length === 0 && (
            <p className="py-6 text-center font-body text-sm text-ink-muted">
              No matching places in India — try a different spelling.
            </p>
          )}
        </div>

        <Link
          href="/about"
          onClick={onClose}
          className="flex items-center justify-center gap-1 border-t border-border pt-4 font-body text-sm font-semibold text-ink-muted"
        >
          About DurgaPandals.com
        </Link>
      </div>
    </>
  );
}
