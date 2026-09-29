import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-ground px-6 text-center">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-70"
        style={{
          background:
            "radial-gradient(60% 50% at 50% -10%, rgba(255,181,71,.16), transparent 70%), radial-gradient(40% 40% at 85% 5%, rgba(255,68,51,.14), transparent 70%)",
        }}
      />

      <div className="relative flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo.png" alt="" className="h-20 w-20 object-contain" />
        <span className="mt-4 font-mono text-sm font-bold uppercase tracking-wide text-ink-muted">404</span>
        <h1 className="mt-2 font-display text-2xl font-extrabold">This pandal wandered off</h1>
        <p className="mt-2 max-w-sm font-body text-sm text-ink-dim">
          The page you're looking for doesn't exist, or it may have moved. Let's get you back to the map.
        </p>

        <Link
          href="/"
          className="mt-8 flex items-center gap-1.5 rounded-pill bg-brand px-5 py-2.5 font-body text-sm font-bold text-brand-ink"
        >
          <span className="material-symbols-rounded text-lg">map</span>
          Back to the map
        </Link>
      </div>
    </main>
  );
}
