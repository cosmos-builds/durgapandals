"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useToast } from "@durgapandals/ui";
import { MAX_TRAIL_STOPS } from "@durgapandals/maps";
import { addToTrail, isInTrail, removeFromTrail, TRAIL_CHANGED_EVENT } from "@/lib/trail";

export interface TrailButtonProps {
  citySlug: string;
  slug: string;
  /** "icon" (default): icon + short "Trail" label, sized to match the
   *  like/save buttons next to it. "compact": icon + full "Add to trail"
   *  label, for list rows with more horizontal room. Neither variant is a
   *  bare icon any more — a route icon with no text had no common meaning
   *  to a visitor who's never seen this feature before, so it went
   *  unclicked and the trail-planner feature went undiscovered entirely. */
  variant?: "icon" | "compact";
  className?: string;
}

// The core interaction of the trail-planner feature (packages/maps'
// externalTrailDirectionsUrl) — tapping this is how a pandal gets added to
// the visitor's in-progress multi-stop route. Mirrors the existing
// save/bookmark button's shape (icon-only, toggled fill) so it reads as a
// sibling action rather than a bolted-on new pattern.
export function TrailButton({ citySlug, slug, variant = "icon", className = "" }: TrailButtonProps) {
  const [inTrail, setInTrail] = useState(false);
  const toast = useToast();

  useEffect(() => {
    function sync() {
      setInTrail(isInTrail(citySlug, slug));
    }
    sync();
    window.addEventListener(TRAIL_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(TRAIL_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [citySlug, slug]);

  function handleClick(event: React.MouseEvent) {
    // Every call site renders this inside a Link/clickable card — without
    // this the click would also navigate/select the underlying row.
    event.preventDefault();
    event.stopPropagation();

    if (inTrail) {
      removeFromTrail(citySlug, slug);
      return;
    }
    const added = addToTrail(citySlug, slug);
    if (!added) {
      toast.error(`A trail can only have ${MAX_TRAIL_STOPS} stops — remove one first.`);
    }
  }

  const icon = (
    <motion.span
      key={inTrail ? "on" : "off"}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`material-symbols-rounded ${inTrail ? "text-accent" : ""}`}
      style={inTrail ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {inTrail ? "route" : "add_road"}
    </motion.span>
  );

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={inTrail}
        className={`flex h-9 items-center gap-1.5 rounded-pill border px-3 font-body text-xs font-bold ${
          inTrail ? "border-accent/40 bg-accent/15 text-accent" : "border-border bg-card text-ink-dim"
        } ${className}`}
      >
        {icon}
        {inTrail ? "In trail" : "Add to trail"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={inTrail}
      aria-label={inTrail ? "Remove from trail" : "Add to trail"}
      className={`flex h-10 flex-none items-center gap-1 rounded-2xl px-3 font-body text-xs font-bold ${
        inTrail ? "bg-accent/15 text-accent" : "bg-card"
      } ${className}`}
    >
      {icon}
      Trail
    </button>
  );
}
