"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { externalDirectionsUrl } from "@durgapandals/maps";
import type { PandalSummary } from "@/lib/api";
import { getSavedPandalSlugs, getVisitorId, toggleSavedPandal } from "@/lib/visitor";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const DISMISS_THRESHOLD_PX = 110;

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
  const [dragY, setDragY] = useState(0);
  const dragState = useRef<{ startY: number; dragging: boolean } | null>(null);

  useEffect(() => {
    setLikes(pandal.likes);
    setLiked(false);
    setSaved(getSavedPandalSlugs().includes(pandal.slug));
    setDragY(0);
  }, [pandal]);

  async function toggleLike() {
    if (!pandal.year) return;
    setLiked((prev) => !prev);
    setLikes((prev) => (liked ? prev - 1 : prev + 1));
    const response = await fetch(`${API_BASE_URL}/reactions/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pandalYearId: pandal.year.id, anonymousVisitorId: getVisitorId() }),
    });
    if (response.ok) {
      const body = await response.json();
      setLiked(body.liked);
      setLikes(body.count);
    }
  }

  function toggleSave() {
    setSaved(toggleSavedPandal(pandal.slug));
  }

  function handlePointerDown(event: React.PointerEvent) {
    dragState.current = { startY: event.clientY, dragging: true };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent) {
    if (!dragState.current?.dragging) return;
    const delta = event.clientY - dragState.current.startY;
    setDragY(Math.max(0, delta));
  }

  function handlePointerUp() {
    if (!dragState.current) return;
    dragState.current.dragging = false;
    if (dragY > DISMISS_THRESHOLD_PX) {
      onClose();
    } else {
      setDragY(0);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={onClose} />

      <div
        className="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-3.5 rounded-t-[28px] border-t border-border bg-panel p-4 pb-6 shadow-2xl transition-transform md:hidden"
        style={{ transform: `translateY(${dragY}px)`, transition: dragState.current?.dragging ? "none" : "transform 0.2s ease" }}
      >
        <div
          className="mx-auto h-1.5 w-10 flex-none cursor-grab touch-none rounded-full bg-white/20 active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />

        <div className="flex gap-3.5">
          <div className="h-[92px] w-[92px] flex-none overflow-hidden rounded-2xl bg-card">
            {pandal.year?.coverImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pandal.year.coverImage} alt="" className="h-full w-full object-cover" />
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
            <span className="truncate font-display text-xl font-bold leading-tight">{pandal.canonicalName}</span>
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
          <a
            href={externalDirectionsUrl(pandal)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand py-3 font-body font-bold text-brand-ink"
          >
            <span className="material-symbols-rounded" style={{ fontVariationSettings: "'FILL' 1" }}>
              directions
            </span>
            Directions
          </a>
          <button
            onClick={toggleLike}
            className={`flex items-center gap-1.5 rounded-2xl px-3.5 font-body font-bold ${liked ? "bg-accent text-accent-ink" : "bg-card"}`}
          >
            <span className="material-symbols-rounded" style={liked ? { fontVariationSettings: "'FILL' 1" } : undefined}>
              thumb_up
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
        </div>

        <Link
          href={`/${citySlug}/pandal/${pandal.slug}`}
          className="flex items-center justify-center gap-1 py-1 font-body text-sm font-bold text-brand"
        >
          View full details
          <span className="material-symbols-rounded text-lg">arrow_forward</span>
        </Link>
      </div>
    </>
  );
}
