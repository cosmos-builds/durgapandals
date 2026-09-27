"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { clearAdminToken } from "@/lib/admin-api";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/cities", label: "Cities" },
  { href: "/pandals", label: "Pandals" },
  { href: "/submissions", label: "Submissions" },
] as const;

const WORDMARK = (
  <span className="font-display text-lg font-extrabold tracking-tight">
    durga<span className="text-brand">pandals</span>
  </span>
);

// Primary admin sections (spec §22) — every admin page renders inside this
// shell instead of re-implementing its own nav. The sidebar was previously
// a fixed 224px column with no mobile handling at all — on a phone-width
// viewport that ate most of the screen regardless of content, which is
// what made the whole admin app read as "not responsive" (every page
// inherits this shell). Desktop keeps the persistent sidebar; mobile gets
// a top bar + slide-in drawer instead.
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  function signOut() {
    clearAdminToken();
    router.push("/login");
  }

  const navLinks = NAV.map((item) => {
    const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setNavOpen(false)}
        className={`rounded-xl px-3 py-2 font-body text-sm font-semibold ${
          isActive ? "bg-card text-ink" : "text-ink-muted hover:text-ink"
        }`}
      >
        {item.label}
      </Link>
    );
  });

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ground md:flex-row">
      {/* Mobile top bar — desktop uses the persistent sidebar below instead */}
      <div className="flex flex-none items-center justify-between border-b border-border px-4 py-3 md:hidden">
        {WORDMARK}
        <button
          onClick={() => setNavOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-card"
        >
          <span className="material-symbols-rounded">menu</span>
        </button>
      </div>

      <aside className="hidden h-full w-56 flex-none flex-col gap-1 overflow-y-auto border-r border-border p-4 md:flex">
        <div className="mb-6 px-2">{WORDMARK}</div>
        {navLinks}
        <button
          onClick={signOut}
          className="mt-auto rounded-xl px-3 py-2 text-left font-body text-sm font-semibold text-ink-muted hover:text-ink"
        >
          Sign out
        </button>
      </aside>

      {navOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setNavOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col gap-1 bg-panel p-4 shadow-2xl md:hidden">
            <div className="mb-4 flex items-center justify-between">
              {WORDMARK}
              <button
                onClick={() => setNavOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-card"
              >
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>
            {navLinks}
            <button
              onClick={signOut}
              className="mt-auto rounded-xl px-3 py-2 text-left font-body text-sm font-semibold text-ink-muted hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </>
      )}

      <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
    </div>
  );
}
