"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CitySelectorSheet } from "./city-selector-sheet";

export interface TopHeaderProps {
  citySlug: string;
  cityName: string;
}

// Rendered once from the (tabs) layout so it stays fixed across navigations
// instead of unmounting/remounting on every route change. On desktop, a
// bottom tab bar is a mobile pattern — Saved and Add Pandal move into this
// header instead, and BottomNav (see below) hides entirely at that width.
export function TopHeader({ citySlug, cityName }: TopHeaderProps) {
  const pathname = usePathname();
  const savedHref = `/${citySlug}/saved`;
  const isSavedActive = pathname === savedHref;
  const [citySheetOpen, setCitySheetOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-ground px-4 pb-3 pt-3">
      {/* Solid background — this previously had none, so scrolled page
          content (e.g. Explore's list) showed straight through behind it. */}
      <Link href={`/${citySlug}`} className="font-display text-[19px] font-extrabold tracking-tight">
        durga<span className="text-brand">pandals</span>
      </Link>

      <div className="flex items-center gap-2">
        <Link
          href={savedHref}
          className={`hidden h-10 items-center gap-1.5 rounded-pill border border-border bg-card/90 px-3.5 font-body text-[14.5px] font-semibold backdrop-blur md:flex ${
            isSavedActive ? "text-brand" : ""
          }`}
        >
          <span
            className="material-symbols-rounded text-[18px]"
            style={isSavedActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            bookmark
          </span>
          Saved
        </Link>

        <Link
          href={`/${citySlug}/add`}
          className="hidden h-10 items-center gap-1.5 rounded-pill bg-brand px-3.5 font-body text-[14.5px] font-bold text-brand-ink md:flex"
        >
          <span className="material-symbols-rounded text-[18px]">add</span>
          Add Pandal
        </Link>

        <button
          onClick={() => setCitySheetOpen(true)}
          className="flex h-10 items-center gap-1 rounded-pill border border-border bg-card/90 px-3 font-body text-[15px] font-semibold backdrop-blur"
        >
          <span className="material-symbols-rounded text-[18px] text-brand" style={{ fontVariationSettings: "'FILL' 1" }}>
            location_on
          </span>
          {cityName}
          <span className="material-symbols-rounded text-ink-muted">expand_more</span>
        </button>
      </div>

      {citySheetOpen && (
        <CitySelectorSheet currentCitySlug={citySlug} onClose={() => setCitySheetOpen(false)} />
      )}
    </header>
  );
}
