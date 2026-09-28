"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CityYearPill } from "./city-year-pill";

export interface TopHeaderProps {
  citySlug: string;
  cityName: string;
  activeFestivalYear: number;
  availableYears: number[];
}

const NAV_LINKS = [
  { key: "home", label: "Home", suffix: "" },
  { key: "explore", label: "Explore", suffix: "/explore" },
  { key: "addpandal", label: "Add Pandal", suffix: "/add" },
  { key: "saved", label: "Saved", suffix: "/saved" },
] as const;

// Desktop-only persistent top nav bar (spec §5) — a bottom tab bar is a
// mobile pattern, so desktop gets this instead across every non-onboarding
// screen (Home/Explore/Detail/Add-pandal/Saved), rendered once from
// `[citySlug]/layout.tsx` so it survives client-side navigation instead of
// remounting. Mobile gets its own bespoke per-screen header (see MapHome's
// floating header, ExploreBrowser's inline header, and Detail/Add's
// contextual back-button headers) rather than this bar squeezed down.
export function TopHeader({ citySlug, cityName, activeFestivalYear, availableYears }: TopHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  // Stays in sync with Explore's own `?q=` (including its debounced
  // write-back as you type there) — without this, the header box looked
  // empty even while Explore was actively filtered by a search someone
  // typed directly into the page instead of into this box.
  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const q = query.trim();
    router.push(q ? `/${citySlug}/explore?q=${encodeURIComponent(q)}` : `/${citySlug}/explore`);
  }

  return (
    <header className="sticky top-0 z-30 hidden h-[60px] items-center gap-5 border-b border-border bg-ground px-6 md:flex">
      <Link href={`/${citySlug}`} className="flex flex-none items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo.png" alt="" className="h-[30px] w-[30px] object-contain" />
        <span className="font-display text-[15px] font-extrabold tracking-tight">
          durga<span className="text-brand">pandals</span>
        </span>
      </Link>

      <CityYearPill
        citySlug={citySlug}
        cityName={cityName}
        activeFestivalYear={activeFestivalYear}
        availableYears={availableYears}
        className="flex h-[38px] flex-none items-center gap-1.5 rounded-xl bg-chip px-3 font-body text-[13px] font-bold"
      />

      <form onSubmit={handleSearch} className="flex h-[38px] max-w-[360px] flex-1 items-center gap-2 rounded-xl bg-card px-3">
        <span className="material-symbols-rounded text-[17px] text-ink-muted">search</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search pandals, themes, localities"
          className="flex-1 bg-transparent font-body text-[13px] text-ink outline-none placeholder:text-ink-muted"
        />
      </form>

      <nav className="ml-2 flex flex-none items-center gap-[22px]">
        {NAV_LINKS.map((link) => {
          const href = `/${citySlug}${link.suffix}`;
          const isActive = link.suffix === "" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={link.key}
              href={href}
              className={`font-body text-[13px] font-bold ${isActive ? "text-brand" : "text-ink"}`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <span className="ml-auto flex h-8 w-8 flex-none items-center justify-center rounded-full bg-chip font-body text-xs font-extrabold">
        EN
      </span>
    </header>
  );
}
