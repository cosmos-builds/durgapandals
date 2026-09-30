"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { CitySelectorSheet } from "./city-selector-sheet";

export interface CityYearPillProps {
  citySlug: string;
  cityName: string;
  activeFestivalYear: number;
  availableYears: number[];
  className: string;
  /** "pill" (default): the "📍 Kolkata · 2026 ▾" text control — used by the
   *  desktop persistent nav bar, where there's room for it. "icon": a bare
   *  icon-only trigger with no city/year text at all — used by the mobile
   *  map screen, where that text now lives instead as a subtitle under the
   *  header's wordmark (see mobile-header.tsx) rather than competing with
   *  the search box for width in the same row. Both open the identical
   *  sheet either way. */
  variant?: "pill" | "icon";
}

// Shared by every screen that lets a visitor change city/festival year, so
// they all open the exact same sheet instead of divergent copies of this
// state.
export function CityYearPill({ citySlug, cityName, activeFestivalYear, availableYears, className, variant = "pill" }: CityYearPillProps) {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const selectedYear = Number(searchParams.get("year")) || activeFestivalYear;

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={`Change city or year — currently ${cityName}, ${selectedYear}`} className={className}>
        {variant === "icon" ? (
          <span className="material-symbols-rounded">tune</span>
        ) : (
          <>
            <span className="material-symbols-rounded flex-none text-accent" style={{ fontVariationSettings: "'FILL' 1" }}>
              location_on
            </span>
            {/* `min-w-0` is what actually lets `truncate` clip instead of
                overflow — a flex item's default min-width:auto otherwise
                wins over `truncate`'s overflow:hidden, no matter how narrow
                the button itself is capped (see callers' `max-w-*`). */}
            <span className="min-w-0 truncate">
              {cityName} · {selectedYear}
            </span>
            <span className="material-symbols-rounded flex-none text-ink-muted">expand_more</span>
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <CitySelectorSheet
            currentCitySlug={citySlug}
            selectedYear={selectedYear}
            availableYears={availableYears}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
