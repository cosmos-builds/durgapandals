"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, type PanInfo } from "motion/react";
import { fetchLikedStatus, pandalDetailHref, toggleReaction, type PandalSummary } from "@/lib/api";
import { getSavedPandalSlugs, getVisitorId, toggleSavedPandal } from "@/lib/visitor";
import { DirectionsButton } from "./directions-button";
import { PandalPhotoPlaceholder } from "./pandal-photo-placeholder";
import { TrailButton } from "./trail-button";

const DISMISS_THRESHOLD_PX = 110;
const DISMISS_VELOCITY = 500;

export interface PandalPreviewSheetProps {
  citySlug: string;
  pandal: PandalSummary;
  onClose: () => void;
}

// Mobile-only: marker tap opens this instead of a full navigation, draggable
// down to dismiss. Desktop uses the sidebar list + inline focus instead (see
// MapHome) — no floating card there. "View details" is the only action that
// leaves this component for the full pandal page.
export function PandalPreviewSheet({ citySlug, pandal, onClose }: PandalPreviewSheetProps) {
  const [likes, setLikes] = useState(pandal.likes);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLikes(pandal.likes);
    setSaved(getSavedPandalSlugs(citySlug).includes(pandal.slug));

    // See pandal-detail.tsx for why this can't just stay hardcoded to
    // false — a returning visitor who already liked this pandal would
    // otherwise see an unfilled heart and un-like it by tapping again.
    setLiked(false);
    if (pandal.year) {
      fetchLikedStatus(pandal.year.id, getVisitorId()).then(setLiked);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pandal, citySlug]);

  async function toggleLike() {
    if (!pandal.year) return;
    const yearId = pandal.year.id;
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikes((prev) => (wasLiked ? prev - 1 : prev + 1));

    try {
      const result = await toggleReaction(yearId, getVisitorId());
      setLiked(result.liked);
      setLikes(result.count);
    } catch {
      setLiked(wasLiked);
      setLikes((prev) => (wasLiked ? prev + 1 : prev - 1));
    }
  }

  function toggleSave() {
    setSaved(toggleSavedPandal(citySlug, pandal.slug));
  }

  // Velocity-aware dismiss: a fast flick down closes the sheet even if it
  // hasn't crossed DISMISS_THRESHOLD_PX yet, matching how native bottom
  // sheets (Google Maps, Apple Maps) respond to a flick vs. a slow drag. If
  // neither threshold is met, dragConstraints/dragElastic below spring the
  // sheet back to y:0 on their own — no manual snap-back needed.
  function handleDragEnd(_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    if (info.offset.y > DISMISS_THRESHOLD_PX || info.velocity.y > DISMISS_VELOCITY) {
      onClose();
    }
  }

  return (
    <>
      <motion.div
        className="fixed inset-0 z-30 bg-black/40 md:hidden"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      <motion.div
        className="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-3.5 rounded-t-[28px] border-t border-border bg-panel p-4 pb-6 shadow-2xl md:hidden"
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={handleDragEnd}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 420, damping: 38 }}
      >
        <div className="mx-auto h-1.5 w-10 flex-none cursor-grab touch-none rounded-full bg-white/20 active:cursor-grabbing" />

        <div className="flex gap-3.5">
          <div className="h-[92px] w-[92px] flex-none overflow-hidden rounded-2xl bg-card">
            {pandal.year?.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pandal.year.coverImage} alt="" className="h-full w-full object-cover" />
            ) : (
              <PandalPhotoPlaceholder className="h-full w-full" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {pandal.year?.featured && (
              <span className="flex w-fit items-center gap-1 font-body text-[11.5px] font-bold uppercase tracking-wide text-accent">
                <span className="material-symbols-rounded text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                  star
                </span>
                Featured
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="truncate font-display text-[17px] font-bold leading-tight">{pandal.canonicalName}</span>
              {pandal.verificationStatus === "VERIFIED" && (
                <span
                  className="material-symbols-rounded flex-none text-lg text-accent"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                  title="Verified by admin"
                >
                  verified
                </span>
              )}
            </span>
            <span className="truncate font-body text-sm text-ink-muted">{pandal.locality}</span>
          </div>
        </div>

        {pandal.year && pandal.year.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pandal.year.tags.map((tag) => (
              <span key={tag} className="rounded-pill border border-border bg-card px-2.5 py-1 font-body text-xs">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <DirectionsButton pandal={pandal} variant="block" />
          <button
            onClick={toggleLike}
            className={`flex h-12 items-center gap-1.5 rounded-2xl px-3.5 font-body text-sm font-bold ${liked ? "bg-brand text-brand-ink" : "bg-card"}`}
          >
            <span className="material-symbols-rounded text-base" style={liked ? { fontVariationSettings: "'FILL' 1" } : undefined}>
              favorite
            </span>
            {likes}
          </button>
          <button onClick={toggleSave} className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-card">
            <span
              className={`material-symbols-rounded ${saved ? "text-brand" : ""}`}
              style={saved ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              bookmark
            </span>
          </button>
          <TrailButton citySlug={citySlug} slug={pandal.slug} />
        </div>

        <Link
          href={pandalDetailHref(citySlug, pandal)}
          className="flex items-center justify-center gap-1 py-1 font-body text-sm font-bold text-brand"
        >
          View full details
          <span className="material-symbols-rounded text-lg">arrow_forward</span>
        </Link>
      </motion.div>
    </>
  );
}
