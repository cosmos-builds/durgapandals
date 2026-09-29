"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { clearAdminToken, getAdminEmail } from "@/lib/admin-api";

const NAV = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/pandals", label: "Pandals", icon: "temple_hindu" },
  { href: "/pandals/new", label: "Add Pandal", icon: "add_location_alt" },
  { href: "/submissions", label: "Submissions", icon: "fact_check" },
  { href: "/cities", label: "Cities", icon: "public" },
] as const;

const WORDMARK = (
  <span className="flex items-center gap-2">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/images/logo.png" alt="" className="h-8 w-8 object-contain" />
    <span className="font-display text-lg font-extrabold tracking-tight">
      durga<span className="text-brand">pandals</span> Admin
    </span>
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
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    setEmail(getAdminEmail());
  }, []);

  function signOut() {
    clearAdminToken();
    router.push("/login");
  }

  // Rendered once for the desktop sidebar and once for the mobile drawer —
  // both can be mounted in the DOM at once (the sidebar merely hides below
  // md), so each copy needs its own layoutId namespace or the shared-element
  // active-tab animation would try to fly between two on-screen instances at
  // once.
  function renderNavLinks(namespace: string) {
    return NAV.map((item) => {
      // "Pandals" should stay active on its own detail pages (/pandals/[id])
      // but not steal the highlight from the more specific "Add Pandal" link
      // on /pandals/new.
      const isActive =
        item.href === "/"
          ? pathname === "/"
          : item.href === "/pandals"
            ? pathname === "/pandals" || (pathname.startsWith("/pandals/") && pathname !== "/pandals/new")
            : pathname === item.href;
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setNavOpen(false)}
          className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2 font-body text-sm font-semibold ${
            isActive ? "text-brand-ink" : "text-ink-muted hover:text-ink"
          }`}
        >
          {isActive && (
            <motion.span
              layoutId={`admin-nav-active-bg-${namespace}`}
              className="absolute inset-0 rounded-xl bg-brand"
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
            />
          )}
          <span className="material-symbols-rounded relative text-[19px]">{item.icon}</span>
          <span className="relative">{item.label}</span>
        </Link>
      );
    });
  }

  // Falls back to a generic initial/label if the token can't be read (e.g.
  // hasn't loaded yet) rather than showing a fabricated name.
  const initial = email ? email.charAt(0).toUpperCase() : "?";

  const identityBlock = (
    <div className="flex items-center gap-2.5 border-t border-border px-3 pt-3">
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-chip font-body text-xs font-extrabold">
        {initial}
      </span>
      <span className="min-w-0 flex-1 truncate font-body text-xs font-semibold text-ink-muted">
        {email ?? "Signed in"}
      </span>
    </div>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ground md:flex-row">
      {/* Mobile top bar — desktop uses the persistent sidebar below instead */}
      <div className="flex flex-none items-center justify-between border-b border-border bg-ground-deep px-4 py-3 md:hidden">
        {WORDMARK}
        <button
          onClick={() => setNavOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-card"
        >
          <span className="material-symbols-rounded">menu</span>
        </button>
      </div>

      <aside className="hidden h-full w-[230px] flex-none flex-col gap-1 overflow-y-auto border-r border-border bg-ground-deep p-3.5 md:flex">
        <div className="mb-5 px-1.5 pt-1">{WORDMARK}</div>
        {renderNavLinks("desktop")}
        <button
          onClick={signOut}
          className="mt-2 rounded-xl px-3 py-2 text-left font-body text-sm font-semibold text-ink-muted hover:text-ink"
        >
          Sign out
        </button>
        <div className="mt-auto" />
        {identityBlock}
      </aside>

      <AnimatePresence>
        {navOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setNavOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col gap-1 bg-ground-deep p-4 shadow-2xl md:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
            >
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
              {renderNavLinks("mobile")}
              <button
                onClick={signOut}
                className="mt-2 rounded-xl px-3 py-2 text-left font-body text-sm font-semibold text-ink-muted hover:text-ink"
              >
                Sign out
              </button>
              <div className="mt-auto" />
              {identityBlock}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
    </div>
  );
}
