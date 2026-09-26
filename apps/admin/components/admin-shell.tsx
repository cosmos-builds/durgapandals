"use client";

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

// Primary admin sections (spec §22) — every admin page renders inside this
// shell instead of re-implementing its own nav.
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex min-h-dvh bg-ground">
      <aside className="flex w-56 flex-none flex-col gap-1 border-r border-border p-4">
        <div className="mb-6 px-2 font-display text-lg font-extrabold tracking-tight">
          durga<span className="text-brand">pandals</span>
        </div>
        {NAV.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-xl px-3 py-2 font-body text-sm font-semibold ${
                isActive ? "bg-card text-ink" : "text-ink-muted hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={() => {
            clearAdminToken();
            router.push("/login");
          }}
          className="mt-auto rounded-xl px-3 py-2 text-left font-body text-sm font-semibold text-ink-muted hover:text-ink"
        >
          Sign out
        </button>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
