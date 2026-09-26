"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { useAdminGuard } from "@/lib/use-admin-guard";
import { adminFetch } from "@/lib/admin-api";

interface DashboardData {
  publishedPandals: number;
  draftPandals: number;
  pendingSubmissions: number;
  possibleDuplicates: number;
  corrections: number;
  cities: { cityId: string; cityName: string; activeFestivalYear: number; publishedPandalYears: number }[];
}

const STAT_CARDS = [
  { key: "publishedPandals", label: "Published pandals" },
  { key: "pendingSubmissions", label: "Pending submissions" },
  { key: "possibleDuplicates", label: "Possible duplicates" },
  { key: "corrections", label: "Corrections" },
  { key: "draftPandals", label: "Drafts" },
] as const;

export default function AdminDashboardPage() {
  const ready = useAdminGuard();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (!ready) return;
    adminFetch("/admin/dashboard")
      .then((res) => (res.ok ? res.json() : null))
      .then(setData);
  }, [ready]);

  if (!ready) return null;

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-extrabold">Dashboard</h1>
        <Link
          href="/pandals/new"
          className="rounded-xl bg-brand px-4 py-2 font-body text-sm font-bold text-brand-ink"
        >
          + Add Pandal
        </Link>
      </div>

      {!data ? (
        <p className="font-body text-ink-muted">Loading…</p>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5">
            {STAT_CARDS.map((card) => (
              <div key={card.key} className="rounded-card border border-border bg-panel p-5">
                <div className="font-display text-3xl font-extrabold">{data[card.key]}</div>
                <div className="mt-1 font-body text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {card.label}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-card border border-border bg-panel p-6">
            <h2 className="mb-4 font-body text-sm font-semibold uppercase tracking-wide text-ink-muted">
              By city
            </h2>
            {data.cities.length === 0 ? (
              <p className="font-body text-ink-muted">
                No cities yet.{" "}
                <Link href="/cities" className="font-bold text-brand">
                  Add one
                </Link>
                .
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.cities.map((city) => (
                  <li
                    key={city.cityId}
                    className="flex items-center justify-between rounded-xl bg-card px-4 py-3 font-body text-sm"
                  >
                    <span>
                      {city.cityName} · {city.activeFestivalYear}
                    </span>
                    <span className="text-ink-muted">{city.publishedPandalYears} published</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </AdminShell>
  );
}
