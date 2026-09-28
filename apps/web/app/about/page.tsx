import Link from "next/link";
import type { Metadata } from "next";
import { FestiveBunting } from "@/components/festive-bunting";

export const metadata: Metadata = {
  title: "About",
  description: "About DurgaPandal.com — a free, community-sourced, map-first directory of Durga Puja pandals.",
};

// Not city-scoped on purpose — this is the one page that's about the whole
// site rather than any single city's festival, so it lives outside
// [citySlug] instead of inheriting that layout's tabs/header.
const CONTACT_EMAIL = "hello@durgapandal.com";

const STEPS = [
  {
    icon: "location_on",
    title: "Find pandals on a live map",
    body: "No feed to scroll, no app to install — open the map, see every pandal near you, tap a pin for photos, timings, and directions.",
  },
  {
    icon: "group",
    title: "Built by the community",
    body: "Every listing starts as a submission from a visitor, organiser, or committee member — not scraped or guessed. Anyone can add a pandal or correct one that's wrong.",
  },
  {
    icon: "verified",
    title: "Checked before it goes live",
    body: "New listings are reviewed before they appear on the map, so you're not navigating to a pandal that moved, closed, or never existed.",
  },
  {
    icon: "payments",
    title: "Free, with no paid placements",
    body: "There's no ad slot or \"featured\" tier you can buy — every pandal gets the same map pin regardless of budget.",
  },
];

export default function AboutPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-ground pb-20 pt-20">
      {/* Contextual back-button header, matching Add Pandal/pandal detail's
          pattern (spec: those two intentionally skip the shared tabs
          header) — every page needs *some* way back, this one just didn't
          have one at all. */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center gap-3 bg-ground px-4 pb-3 pt-3">
        <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-full bg-card">
          <span className="material-symbols-rounded">arrow_back</span>
        </Link>
        <span className="font-body text-sm font-bold">About</span>
      </div>

      {/* Same warm diya glow Explore uses, for visual consistency */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-70"
        style={{
          background:
            "radial-gradient(60% 50% at 50% -10%, rgba(255,181,71,.16), transparent 70%), radial-gradient(40% 40% at 85% 5%, rgba(255,68,51,.14), transparent 70%)",
        }}
      />

      <div className="relative mx-auto flex max-w-xl flex-col items-center px-6 text-center">
        <Link href="/" className="flex flex-col items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="" className="h-28 w-28 object-contain" />
          <span className="font-display text-[44px] font-extrabold leading-none tracking-tight">
            durga<span className="text-brand">pandals</span>
          </span>
        </Link>

        <p className="mt-4 font-body text-lg text-ink-dim">
          A free, map-first way to find Durga Puja pandals — built by the community, for the community.
        </p>

        <FestiveBunting className="mt-8 h-8 w-full" flagCount={15} />

        <div className="mt-10 flex w-full flex-col gap-3 text-left">
          {STEPS.map((step) => (
            <div key={step.title} className="flex gap-3.5 rounded-3xl border border-border bg-panel p-4">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-chip">
                <span className="material-symbols-rounded text-brand">{step.icon}</span>
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="font-display text-base font-bold">{step.title}</span>
                <span className="font-body text-sm leading-relaxed text-ink-dim">{step.body}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-2 rounded-3xl border border-accent/20 bg-gradient-to-br from-[#2A1B2C] to-[#1E1726] p-6">
          <span className="font-display text-lg font-bold">Spotted something wrong?</span>
          <p className="max-w-sm font-body text-sm text-ink-dim">
            Wrong timings, a pandal that's missing, or one that's closed for good — tell us and we'll fix it.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-2 flex items-center gap-1.5 rounded-pill bg-brand px-5 py-2.5 font-body text-sm font-bold text-brand-ink"
          >
            <span className="material-symbols-rounded text-lg">mail</span>
            {CONTACT_EMAIL}
          </a>
        </div>

        <Link
          href="/"
          className="mt-8 flex items-center gap-1.5 font-body text-sm font-bold text-brand"
        >
          <span className="material-symbols-rounded text-lg">map</span>
          Back to the map
        </Link>
      </div>
    </main>
  );
}
