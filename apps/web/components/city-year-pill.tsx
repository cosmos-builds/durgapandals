"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CitySelectorSheet } from "./city-selector-sheet";

export interface CityYearPillProps {
  citySlug: string;
  cityName: string;
  activeFestivalYear: number;
  availableYears: number[];
  className: string;
}

// The combined "📍 Kolkata · 2026 ▾" control (spec §4) — shared by the
// desktop persistent nav bar and the mobile map screen's floating header so
// both open the exact same city+year sheet instead of two divergent copies
// of this state.
export function CityYearPill({ citySlug, cityName, activeFestivalYear, availableYears, className }: CityYearPillProps) {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const selectedYear = Number(searchParams.get("year")) || activeFestivalYear;

  return (
    <>
      <button onClick={() => setOpen(true)} className={className}>
        <span className="material-symbols-rounded text-accent" style={{ fontVariationSettings: "'FILL' 1" }}>
          location_on
        </span>
        <span className="truncate">
          {cityName} · {selectedYear}
        </span>
        <span className="material-symbols-rounded text-ink-muted">expand_more</span>
      </button>

      {open && (
        <CitySelectorSheet
          currentCitySlug={citySlug}
          selectedYear={selectedYear}
          availableYears={availableYears}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
