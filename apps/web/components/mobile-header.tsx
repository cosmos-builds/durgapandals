import Link from "next/link";
import type { ReactNode } from "react";

export interface MobileHeaderProps {
  citySlug: string;
  /** Currently browsed city — shown as a small subtitle under the
   *  wordmark, everywhere this header renders. */
  cityName?: string;
  /** Currently browsed festival year, shown alongside `cityName` as
   *  "City · Year". Only rendered when `cityName` is also given. */
  year?: number;
  right?: ReactNode;
  /** For overlaying on a photo hero (the pandal detail page) — white text
   *  on a frosted dark badge instead of plain ink-on-transparent. */
  variant?: "solid" | "overlay";
  className?: string;
}

// The logo + "durgaPandals" wordmark, always shown together — desktop's
// persistent TopHeader already does this on every screen; this is the
// mobile equivalent, since mobile has its own bespoke per-screen header
// instead of one shared bar. Every mobile screen renders this (see
// map-home.tsx, explore-browser.tsx, saved-list.tsx, pandal-detail.tsx,
// add-pandal-flow.tsx, report-pandal-flow.tsx) so branding never
// disappears, even though the rest of each header's contents (city/year
// control, search, page title, icons) differs screen to screen.
//
// The city/year subtitle lives here (not just on the map screen) so it's
// visible no matter which tab you're on — previously only the map's search
// row showed it, via a text pill wide enough to fight the search box for
// space on narrow phones (see city-year-pill.tsx's `variant="icon"`, which
// replaces that pill with a small trigger button instead).
export function MobileHeader({ citySlug, cityName, year, right, variant = "solid", className = "" }: MobileHeaderProps) {
  const isOverlay = variant === "overlay";
  return (
    <div className={`flex items-center justify-between gap-2 ${className}`}>
      <Link href={`/${citySlug}`} className="flex items-center gap-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo.png" alt="" className="h-6 w-6 flex-none object-contain" />
        <span className={`flex flex-col leading-tight ${isOverlay ? "rounded-pill bg-ground/70 px-2.5 py-1" : ""}`}>
          <span className="font-display text-sm font-extrabold tracking-tight">
            durga<span className="text-brand">pandals</span>
          </span>
          {cityName && (
            <span className="font-body text-[10px] font-semibold text-ink-muted">
              {cityName}
              {year ? ` · ${year}` : ""}
            </span>
          )}
        </span>
      </Link>
      {right}
    </div>
  );
}
