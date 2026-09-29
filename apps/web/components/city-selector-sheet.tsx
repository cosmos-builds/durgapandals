"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { useCitySearch } from "@/lib/use-city-search";
import { useCityList } from "@/lib/use-city-list";
import { useKeyboardListNav } from "@/lib/use-keyboard-list-nav";

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
  const { cities, loading, error: citiesError, retry: retryCities } = useCityList();
  const { query, setQuery, results, loading: searching, resolving, selectAndGo } = useCitySearch();

  function selectCity(city: (typeof cities)[number]) {
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
          isSelected: (c as Extract<typeof c, { source: "db" }>).slug === currentCitySlug,
          onSelect: () => selectSearchResult(c),
        }))
    : defaultVisible
        .filter((c) => c.status === "ACTIVE")
        .map((c) => ({
          key: c._id,
          name: c.name,
          isSelected: c.slug === currentCitySlug,
          onSelect: () => selectCity(c),
        }));

  const comingSoon: { key: string; name: string }[] = isSearching
    ? results
        .filter((r) => r.source === "db" && r.status === "COMING_SOON")
        .map((c) => ({ key: (c as Extract<typeof c, { source: "db" }>)._id, name: c.name }))
    : defaultVisible.filter((c) => c.status === "COMING_SOON").map((c) => ({ key: c._id, name: c.name }));

  const newPlaces = isSearching ? results.filter((r) => r.source === "nominatim") : [];

  // Keyboard nav spans both selectable groups in on-screen order (Live now,
  // then Other places — Coming soon is display-only and never selectable),
  // so arrow keys/Enter work the same as clicking either group.
  const keyboardItems = [...active, ...newPlaces.map((city) => ({ onSelect: () => selectSearchResult(city) }))];
  const { highlightedIndex, onKeyDown } = useKeyboardListNav(keyboardItems, (item) => item.onSelect());
  const highlightedNewPlaceIndex = highlightedIndex - active.length;

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80dvh] flex-col gap-4 rounded-t-[28px] bg-panel p-5 pb-8 shadow-2xl md:inset-0 md:m-auto md:h-fit md:max-h-[600px] md:w-[420px] md:rounded-3xl"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
      >
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
            onKeyDown={onKeyDown}
            placeholder="Search any city"
            className="flex-1 bg-transparent font-body text-[15.5px] text-ground outline-none placeholder:text-ground/50"
          />
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto">
          {citiesError && !isSearching && (
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-card/60 px-3.5 py-3">
              <span className="font-body text-sm text-ink-muted">Couldn&apos;t load cities.</span>
              <button onClick={retryCities} className="font-body text-sm font-bold text-brand">
                Retry
              </button>
            </div>
          )}

          {(loading || (isSearching && searching)) && (
            <p className="py-6 text-center font-body text-sm text-ink-muted">
              {isSearching ? "Searching…" : "Loading…"}
            </p>
          )}

          {!loading && !isSearching && active.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="font-mono text-xs uppercase tracking-wide text-ink-muted">Live now</span>
              <div className="flex flex-wrap gap-2">
                {active.map((city) => (
                  <button
                    key={city.key}
                    onClick={city.onSelect}
                    className={`flex items-center gap-1.5 rounded-pill border px-3.5 py-2 font-body text-sm font-bold ${
                      city.isSelected ? "border-brand bg-brand/15 text-brand" : "border-border bg-chip text-ink-dim"
                    }`}
                  >
                    {city.name}
                    {city.isSelected && (
                      <span className="material-symbols-rounded text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                        check_circle
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!loading && !isSearching && comingSoon.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="font-mono text-xs uppercase tracking-wide text-ink-muted">Coming soon</span>
              <div className="flex flex-wrap gap-2">
                {comingSoon.map((city) => (
                  <span
                    key={city.key}
                    className="flex items-center gap-1.5 rounded-pill border border-border bg-chip px-3.5 py-2 font-body text-sm font-semibold text-ink-muted"
                  >
                    {city.name}
                    <span className="flex-none rounded-lg bg-card px-2 py-0.5 font-body text-[11px] font-semibold">Soon</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {isSearching && !searching && active.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="font-mono text-xs uppercase tracking-wide text-ink-muted">Live now</span>
              {active.map((city, index) => (
                <button
                  key={city.key}
                  onClick={city.onSelect}
                  className={`flex items-center gap-3 rounded-2xl p-2.5 text-left ${
                    city.isSelected || index === highlightedIndex ? "bg-card ring-2 ring-brand" : "hover:bg-card/60"
                  }`}
                >
                  <span className="material-symbols-rounded flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-chip text-xl text-brand">
                    location_on
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-body text-[16px] font-bold">{city.name}</span>
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

          {isSearching && !searching && comingSoon.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="font-mono text-xs uppercase tracking-wide text-ink-muted">Coming soon</span>
              {comingSoon.map((city) => (
                <div key={city.key} className="flex h-13 items-center gap-2 px-1 font-body text-[15.5px] font-semibold text-ink-muted">
                  <span className="min-w-0 flex-1 truncate">{city.name}</span>
                  <span className="flex-none rounded-lg bg-card px-2.5 py-1 font-body text-xs font-semibold text-ink-muted">Soon</span>
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
                  className={`flex items-center gap-3 rounded-2xl p-2.5 text-left disabled:opacity-60 ${
                    index === highlightedNewPlaceIndex ? "bg-card/60" : "hover:bg-card/60"
                  }`}
                >
                  <span className="material-symbols-rounded flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-chip text-xl text-ink-muted">
                    {resolving ? "sync" : "location_on"}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-body text-[16px] font-bold">{city.name}</span>
                    <span className="truncate font-body text-sm text-ink-muted">{city.state} · no pandals added yet</span>
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
          About DurgaPandal.com
        </Link>
      </motion.div>
    </>
  );
}
