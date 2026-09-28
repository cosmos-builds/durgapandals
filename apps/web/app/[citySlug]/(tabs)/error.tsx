"use client";

// Error boundaries must be Client Components (Next.js convention) — this
// catches a thrown fetchPandalsForCityOrThrow failure on Map/Explore so a
// real API outage renders as "something went wrong, retry" instead of
// silently looking like an empty city (the old safeJson-swallows-everything
// behavior on these two pages).
export default function TabsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-body text-ink-muted">Couldn&apos;t load pandals right now.</p>
      <button onClick={reset} className="rounded-pill bg-brand px-4 py-2 font-body text-sm font-bold text-brand-ink">
        Try again
      </button>
    </div>
  );
}
