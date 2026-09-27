"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchCities, type CityApiModel } from "@/lib/api";

export interface CitySelectorSheetProps {
  currentCitySlug: string;
  onClose: () => void;
}

// Matches the design's city-selector sheet (spec §5.3): active cities are
// switchable, coming-soon cities show a "Soon" badge instead of pretending
// they have listings (spec §5.3's explicit "don't pretend" rule).
export function CitySelectorSheet({ currentCitySlug, onClose }: CitySelectorSheetProps) {
  const router = useRouter();
  const [cities, setCities] = useState<CityApiModel[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

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

  const filtered = cities.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
  const active = filtered.filter((c) => c.status === "ACTIVE");
  const comingSoon = filtered.filter((c) => c.status === "COMING_SOON");

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

        <div className="flex h-12 items-center gap-2.5 rounded-2xl border border-border bg-ground px-3.5">
          <span className="material-symbols-rounded text-ink-muted">search</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a city"
            className="flex-1 bg-transparent font-body text-[15.5px] outline-none placeholder:text-ink-muted"
          />
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto">
          {loading && <p className="py-6 text-center font-body text-sm text-ink-muted">Loading…</p>}

          {!loading && active.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="font-mono text-xs uppercase tracking-wide text-ink-muted">Live now</span>
              {active.map((city) => {
                const isSelected = city.slug === currentCitySlug;
                return (
                  <button
                    key={city._id}
                    onClick={() => selectCity(city)}
                    className={`flex items-center gap-3 rounded-2xl p-2.5 text-left ${isSelected ? "bg-card ring-2 ring-brand" : "hover:bg-card/60"}`}
                  >
                    <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-chip font-display text-lg font-extrabold text-brand">
                      {city.name.charAt(0)}
                    </span>
                    <span className="flex flex-1 flex-col">
                      <span className="font-body text-[16px] font-bold">{city.name}</span>
                      <span className="font-body text-sm text-ink-muted">Festival year {city.activeFestivalYear}</span>
                    </span>
                    {isSelected && (
                      <span className="material-symbols-rounded text-2xl text-brand" style={{ fontVariationSettings: "'FILL' 1" }}>
                        check_circle
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {!loading && comingSoon.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="font-mono text-xs uppercase tracking-wide text-ink-muted">Coming soon</span>
              {comingSoon.map((city) => (
                <div key={city._id} className="flex h-13 items-center justify-between px-1 font-body text-[15.5px] font-semibold text-ink-muted">
                  {city.name}
                  <span className="rounded-lg bg-card px-2.5 py-1 font-body text-xs font-semibold text-ink-muted">Soon</span>
                </div>
              ))}
            </div>
          )}

          {!loading && active.length === 0 && comingSoon.length === 0 && (
            <p className="py-6 text-center font-body text-sm text-ink-muted">
              DurgaPandals.com isn't available in "{query}" yet.
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
