"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PandalSummary } from "@/lib/api";
import { FestiveBunting } from "./festive-bunting";

export interface ExploreBrowserProps {
  citySlug: string;
  cityName: string;
  pandals: PandalSummary[];
}

type SortKey = "featured" | "likes" | "name" | "newest";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "featured", label: "Featured first" },
  { key: "likes", label: "Most liked" },
  { key: "name", label: "Name (A–Z)" },
  { key: "newest", label: "Recently added" },
];

export function ExploreBrowser({ citySlug, cityName, pandals }: ExploreBrowserProps) {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("all");
  const [sort, setSort] = useState<SortKey>("featured");
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());

  const areas = useMemo(() => {
    const set = new Set(pandals.map((p) => p.locality).filter(Boolean));
    return Array.from(set).sort();
  }, [pandals]);

  // Categories were already fetched (PandalYear.categories) but had no
  // filter UI anywhere — read-only tag pills only, never clickable.
  const categories = useMemo(() => {
    const set = new Set(pandals.flatMap((p) => p.year?.categories ?? []));
    return Array.from(set).sort();
  }, [pandals]);

  function toggleCategory(category: string) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = pandals.filter((p) => {
      const matchesQuery =
        !q ||
        p.canonicalName.toLowerCase().includes(q) ||
        p.locality.toLowerCase().includes(q) ||
        (p.organizerName?.toLowerCase().includes(q) ?? false) ||
        (p.year?.theme?.toLowerCase().includes(q) ?? false) ||
        (p.year?.tags.some((t) => t.toLowerCase().includes(q)) ?? false);
      const matchesArea = area === "all" || p.locality === area;
      const matchesCategory =
        activeCategories.size === 0 || (p.year?.categories.some((c) => activeCategories.has(c)) ?? false);
      return matchesQuery && matchesArea && matchesCategory;
    });

    list = [...list].sort((a, b) => {
      switch (sort) {
        case "likes":
          return b.likes - a.likes;
        case "name":
          return a.canonicalName.localeCompare(b.canonicalName);
        case "newest":
          return b.id.localeCompare(a.id);
        case "featured":
        default:
          return Number(b.year?.featured ?? false) - Number(a.year?.featured ?? false) || b.likes - a.likes;
      }
    });

    return list;
  }, [pandals, query, area, sort, activeCategories]);

  const featured = pandals.filter((p) => p.year?.featured);
  const isFiltering = query.trim() !== "" || area !== "all" || activeCategories.size > 0;

  return (
    <div className="relative min-h-dvh overflow-hidden bg-ground pb-[100px] pt-[76px] md:pb-16">
      {/* Warm diya glow behind the whole top of the page instead of flat dark
          — the single biggest "festival, not app" signal on this screen. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-70"
        style={{
          background:
            "radial-gradient(60% 50% at 50% -10%, rgba(255,181,71,.16), transparent 70%), radial-gradient(40% 40% at 85% 5%, rgba(255,68,51,.14), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl md:px-8">
        <div className="px-4 md:px-0">
          <h1 className="font-display text-[34px] font-extrabold tracking-tight md:text-[42px]">
            Explore <span className="text-brand">{cityName}</span>
          </h1>
          <p className="mt-1 font-body text-sm text-ink-muted">
            {pandals.length} pandals this festival season
          </p>
        </div>

        {/* Search + filter + sort bar */}
        <div className="mt-5 flex flex-col gap-2.5 px-4 md:flex-row md:px-0">
          <div className="flex h-13 flex-1 items-center gap-2.5 rounded-2xl border border-border bg-panel px-4">
            <span className="material-symbols-rounded text-ink-muted">search</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, area, committee, theme…"
              className="flex-1 bg-transparent font-body text-[15px] outline-none placeholder:text-ink-muted"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-ink-muted">
                <span className="material-symbols-rounded text-lg">close</span>
              </button>
            )}
          </div>

          <div className="flex gap-2.5">
            <div className="relative flex-1 md:flex-none">
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="h-13 w-full appearance-none rounded-2xl border border-border bg-panel pl-4 pr-9 font-body text-sm font-semibold md:w-[180px]"
              >
                <option value="all">All areas</option>
                {areas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <span className="material-symbols-rounded pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted">
                expand_more
              </span>
            </div>

            <div className="relative flex-1 md:flex-none">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-13 w-full appearance-none rounded-2xl border border-border bg-panel pl-4 pr-9 font-body text-sm font-semibold md:w-[190px]"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span className="material-symbols-rounded pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted">
                swap_vert
              </span>
            </div>
          </div>
        </div>

        {/* Category filter chips — categories were already fetched and shown
            as read-only pills per-card, but never usable as a filter. */}
        {categories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 px-4 md:px-0">
            {categories.map((category) => {
              const isActive = activeCategories.has(category);
              return (
                <button
                  key={category}
                  onClick={() => toggleCategory(category)}
                  className={`rounded-pill border px-3 py-1.5 font-body text-sm font-semibold transition-colors ${
                    isActive
                      ? "border-brand bg-brand text-brand-ink"
                      : "border-border bg-panel text-ink-dim hover:border-accent/40"
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>
        )}

        {/* Featured — festive treatment, only shown when not actively filtering */}
        {!isFiltering && featured.length > 0 && (
          <div className="mt-9">
            <FestiveBunting className="h-6 w-full px-4 md:px-0" flagCount={13} />
            <div className="mt-1 flex items-baseline justify-between px-4 md:px-0">
              <h2 className="font-display text-2xl font-extrabold">
                <span className="material-symbols-rounded mr-1.5 align-[-3px] text-accent" style={{ fontVariationSettings: "'FILL' 1" }}>
                  local_fire_department
                </span>
                Featured this year
              </h2>
            </div>
            <div className="mt-4 flex gap-4 overflow-x-auto px-4 pb-2 md:px-0">
              {featured.map((pandal) => (
                <Link
                  key={pandal.id}
                  href={`/${citySlug}/pandal/${pandal.slug}`}
                  className="group relative h-[320px] w-[264px] flex-none overflow-hidden rounded-[28px] border border-accent/25 shadow-[0_20px_50px_-15px_rgba(255,181,71,.25)]"
                >
                  {pandal.year?.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pandal.year.coverImage}
                      alt={pandal.canonicalName}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-panel" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-ground via-ground/20 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-transparent" />

                  {/* Ribbon badge instead of a flat pill */}
                  <div className="absolute left-4 top-4 flex items-center gap-1 rounded-r-md rounded-bl-md bg-accent px-2.5 py-1 font-body text-[11px] font-bold uppercase tracking-wide text-accent-ink shadow-lg before:absolute before:-left-[7px] before:top-0 before:border-y-[10px] before:border-r-[7px] before:border-y-transparent before:border-r-accent before:content-['']">
                    <span className="material-symbols-rounded festive-shimmer text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>
                      star
                    </span>
                    Featured
                  </div>

                  <div className="absolute inset-x-4 bottom-4 flex flex-col gap-1">
                    <span className="font-display text-xl font-bold leading-tight">{pandal.canonicalName}</span>
                    {pandal.organizerName && (
                      <span className="truncate font-body text-xs text-ink-dim">{pandal.organizerName}</span>
                    )}
                    <span className="flex items-center justify-between font-body text-sm text-ink-dim">
                      <span>{pandal.locality}</span>
                      <span className="flex items-center gap-1 font-bold text-accent">
                        <span className="material-symbols-rounded text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                          thumb_up
                        </span>
                        {pandal.likes}
                      </span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
            <FestiveBunting className="mt-2 h-6 w-full scale-y-[-1] px-4 md:px-0" flagCount={13} />
          </div>
        )}

        <div className="mt-8 flex items-baseline justify-between px-4 md:px-0">
          <h2 className="font-display text-xl font-extrabold">
            {isFiltering ? `${filtered.length} result${filtered.length === 1 ? "" : "s"}` : `All pandals · ${pandals.length}`}
          </h2>
        </div>
        <div className="mt-3 flex flex-col px-4 md:grid md:grid-cols-2 md:gap-3 md:px-0 lg:grid-cols-3">
          {filtered.map((pandal) => (
            <Link
              key={pandal.id}
              href={`/${citySlug}/pandal/${pandal.slug}`}
              className="flex items-center gap-3 border-b border-border py-3 md:rounded-2xl md:border md:border-border md:bg-panel md:p-3 md:hover:border-accent/40"
            >
              <div className="relative h-[68px] w-[68px] flex-none overflow-hidden rounded-2xl bg-card">
                {pandal.year?.coverImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pandal.year.coverImage} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  {pandal.year?.featured && (
                    <span
                      className="material-symbols-rounded festive-shimmer flex-none text-sm text-accent"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      star
                    </span>
                  )}
                  <span className="truncate font-body text-[16.5px] font-bold">{pandal.canonicalName}</span>
                  {pandal.verificationStatus === "VERIFIED" && (
                    <span className="material-symbols-rounded flex-none text-sm text-accent" style={{ fontVariationSettings: "'FILL' 1" }}>
                      verified
                    </span>
                  )}
                </div>
                <span className="truncate font-body text-sm text-ink-muted">
                  {pandal.locality}
                  {pandal.organizerName ? ` · ${pandal.organizerName}` : ""}
                </span>
                {pandal.year?.theme && (
                  <span className="truncate font-body text-xs text-ink-dim">{pandal.year.theme}</span>
                )}
                {pandal.year && pandal.year.tags.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {pandal.year.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-pill bg-chip px-2 py-0.5 font-body text-[11px] font-medium text-ink-dim">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <span className="mt-0.5 flex items-center gap-1 font-body text-sm font-semibold text-accent">
                  <span className="material-symbols-rounded text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                    thumb_up
                  </span>
                  {pandal.likes}
                </span>
              </div>
            </Link>
          ))}
          {filtered.length === 0 && (
            <p className="py-8 text-center font-body text-ink-muted md:col-span-full">
              {isFiltering ? "No pandals match your search." : `No pandals published yet in ${cityName}.`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
