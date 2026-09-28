"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { CityApiModel } from "@/lib/api";
import { useCitySearch } from "@/lib/use-city-search";
import { useCityList } from "@/lib/use-city-list";
import { useKeyboardListNav } from "@/lib/use-keyboard-list-nav";
import { markIntroSeen } from "@/lib/visitor";

export interface IntroHeroProps {
  citySlug: string;
  onExplore: () => void;
}

// Matches the redesign's onboarding screen exactly: hero photo (mobile: full
// width above the fold, faded into the page background; desktop: full-height
// left half with a left-to-right fade) with logo/headline/search/city-chips/
// CTA below (mobile) or beside it (desktop). City chips and search are wired
// to the real city list (majors first) instead of the mockup's hardcoded
// placeholder names — picking a different city navigates there, picking the
// current one dismisses the overlay same as the "skip" CTA. The skip CTA is
// deliberately secondary-styled: the underlying map may be showing an
// arbitrary default city nobody picked, so search/chips should read as the
// obvious next step, not the exit.
export function IntroHero({ citySlug, onExplore }: IntroHeroProps) {
  const router = useRouter();
  const { cities, loading: loadingCities, error: citiesError, retry: retryCities } = useCityList();
  const { query, setQuery, results, loading: searching, resolving, selectAndGo } = useCitySearch();

  const activeCities = useMemo(() => cities.filter((c) => c.status === "ACTIVE"), [cities]);

  const chips = useMemo(() => {
    return [...activeCities]
      .sort((a, b) => (a.tier === b.tier ? 0 : a.tier === "MAJOR" ? -1 : 1))
      .slice(0, 6);
  }, [activeCities]);

  function selectCity(city: CityApiModel) {
    // Picking any city — including a different one — means onboarding is
    // done; without this, navigating away re-triggers the intro on the
    // destination city since its own "have I seen this" check would
    // otherwise still read false.
    markIntroSeen();
    if (city.slug === citySlug) {
      onExplore();
    } else {
      router.push(`/${city.slug}`);
    }
  }

  async function selectSearchResult(result: (typeof results)[number]) {
    if (result.source === "db" && result.status !== "ACTIVE") return;
    markIntroSeen();
    await selectAndGo(result);
  }

  const { highlightedIndex, onKeyDown } = useKeyboardListNav(results, selectSearchResult);

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-ground md:overflow-hidden">
      <div className="flex flex-1 flex-col md:flex-row">
        <div className="relative h-[260px] flex-none md:h-auto md:flex-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/hero-durga.png"
            alt=""
            className="h-full w-full object-cover object-[center_20%]"
          />
          <div
            className="pointer-events-none absolute inset-0 md:hidden"
            style={{ background: "linear-gradient(180deg, rgba(23,8,16,.1), #170810 92%)" }}
          />
          <div
            className="pointer-events-none absolute inset-0 hidden md:block"
            style={{ background: "linear-gradient(90deg, transparent, rgba(23,8,16,.4))" }}
          />
        </div>

        <div className="-mt-8 flex flex-col items-center gap-1 px-6 pb-8 text-center md:mt-0 md:flex-1 md:items-start md:justify-center md:px-16 md:text-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo.png"
            alt="durgaPandals"
            className="mb-2.5 h-[76px] w-[76px] object-contain md:h-20 md:w-20"
            style={{ filter: "drop-shadow(0 8px 20px rgba(255,68,51,.4))" }}
          />
          <h1 className="font-display text-[30px] font-extrabold leading-[1.1] md:text-[44px] md:leading-[1.05]">
            durgaPandals
          </h1>
          <p className="mb-5 font-body text-[13.5px] text-ink-muted md:max-w-[400px] md:text-base">
            Shubho Sharadiya! Find every pandal, theme &amp; aarti timing — in your city, wherever that is.
          </p>

          <div className="flex w-full flex-col gap-2.5 md:max-w-[420px] md:gap-3">
            <div className="relative">
              <div className="flex h-12 items-center gap-2.5 rounded-2xl bg-ink px-3.5 md:h-[52px] md:px-4">
                <span className="material-symbols-rounded text-ground/60">search</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Search your city — Kolkata, Delhi, Pune, anywhere…"
                  className="flex-1 bg-transparent font-body text-sm text-ground outline-none placeholder:text-ground/50 md:text-[15px]"
                  role="combobox"
                  aria-expanded={query.trim().length >= 2}
                  aria-controls="intro-city-search-results"
                />
              </div>
              {query.trim().length >= 2 && (
                <div
                  id="intro-city-search-results"
                  role="listbox"
                  className="absolute inset-x-0 top-[calc(100%+8px)] z-10 flex max-h-52 flex-col gap-0.5 overflow-y-auto rounded-2xl border border-border bg-panel p-1.5 text-left shadow-2xl"
                >
                  {searching ? (
                    <p className="px-3 py-3 font-body text-sm text-ink-muted">Searching…</p>
                  ) : results.length === 0 ? (
                    <p className="px-3 py-3 font-body text-sm text-ink-muted">
                      No matching places in India — try a different spelling.
                    </p>
                  ) : (
                    results.map((city, index) => (
                      <button
                        key={`${city.name}-${index}`}
                        role="option"
                        aria-selected={index === highlightedIndex}
                        onClick={() => selectSearchResult(city)}
                        disabled={resolving}
                        className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left font-body text-sm font-semibold disabled:opacity-60 ${
                          index === highlightedIndex ? "bg-card" : "hover:bg-card"
                        }`}
                      >
                        {city.name}
                        {city.source === "nominatim" && (
                          <span className="font-body text-xs font-normal text-ink-muted">new</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {citiesError ? (
              <div className="flex items-center justify-between gap-2 rounded-2xl bg-card/60 px-3.5 py-2.5 text-left">
                <span className="font-body text-xs text-ink-muted">Couldn&apos;t load cities.</span>
                <button onClick={retryCities} className="font-body text-xs font-bold text-brand">
                  Retry
                </button>
              </div>
            ) : loadingCities ? (
              <p className="px-1 font-body text-xs text-ink-muted">Loading cities…</p>
            ) : (
              <div className="flex flex-wrap justify-center gap-2 md:justify-start">
                {chips.map((city) => (
                  <button
                    key={city._id}
                    onClick={() => selectCity(city)}
                    className={`rounded-pill border px-3 py-1.5 font-body text-xs font-semibold md:text-sm ${
                      city.slug === citySlug ? "border-brand bg-brand/15 text-brand" : "border-border bg-chip text-ink-dim"
                    }`}
                  >
                    {city.name}
                  </button>
                ))}
              </div>
            )}

            {/* Secondary, not primary — the point of this screen is to get the
                visitor to their actual city via search/chips above; "skip"
                should read as an escape hatch, not the obvious next step,
                since the underlying map may be showing an arbitrary default
                city they never picked. */}
            <button
              onClick={onExplore}
              className="mt-1 flex h-11 items-center justify-center gap-1.5 rounded-2xl border border-border font-body text-sm font-semibold text-ink-dim md:h-12"
            >
              Skip for now — I&apos;ll pick a city later
              <span className="material-symbols-rounded text-lg">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
