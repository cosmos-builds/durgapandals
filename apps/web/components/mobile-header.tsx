import Link from "next/link";
import type { ReactNode } from "react";

export interface MobileHeaderProps {
  citySlug: string;
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
// add-pandal-flow.tsx) so branding never disappears, even though the rest
// of each header's contents (city/year pill, search, page title, icons)
// differs screen to screen.
export function MobileHeader({ citySlug, right, variant = "solid", className = "" }: MobileHeaderProps) {
  return (
    <div className={`flex items-center justify-between gap-2 ${className}`}>
      <Link href={`/${citySlug}`} className="flex items-center gap-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo.png" alt="" className="h-6 w-6 flex-none object-contain" />
        <span
          className={`font-display text-sm font-extrabold tracking-tight ${
            variant === "overlay" ? "rounded-pill bg-ground/70 px-2.5 py-1" : ""
          }`}
        >
          durga<span className="text-brand">pandals</span>
        </span>
      </Link>
      {right}
    </div>
  );
}
