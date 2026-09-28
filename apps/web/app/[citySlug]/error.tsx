"use client";

// Covers routes under [citySlug] that aren't inside the (tabs) group — the
// pandal detail page in particular now throws (via fetchPandalDetailOrThrow)
// on a real API failure instead of silently rendering a 404, and this is
// what catches that. Error boundaries must be Client Components. Nested
// under CityShellLayout, so the persistent header/nav stays visible even
// while this renders.
export default function CityError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-body text-ink-muted">Something went wrong loading this page.</p>
      <button onClick={reset} className="rounded-pill bg-brand px-4 py-2 font-body text-sm font-bold text-brand-ink">
        Try again
      </button>
    </div>
  );
}
