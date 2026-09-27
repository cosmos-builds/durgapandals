"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Select } from "@durgapandals/ui";
import type { PandalSummary } from "@/lib/api";
import { FestiveBunting } from "./festive-bunting";
import { MobileHeader } from "./mobile-header";

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
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [area, setArea] = useState("all");
  const [sort, setSort] = useState<SortKey>("featured");
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  // The desktop TopHeader's search bar (spec §5) lands here via `?q=` — this
  // re-syncs whenever it changes (not just on mount), so searching again
  // from the header while already on Explore actually updates the field
  // instead of being silently ignored. The field is still freely editable
  // afterwards; this only reacts to the URL param itself changing.
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setQuery(q);
  }, [searchParams]);

  const areas = useMemo(() => {
    const set = new Set(pandals.map((p) => p.locality).filter(Boolean));
    return Array.from(set).sort();
  }, [pandals]);

  // Categories were already fetched (PandalYear.categories) but had no
  // filter UI anywhere — read-only tag pills only, never clickable. This is
  // the one real filter dimension the design's mobile chip row and desktop
  // "CATEGORY" sidebar both map onto (the mockup's "Trending/Low crowd/New"
  // chips have no backing data in our model, so aren't reproduced).
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
    <div className="relative min-h-dvh overflow-hidden bg-ground pb-[100px] md:pb-16">
      {/* Warm diya glow behind the whole top of the page instead of flat dark
          — the single biggest "festival, not app" signal on this screen. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-70"
        style={{
          background:
            "radial-gradient(60% 50% at 50% -10%, rgba(255,181,71,.16), transparent 70%), radial-gradient(40% 40% at 85% 5%, rgba(255,68,51,.14), transparent 70%)",
        }}
      />

      {/* Mobile-only compact header (spec: logo + title + sort) — desktop
          uses the persistent TopHeader instead, and gets its own title row
          further down alongside the category rail. A native <select> always
          renders its selected option's full text, so it can't be squeezed
          into an icon-sized box without clipping — this is a small custom
          menu instead, matching the mockup's icon-only trigger while
          staying fully readable. */}
      <div className="relative flex flex-col gap-1.5 px-4 pt-4 md:hidden">
        <MobileHeader
          citySlug={citySlug}
          right={
            <div className="relative">
              <button
                onClick={() => setSortMenuOpen((prev) => !prev)}
                aria-label="Sort"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-chip"
              >
                <span className="material-symbols-rounded text-lg">sort</span>
              </button>
              {sortMenuOpen && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-20 flex w-48 flex-col gap-0.5 rounded-2xl border border-border bg-panel p-1.5 shadow-2xl">
                  {SORT_OPTIONS.map((o) => (
                    <button
                      key={o.key}
                      onClick={() => {
                        setSort(o.key);
                        setSortMenuOpen(false);
                      }}
                      className={`rounded-xl px-3 py-2 text-left font-body text-sm font-semibold ${
                        sort === o.key ? "bg-card text-brand" : "hover:bg-card"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          }
        />
        <h2 className="font-display text-[18px] font-extrabold">
          Explore <span className="text-brand">{cityName}</span>
        </h2>
      </div>

      <div className="relative md:flex md:items-start md:gap-8 md:px-8 md:pt-6">
        {/* Desktop-only category rail (spec: 200px sidebar) */}
        {categories.length > 0 && (
          <aside className="hidden md:flex md:w-[200px] md:flex-none md:flex-col md:gap-2.5 md:border-r md:border-border md:pr-6">
            <span className="mb-1 font-mono text-xs font-extrabold uppercase tracking-wide text-accent">Category</span>
            {categories.map((category) => (
              <label key={category} className="flex items-center gap-2 font-body text-sm">
                <input
                  type="checkbox"
                  checked={activeCategories.has(category)}
                  onChange={() => toggleCategory(category)}
                  className="h-4 w-4 accent-brand"
                />
                {category}
              </label>
            ))}
          </aside>
          
        )}

        <div className="min-w-0 flex-1">
          <div className="hidden items-baseline justify-between px-4 md:flex md:px-0">
            <h1 className="font-display text-[34px] font-extrabold tracking-tight md:text-[42px]">
              Explore <span className="text-brand">{cityName}</span>
            </h1>
            <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-12 w-[190px] text-sm font-semibold">
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <p className="mt-1 px-4 font-body text-sm text-ink-muted md:px-0">
            {pandals.length} pandals this festival season
          </p>

          {/* Search + area filter */}
          <div className="mt-5 flex flex-col gap-2.5 px-4 md:flex-row md:px-0">
            <div className="flex h-13 flex-1 items-center gap-2.5 rounded-2xl bg-ink px-4">
              <span className="material-symbols-rounded text-ground/50">search</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, area, committee, theme…"
                className="flex-1 bg-transparent font-body text-[15px] text-ground outline-none placeholder:text-ground/50"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-ground/50">
                  <span className="material-symbols-rounded text-lg">close</span>
                </button>
              )}
            </div>

            <Select value={area} onChange={(e) => setArea(e.target.value)} className="h-12 text-sm font-semibold md:w-[180px]">
              <option value="all">All areas</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </div>

          {/* Category filter chips — mobile only (desktop uses the rail above) */}
          {categories.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 px-4 md:hidden">
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
                        <span className="flex items-center gap-1 font-bold text-brand">
                          <span className="material-symbols-rounded text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                            favorite
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
                  {pandal.year?.featured && (
                    <span className="absolute left-1 top-1 rounded-pill bg-accent px-1.5 py-0.5 font-body text-[9px] font-extrabold uppercase text-accent-ink">
                      Featured
                    </span>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
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
                  <span className="mt-0.5 flex items-center gap-1 font-body text-sm font-semibold text-brand">
                    <span className="material-symbols-rounded text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                      favorite
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
    </div>
  );
}
