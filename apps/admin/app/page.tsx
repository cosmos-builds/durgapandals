"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { useAdminGuard } from "@/lib/use-admin-guard";
import { adminFetch } from "@/lib/admin-api";
import { Card } from "@durgapandals/ui";
import {
  SubmissionsTimeseriesChart,
  StatusBreakdownChart,
  LikesLeaderboardChart,
  TopLocalitiesChart,
} from "@/components/dashboard-charts";
import { PandalsClusterMap, type DashboardPandal } from "@/components/pandals-cluster-map";

const MAP_TILES_URL = process.env.NEXT_PUBLIC_MAP_TILES_URL ?? "";
const INDIA_CENTER = { latitude: 22.9734, longitude: 78.6569 };

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
  const [timeseries, setTimeseries] = useState<{ date: string; count: number }[]>([]);
  const [byStatus, setByStatus] = useState<{ status: string; count: number }[]>([]);
  const [leaderboard, setLeaderboard] = useState<{ canonicalName: string; likes: number }[]>([]);
  const [topLocalities, setTopLocalities] = useState<{ locality: string; count: number }[]>([]);
  const [mapPandals, setMapPandals] = useState<DashboardPandal[]>([]);

  useEffect(() => {
    if (!ready) return;
    adminFetch("/admin/dashboard").then((res) => (res.ok ? res.json() : null)).then(setData);
    adminFetch("/admin/dashboard/submissions-timeseries").then((res) => (res.ok ? res.json() : [])).then(setTimeseries);
    adminFetch("/admin/dashboard/submissions-by-status").then((res) => (res.ok ? res.json() : [])).then(setByStatus);
    adminFetch("/admin/dashboard/likes-leaderboard").then((res) => (res.ok ? res.json() : [])).then(setLeaderboard);
    adminFetch("/admin/dashboard/top-localities").then((res) => (res.ok ? res.json() : [])).then(setTopLocalities);
    adminFetch("/admin/pandals-map").then((res) => (res.ok ? res.json() : [])).then(setMapPandals);
  }, [ready]);

  if (!ready) return null;

  const mapCenter =
    mapPandals.length > 0
      ? {
          latitude: mapPandals.reduce((sum, p) => sum + p.latitude, 0) / mapPandals.length,
          longitude: mapPandals.reduce((sum, p) => sum + p.longitude, 0) / mapPandals.length,
        }
      : INDIA_CENTER;

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
              <Card key={card.key} padding="sm">
                <div className="font-display text-3xl font-extrabold">{data[card.key]}</div>
                <div className="mt-1 font-body text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {card.label}
                </div>
              </Card>
            ))}
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card padding="sm">
              <h2 className="mb-3 font-body text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Submissions, last 30 days
              </h2>
              <SubmissionsTimeseriesChart data={timeseries} />
            </Card>
            <Card padding="sm">
              <h2 className="mb-3 font-body text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Submissions by status
              </h2>
              <StatusBreakdownChart data={byStatus} />
            </Card>
            <Card padding="sm">
              <h2 className="mb-3 font-body text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Likes leaderboard
              </h2>
              {leaderboard.length > 0 ? (
                <LikesLeaderboardChart data={leaderboard} />
              ) : (
                <p className="font-body text-sm text-ink-muted">No likes yet.</p>
              )}
            </Card>
            <Card padding="sm">
              <h2 className="mb-3 font-body text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Top localities by submissions
              </h2>
              {topLocalities.length > 0 ? (
                <TopLocalitiesChart data={topLocalities} />
              ) : (
                <p className="font-body text-sm text-ink-muted">No submissions yet.</p>
              )}
            </Card>
          </div>

          <Card padding="sm" className="mb-8">
            <h2 className="mb-3 font-body text-sm font-semibold uppercase tracking-wide text-ink-muted">
              All pandals — click a cluster to zoom in, a pin to open it
            </h2>
            {mapPandals.length > 0 && (
              <PandalsClusterMap mapTilesUrl={MAP_TILES_URL} center={mapCenter} zoom={4} pandals={mapPandals} />
            )}
          </Card>

          <Card padding="md">
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
          </Card>
        </>
      )}
    </AdminShell>
  );
}
