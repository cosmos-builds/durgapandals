"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PandalSummary } from "@/lib/api";
import { getSavedPandalSlugs, toggleSavedPandal } from "@/lib/visitor";
import { DirectionsButton } from "./directions-button";

export interface SavedListProps {
  citySlug: string;
  cityName: string;
  allPandals: PandalSummary[];
}

// Saved is purely local — no account, no sync (spec §12). This filters the
// city's pandal list down to whatever slugs are in this browser's
// localStorage, so "Saved" only ever reflects this device.
export function SavedList({ citySlug, cityName, allPandals }: SavedListProps) {
  const [savedSlugs, setSavedSlugs] = useState<string[]>([]);

  useEffect(() => {
    setSavedSlugs(getSavedPandalSlugs());
  }, []);

  const saved = allPandals.filter((p) => savedSlugs.includes(p.slug));

  function unsave(slug: string) {
    toggleSavedPandal(slug);
    setSavedSlugs(getSavedPandalSlugs());
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-ground pb-[100px] md:pb-16">
      {/* Same warm diya glow as Explore instead of flat dark — otherwise
          Saved was the one screen with zero festive treatment. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-70"
        style={{
          background:
            "radial-gradient(60% 50% at 50% -10%, rgba(255,181,71,.16), transparent 70%), radial-gradient(40% 40% at 85% 5%, rgba(255,68,51,.14), transparent 70%)",
        }}
      />

      {/* Mobile-only minimal header — logo present on every screen (spec §5);
          desktop uses the persistent TopHeader instead. */}
      <div className="relative flex items-center gap-2 px-4 pt-4 md:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo.png" alt="" className="h-6 w-6 object-contain" />
        <span className="font-display text-[15px] font-extrabold">Saved</span>
      </div>

      {/* Constrained + centered on desktop instead of stretching edge to edge */}
      <div className="relative mx-auto max-w-5xl px-4 pt-4 md:px-8 md:pt-6">
        <h1 className="hidden font-display text-[34px] font-extrabold tracking-tight md:block md:text-[40px]">Saved</h1>
        <p className="mt-1 flex items-center gap-1.5 font-body text-sm text-ink-muted">
          <span className="material-symbols-rounded text-[17px]">smartphone</span>
          Kept on this device · {saved.length} in {cityName}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {saved.map((pandal) => (
            <div key={pandal.id} className="overflow-hidden rounded-3xl border border-border bg-panel">
              <div className="relative h-[150px] md:h-[140px]">
                {pandal.year?.coverImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pandal.year.coverImage} alt="" className="h-full w-full object-cover" />
                )}
                <button
                  onClick={() => unsave(pandal.slug)}
                  className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-ground/80"
                >
                  <span className="material-symbols-rounded text-brand text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                    bookmark
                  </span>
                </button>
              </div>
              <div className="flex items-center gap-2.5 p-3.5">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <Link href={`/${citySlug}/pandal/${pandal.slug}`} className="truncate font-display text-lg font-bold">
                    {pandal.canonicalName}
                  </Link>
                  <span className="truncate font-body text-sm text-ink-muted">{pandal.locality}</span>
                </div>
                <DirectionsButton pandal={pandal} variant="compact" />
              </div>
            </div>
          ))}
        </div>

        {saved.length === 0 && (
          <div className="mx-auto mt-6 flex max-w-md flex-col items-center gap-3 rounded-3xl border border-border bg-panel px-6 py-10 text-center">
            <span className="material-symbols-rounded text-4xl text-brand" style={{ transform: "rotate(-6deg)" }}>
              bookmark_add
            </span>
            <span className="font-display text-xl font-extrabold">Nothing saved yet</span>
            <span className="font-body text-sm text-ink-muted">
              Tap the bookmark on any pandal to keep it here. Saved on this phone only.
            </span>
            <Link href={`/${citySlug}`} className="mt-2 rounded-2xl bg-brand px-5 py-3 font-body text-sm font-bold text-brand-ink">
              Browse the map
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
