"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, Reorder } from "motion/react";
import { externalTrailDirectionsUrl, MAX_TRAIL_STOPS } from "@durgapandals/maps";
import { fetchPandalsForCity, pandalDetailHref, type PandalSummary } from "@/lib/api";
import { clearTrail, getTrail, reorderTrail, removeFromTrail, TRAIL_CHANGED_EVENT } from "@/lib/trail";
import { PandalPhotoPlaceholder } from "./pandal-photo-placeholder";

export interface TrailSheetProps {
  citySlug: string;
  open: boolean;
  onClose: () => void;
}

// The trail-planner panel — select pandals anywhere in the app (see
// TrailButton), then reorder/trim/export them here. Fetches the city's full
// pandal list on open rather than requiring every call site to thread it in
// (trail state only ever stores slugs, same as Saved), so this stays a
// self-contained global feature instead of plumbing pandal data through
// every page that might open it.
export function TrailSheet({ citySlug, open, onClose }: TrailSheetProps) {
  const [allPandals, setAllPandals] = useState<PandalSummary[] | null>(null);
  const [orderedSlugs, setOrderedSlugs] = useState<string[]>([]);

  useEffect(() => {
    function sync() {
      setOrderedSlugs(getTrail(citySlug));
    }
    sync();
    window.addEventListener(TRAIL_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(TRAIL_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [citySlug]);

  useEffect(() => {
    if (!open || allPandals) return;
    fetchPandalsForCity(citySlug).then(setAllPandals);
  }, [open, citySlug, allPandals]);

  const bySlug = new Map((allPandals ?? []).map((p) => [p.slug, p]));
  const stops = orderedSlugs.map((slug) => bySlug.get(slug)).filter((p): p is PandalSummary => Boolean(p));

  function handleReorder(next: PandalSummary[]) {
    const nextSlugs = next.map((p) => p.slug);
    setOrderedSlugs(nextSlugs);
    reorderTrail(citySlug, nextSlugs);
  }

  function shareOnWhatsApp() {
    const names = stops.map((s) => s.canonicalName).join(", ");
    const url = externalTrailDirectionsUrl(stops);
    const text = `My pandal hopping trail in ${citySlug}: ${names}\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Your pandal trail"
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col gap-4 rounded-t-[28px] bg-panel p-5 pb-8 shadow-2xl md:inset-0 md:m-auto md:h-fit md:max-h-[640px] md:w-[440px] md:rounded-3xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
          >
            <div className="mx-auto h-1.5 w-10 flex-none rounded-full bg-white/20 md:hidden" />

            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-extrabold">Your trail</h2>
                <p className="font-body text-xs text-ink-muted">
                  {stops.length} of {MAX_TRAIL_STOPS} stops · drag to reorder
                </p>
              </div>
              <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-card">
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            {stops.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-3xl border border-border bg-card/40 px-6 py-10 text-center">
                <span className="material-symbols-rounded text-4xl text-accent" style={{ transform: "rotate(-6deg)" }}>
                  route
                </span>
                <span className="font-display text-lg font-extrabold">No stops yet</span>
                <span className="font-body text-sm text-ink-muted">
                  Tap the route icon on any pandal to add it to your trail.
                </span>
              </div>
            ) : (
              <Reorder.Group
                axis="y"
                values={stops}
                onReorder={handleReorder}
                className="flex flex-col gap-2 overflow-y-auto"
              >
                {stops.map((pandal, index) => (
                  <Reorder.Item
                    key={pandal.id}
                    value={pandal}
                    className="flex items-center gap-3 rounded-2xl bg-card p-2.5"
                  >
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-accent font-body text-xs font-extrabold text-accent-ink">
                      {index + 1}
                    </span>
                    <div className="h-12 w-12 flex-none overflow-hidden rounded-xl bg-panel">
                      {pandal.year?.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={pandal.year.coverImage} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <PandalPhotoPlaceholder className="h-full w-full" />
                      )}
                    </div>
                    <Link
                      href={pandalDetailHref(citySlug, pandal)}
                      onClick={onClose}
                      className="min-w-0 flex-1 truncate font-body text-sm font-bold"
                    >
                      {pandal.canonicalName}
                    </Link>
                    <button
                      onClick={() => removeFromTrail(citySlug, pandal.slug)}
                      aria-label={`Remove ${pandal.canonicalName} from trail`}
                      className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-ink-muted"
                    >
                      <span className="material-symbols-rounded text-lg">close</span>
                    </button>
                    <span className="material-symbols-rounded flex-none cursor-grab text-ink-muted active:cursor-grabbing">
                      drag_indicator
                    </span>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            )}

            {stops.length > 0 && (
              <div className="flex flex-col gap-2">
                <a
                  href={externalTrailDirectionsUrl(stops)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-brand font-body text-sm font-bold text-brand-ink"
                >
                  <span className="material-symbols-rounded text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                    directions
                  </span>
                  Open in Google Maps
                </a>
                <div className="flex gap-2">
                  <button
                    onClick={shareOnWhatsApp}
                    className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-card font-body text-sm font-bold"
                  >
                    <span className="material-symbols-rounded text-base">share</span>
                    Share
                  </button>
                  <button
                    onClick={() => clearTrail(citySlug)}
                    className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-card font-body text-sm font-bold text-ink-muted"
                  >
                    <span className="material-symbols-rounded text-base">delete</span>
                    Clear trail
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
