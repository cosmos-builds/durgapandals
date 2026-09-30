"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

// Real full-page loads only (a browser refresh, or a URL typed/opened
// fresh) — not a replacement for any page's own loading state, and not
// shown again on client-side navigation between pages, because this
// component only ever mounts once per actual page load by construction:
// it's rendered directly in the root layout, which Next's App Router keeps
// mounted across route transitions and only re-mounts on a genuine
// navigation to the app from outside React (see app/layout.tsx). No
// separate "was this a reload" detection needed.
//
// How long it stays up is tied to a real signal (the browser's `load`
// event — fonts, images, and the initial script bundle all finish by
// then), not a guessed fixed delay, but bounded on both ends: MIN_MS stops
// it flashing for an instant on a fast connection/cache (and gives the
// logo-bump entrance below room to actually finish playing), MAX_MS is a
// safety net so a slow network never traps a visitor here indefinitely.
const MIN_VISIBLE_MS = 1400;
const MAX_VISIBLE_MS = 3500;

export function SplashScreen() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const start = Date.now();
    let settled = false;

    function reveal() {
      if (settled) return;
      settled = true;
      const elapsed = Date.now() - start;
      setTimeout(() => setVisible(false), Math.max(0, MIN_VISIBLE_MS - elapsed));
    }

    if (document.readyState === "complete") {
      reveal();
    } else {
      window.addEventListener("load", reveal, { once: true });
    }
    const maxTimer = setTimeout(reveal, MAX_VISIBLE_MS);

    return () => {
      window.removeEventListener("load", reveal);
      clearTimeout(maxTimer);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-ground px-6 text-center"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          aria-hidden={!visible}
        >
          {/* Logo enters small, overshoots past full size, then settles —
              a Myntra-style "bump in" — and only once that's basically
              finished (~0.55s) does the wordmark/tagline rise in, with the
              spinner last. A sequence, not everything fading in at once. */}
          {/* logo.png, not hero-durga.png — the hero art is a wide,
              off-center splash meant for a full-bleed banner (see
              intro-hero.tsx, opengraph-image.tsx); cropped into a small
              square icon here it would mostly show empty space. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <motion.img
            src="/images/logo.png"
            alt=""
            className="h-20 w-20 object-contain md:h-24 md:w-24"
            style={{ filter: "drop-shadow(0 8px 20px rgba(255,68,51,.4))" }}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: [0.3, 1.18, 0.95, 1], opacity: 1 }}
            transition={{ duration: 0.65, times: [0, 0.6, 0.8, 1], ease: "easeOut" }}
          />
          <motion.div
            className="flex flex-col gap-1.5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4, ease: "easeOut" }}
          >
            <span className="font-display text-xl font-extrabold md:text-2xl">
              durga<span className="text-brand">pandals</span>
            </span>
            <span className="font-body text-sm text-ink-muted md:text-base">
              Getting things ready — find every pandal, theme &amp; aarti timing, wherever you are.
            </span>
          </motion.div>
          <motion.span
            className="material-symbols-rounded animate-spin text-2xl text-accent"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.75, duration: 0.3 }}
          >
            progress_activity
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
