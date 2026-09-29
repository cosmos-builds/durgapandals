"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { pandalDetailHref, type PandalSummary } from "@/lib/api";
import { getSavedPandalSlugs, pruneSavedSlugs, toggleSavedPandal, SAVED_KEY_BY_CITY } from "@/lib/visitor";
import { DirectionsButton } from "./directions-button";
import { MobileHeader } from "./mobile-header";
import { PandalPhotoPlaceholder } from "./pandal-photo-placeholder";

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
    setSavedSlugs(getSavedPandalSlugs(citySlug));

    // Picks up a save/unsave made in another tab on the same origin — the
    // `storage` event only fires in *other* tabs, not the one that made the
    // write, which is exactly what's wanted here (this tab already updates
    // its own state directly in `unsave`).
    function onStorage(event: StorageEvent) {
      if (event.key === SAVED_KEY_BY_CITY) setSavedSlugs(getSavedPandalSlugs(citySlug));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [citySlug]);

  const saved = allPandals.filter((p) => savedSlugs.includes(p.slug));

  // The list load above already throws instead of silently returning []
  // on a failed fetch (see fetchPandalsForCityOrThrow), so reaching this
  // point with a saved slug missing from `allPandals` means it's genuinely
  // gone (deleted/unpublished/merged) rather than a fetch hiccup — safe to
  // drop it from storage instead of leaving a dead bookmark around forever.
  useEffect(() => {
    pruneSavedSlugs(citySlug, allPandals.map((p) => p.slug));
  }, [citySlug, allPandals]);

  function unsave(slug: string) {
    toggleSavedPandal(citySlug, slug);
    setSavedSlugs(getSavedPandalSlugs(citySlug));
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

      {/* Mobile-only minimal header — logo + brand present on every screen
          (spec §5); desktop uses the persistent TopHeader instead. */}
      <div className="relative px-4 pt-4 md:hidden">
        <MobileHeader citySlug={citySlug} />
      </div>

      {/* Constrained + centered on desktop instead of stretching edge to edge */}
      <div className="relative mx-auto max-w-5xl px-4 pt-4 md:px-8 md:pt-6">
        <h1 className="font-display text-2xl font-extrabold tracking-tight md:text-[40px]">Saved</h1>
        <p className="mt-1 flex items-center gap-1.5 font-body text-sm text-ink-muted">
          <span className="material-symbols-rounded text-[17px]">smartphone</span>
          Kept on this device · {saved.length} in {cityName}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
          {saved.map((pandal) => (
            <motion.div
              key={pandal.id}
              layout
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.18 } }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              className="overflow-hidden rounded-3xl border border-border bg-panel"
            >
              <div className="relative h-[150px] md:h-[140px]">
                {pandal.year?.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pandal.year.coverImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <PandalPhotoPlaceholder className="h-full w-full" />
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
                  <Link href={pandalDetailHref(citySlug, pandal)} className="truncate font-display text-lg font-bold">
                    {pandal.canonicalName}
                  </Link>
                  <span className="truncate font-body text-sm text-ink-muted">{pandal.locality}</span>
                </div>
                <DirectionsButton pandal={pandal} variant="compact" />
              </div>
            </motion.div>
          ))}
          </AnimatePresence>
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
