import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Disclaimer",
  description: "How DurgaPandal.com sources its data, and why you should verify details before visiting.",
};

const CONTACT_EMAIL = "hello@durgapandal.com";

// Not city-scoped, same reasoning as the About page — this is about the
// whole site, so it lives outside [citySlug] instead of inheriting that
// layout's tabs/header.
const SECTIONS = [
  {
    title: "Where this data comes from",
    body: "Pandal listings on this site are collected from a mix of sources — public submissions from visitors, organisers, and committee members; word of mouth; and information gathered from publicly available websites. None of it comes from an official or authoritative registry, and not every listing has been independently confirmed on the ground.",
  },
  {
    title: "Accuracy isn't guaranteed",
    body: "Timings, themes, locations, and amenities can change close to or during the festival without any of our sources telling us. We try to keep listings current, but we can't promise every detail is correct or up to date at the moment you read it.",
  },
  {
    title: "Please verify before you travel",
    body: "If a visit depends on a specific timing, theme, or address, we'd recommend confirming with the pandal committee or a recent visitor before heading out, especially for anything time-sensitive like aarti timings or immersion dates.",
  },
  {
    title: "No official affiliation",
    body: "DurgaPandal.com is an independent, unofficial directory. We are not affiliated with, endorsed by, or acting on behalf of any puja committee, organisers' association, or government body.",
  },
  {
    title: "Spot something wrong?",
    body: "Corrections make this better for everyone. If you notice inaccurate, outdated, or missing information, please let us know and we'll fix it.",
  },
];

export default function DisclaimerPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-ground pb-20 pt-20">
      <div className="fixed inset-x-0 top-0 z-30 flex items-center gap-3 bg-ground px-4 pb-3 pt-3">
        <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-full bg-card">
          <span className="material-symbols-rounded">arrow_back</span>
        </Link>
        <span className="font-body text-sm font-bold">Disclaimer</span>
      </div>

      <div className="relative mx-auto flex max-w-xl flex-col px-6">
        <p className="mt-2 font-body text-sm text-ink-dim">
          Please read this before relying on anything you find on DurgaPandal.com.
        </p>

        <div className="mt-8 flex flex-col gap-5">
          {SECTIONS.map((section) => (
            <div key={section.title} className="flex flex-col gap-1.5 rounded-3xl border border-border bg-panel p-4">
              <span className="font-display text-base font-bold">{section.title}</span>
              <p className="font-body text-sm leading-relaxed text-ink-dim">{section.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-2 rounded-3xl border border-accent/20 bg-gradient-to-br from-[#2A1B2C] to-[#1E1726] p-6 text-center">
          <span className="font-display text-lg font-bold">Report an issue</span>
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

        <Link href="/" className="mx-auto mt-8 flex items-center gap-1.5 font-body text-sm font-bold text-brand">
          <span className="material-symbols-rounded text-lg">map</span>
          Back to the map
        </Link>
      </div>
    </main>
  );
}
