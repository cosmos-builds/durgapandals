"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface BottomNavProps {
  citySlug: string;
}

const ITEMS = [
  { key: "map", label: "Map", icon: "map", suffix: "" },
  { key: "explore", label: "Explore", icon: "view_agenda", suffix: "/explore" },
  { key: "saved", label: "Saved", icon: "bookmark", suffix: "/saved" },
  { key: "add", label: "Add Pandal", icon: "add_circle", suffix: "/add" },
] as const;

// Primary public navigation (spec §4) — rendered once from the (tabs) layout
// so it stays mounted (fixed to the viewport) across page navigations instead
// of remounting/flickering on every route change. Mobile only: a bottom tab
// bar is a mobile pattern, and Saved/Add Pandal move into TopHeader on
// desktop instead, so this hides entirely at that width rather than
// duplicating those destinations in two places.
export function BottomNav({ citySlug }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-ground/95 px-2 pt-2 backdrop-blur md:hidden">
      {ITEMS.map((item) => {
        const href = `/${citySlug}${item.suffix}`;
        const isActive = pathname === href;
        return (
          <Link
            key={item.key}
            href={href}
            className="flex h-[54px] flex-col items-center justify-center gap-1"
          >
            <span
              className={`material-symbols-rounded text-[22px] ${isActive ? "text-brand" : "text-ink-muted"}`}
              style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {item.icon}
            </span>
            <span className={`text-[11px] font-semibold ${isActive ? "text-ink" : "text-ink-muted"}`}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
