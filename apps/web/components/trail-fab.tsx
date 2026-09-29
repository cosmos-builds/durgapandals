"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { getTrail, TRAIL_CHANGED_EVENT } from "@/lib/trail";
import { TrailSheet } from "./trail-sheet";

export interface TrailFabProps {
  citySlug: string;
}

// Global entry point for the trail-planner feature — mounted once at the
// (tabs) layout level so it persists across Map/Explore/Saved (matches
// BottomNav's own "rendered once, not per-page" reasoning) rather than
// living inside any single page. Stays hidden until the visitor has actually
// added a stop, since an empty trail button would just be clutter on every
// screen for visitors who never use the feature.
export function TrailFab({ citySlug }: TrailFabProps) {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function sync() {
      setCount(getTrail(citySlug).length);
    }
    sync();
    window.addEventListener(TRAIL_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(TRAIL_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [citySlug]);

  return (
    <>
      <AnimatePresence>
        {count > 0 && !open && (
          <motion.button
            onClick={() => setOpen(true)}
            initial={{ opacity: 0, scale: 0.6, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-[80px] right-4 z-30 flex h-12 items-center gap-2 rounded-pill bg-accent pl-3.5 pr-4 font-body text-sm font-bold text-accent-ink shadow-2xl md:bottom-6"
          >
            <span className="material-symbols-rounded text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
              route
            </span>
            Trail
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-ink/20 text-xs">
              {count}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <TrailSheet citySlug={citySlug} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
