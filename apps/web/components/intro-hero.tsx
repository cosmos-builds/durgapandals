"use client";

import { FestiveBunting } from "./festive-bunting";

export interface IntroHeroProps {
  cityName: string;
  pandalCount: number;
  onExplore: () => void;
}

// First-visit-only festive landing (shown once, then remembered via
// localStorage — see lib/visitor.ts's hasSeenIntro/markIntroSeen) so new
// visitors get festival context before landing straight on a bare map, but
// repeat visitors aren't slowed down by it. Lives as an overlay rather than
// a separate route so it doesn't touch the "home is the map" routing.
export function IntroHero({ cityName, pandalCount, onExplore }: IntroHeroProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-ground">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[75%] opacity-90"
        style={{
          background:
            "radial-gradient(65% 55% at 50% 0%, rgba(255,181,71,.24), transparent 70%), radial-gradient(45% 45% at 90% 15%, rgba(255,68,51,.2), transparent 70%)",
        }}
      />

      <FestiveBunting className="h-7 w-full px-4 pt-4" flagCount={17} />

      <div className="relative flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        <span className="text-[64px] leading-none">🪔</span>
        <h1 className="max-w-sm font-display text-[32px] font-extrabold leading-tight tracking-tight">
          Discover Durga Puja pandals in <span className="text-brand">{cityName}</span>
        </h1>
        <p className="max-w-xs font-body text-[15px] text-ink-dim">
          Map-first, no login needed — find a pandal, tap the pin, get directions.
        </p>
        <span className="flex items-center gap-1.5 rounded-pill border border-accent/30 bg-card px-4 py-1.5 font-body text-sm font-semibold text-accent">
          <span className="material-symbols-rounded text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
            location_on
          </span>
          {pandalCount} pandal{pandalCount === 1 ? "" : "s"} live this festival
        </span>
        <button
          onClick={onExplore}
          className="mt-4 flex items-center gap-2 rounded-pill bg-brand px-7 py-4 font-body text-base font-bold text-brand-ink shadow-lg"
        >
          Explore Pandals
          <span className="material-symbols-rounded">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
