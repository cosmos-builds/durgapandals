"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { AdminShell } from "@/components/admin-shell";
import { useAdminGuard } from "@/lib/use-admin-guard";
import { adminFetch } from "@/lib/admin-api";
import { Card } from "@durgapandals/ui";
import {
  SubmissionsTimeseriesChart,
  StatusBreakdownChart,
  LikesLeaderboardChart,
  TopLocalitiesChart,
  PandalsByCityChart,
} from "@/components/dashboard-charts";
import { PandalsClusterMap, type DashboardPandal } from "@/components/pandals-cluster-map";
import { AnimatedNumber } from "@/components/animated-number";

const MotionCard = motion.create(Card);
const fadeUpStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 320, damping: 30 } },
};

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

interface PendingSubmission {
  _id: string;
  type: string;
  cityId: string;
  submittedData: { canonicalName?: string; locality?: string };
  createdAt: string;
}

// Icons only — no fabricated trend deltas (mockup shows "+12%" etc, but we
// don't compute period-over-period comparisons anywhere, and inventing one
// would be worse than omitting it). "App visits today" from the mockup is
// dropped entirely for the same reason: there's no analytics/visit-tracking
// feature behind it.
const STAT_CARDS = [
  { key: "publishedPandals", label: "Published pandals", icon: "temple_hindu" },
  { key: "pendingSubmissions", label: "Pending submissions", icon: "fact_check" },
  { key: "possibleDuplicates", label: "Possible duplicates", icon: "content_copy" },
  { key: "corrections", label: "Corrections", icon: "edit_note" },
  { key: "draftPandals", label: "Drafts", icon: "draft" },
] as const;

export default function AdminDashboardPage() {
  const ready = useAdminGuard();
  const [data, setData] = useState<DashboardData | null>(null);
  const [timeseries, setTimeseries] = useState<{ date: string; count: number }[]>([]);
  const [byStatus, setByStatus] = useState<{ status: string; count: number }[]>([]);
  const [leaderboard, setLeaderboard] = useState<{ canonicalName: string; likes: number }[]>([]);
  const [topLocalities, setTopLocalities] = useState<{ locality: string; count: number }[]>([]);
  const [mapPandals, setMapPandals] = useState<DashboardPandal[]>([]);
  const [pending, setPending] = useState<PendingSubmission[]>([]);

  useEffect(() => {
    if (!ready) return;
    adminFetch("/admin/dashboard").then((res) => (res.ok ? res.json() : null)).then(setData);
    adminFetch("/admin/dashboard/submissions-timeseries").then((res) => (res.ok ? res.json() : [])).then(setTimeseries);
    adminFetch("/admin/dashboard/submissions-by-status").then((res) => (res.ok ? res.json() : [])).then(setByStatus);
    adminFetch("/admin/dashboard/likes-leaderboard").then((res) => (res.ok ? res.json() : [])).then(setLeaderboard);
    adminFetch("/admin/dashboard/top-localities").then((res) => (res.ok ? res.json() : [])).then(setTopLocalities);
    adminFetch("/admin/pandals-map").then((res) => (res.ok ? res.json() : [])).then(setMapPandals);
    adminFetch("/admin/submissions?status=PENDING")
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: PendingSubmission[]) => setPending(rows.slice(0, 5)));
  }, [ready]);

  const cityNameById = useMemo(() => new Map(data?.cities.map((c) => [c.cityId, c.cityName]) ?? []), [data]);

  function exportReport() {
    if (!data) return;
    const rows: string[][] = [
      ["Metric", "Value"],
      ["Published pandals", String(data.publishedPandals)],
      ["Pending submissions", String(data.pendingSubmissions)],
      ["Possible duplicates", String(data.possibleDuplicates)],
      ["Corrections", String(data.corrections)],
      ["Drafts", String(data.draftPandals)],
      [],
      ["City", "Active festival year", "Published pandal-years"],
      ...data.cities.map((c) => [c.cityName, String(c.activeFestivalYear), String(c.publishedPandalYears)]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `durgapandals-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Dashboard</h1>
          {data && (
            <p className="mt-1 font-body text-sm text-ink-muted">
              {data.cities.length} active {data.cities.length === 1 ? "city" : "cities"}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportReport}
            disabled={!data}
            className="flex h-[42px] items-center gap-1.5 rounded-xl bg-brand px-4 font-body text-sm font-bold text-brand-ink disabled:opacity-50"
          >
            <span className="material-symbols-rounded text-lg">download</span>
            Export report
          </button>
          <Link
            href="/pandals/new"
            className="flex h-[42px] items-center gap-1.5 rounded-xl border border-border px-4 font-body text-sm font-bold"
          >
            <span className="material-symbols-rounded text-lg">add</span>
            Add Pandal
          </Link>
        </div>
      </div>

      {!data ? (
        <p className="font-body text-ink-muted">Loading…</p>
      ) : (
        <>
          <motion.div
            className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5"
            variants={fadeUpStagger}
            initial="hidden"
            animate="show"
          >
            {STAT_CARDS.map((card) => (
              <MotionCard key={card.key} padding="sm" variants={fadeUp}>
                <span className="material-symbols-rounded text-accent">{card.icon}</span>
                <div className="mt-2 font-display text-3xl font-extrabold">
                  <AnimatedNumber value={data[card.key]} />
                </div>
                <div className="mt-1 font-body text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {card.label}
                </div>
              </MotionCard>
            ))}
          </motion.div>

          <motion.div
            className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2"
            variants={fadeUpStagger}
            initial="hidden"
            animate="show"
          >
            <MotionCard padding="sm" variants={fadeUp}>
              <h2 className="mb-3 font-body text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Published pandals by city
              </h2>
              {data.cities.length > 0 ? (
                <PandalsByCityChart data={data.cities} />
              ) : (
                <p className="font-body text-sm text-ink-muted">No cities yet.</p>
              )}
            </MotionCard>
            <MotionCard padding="sm" variants={fadeUp}>
              <h2 className="mb-3 font-body text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Submissions, last 30 days
              </h2>
              <SubmissionsTimeseriesChart data={timeseries} />
            </MotionCard>
            <MotionCard padding="sm" variants={fadeUp}>
              <h2 className="mb-3 font-body text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Submissions by status
              </h2>
              <StatusBreakdownChart data={byStatus} />
            </MotionCard>
            <MotionCard padding="sm" variants={fadeUp}>
              <h2 className="mb-3 font-body text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Likes leaderboard
              </h2>
              {leaderboard.length > 0 ? (
                <LikesLeaderboardChart data={leaderboard} />
              ) : (
                <p className="font-body text-sm text-ink-muted">No likes yet.</p>
              )}
            </MotionCard>
            <MotionCard padding="sm" variants={fadeUp}>
              <h2 className="mb-3 font-body text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Top localities by submissions
              </h2>
              {topLocalities.length > 0 ? (
                <TopLocalitiesChart data={topLocalities} />
              ) : (
                <p className="font-body text-sm text-ink-muted">No submissions yet.</p>
              )}
            </MotionCard>
          </motion.div>

          <Card padding="sm" className="mb-8">
            <h2 className="mb-3 font-body text-sm font-semibold uppercase tracking-wide text-ink-muted">
              All pandals — click a cluster to zoom in, a pin to open it
            </h2>
            {mapPandals.length > 0 && (
              <PandalsClusterMap mapTilesUrl={MAP_TILES_URL} center={mapCenter} zoom={4} pandals={mapPandals} />
            )}
          </Card>

          <Card padding="sm" className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-body text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Pending submissions
              </span>
              <Link href="/submissions" className="font-body text-xs font-bold text-accent">
                View all →
              </Link>
            </div>
            {pending.length === 0 ? (
              <p className="font-body text-sm text-ink-muted">Nothing pending review.</p>
            ) : (
              <motion.div className="flex flex-col" variants={fadeUpStagger} initial="hidden" animate="show">
                {pending.map((submission) => (
                  <motion.div
                    key={submission._id}
                    variants={fadeUp}
                    className="flex items-center gap-3 border-t border-border py-2.5 first:border-0"
                  >
                    <span className="h-2 w-2 flex-none rounded-full bg-accent" />
                    <span className="flex-1 truncate font-body text-sm font-semibold">
                      {submission.submittedData.canonicalName ?? "(update / correction)"}
                    </span>
                    <span className="font-body text-xs text-ink-muted">{cityNameById.get(submission.cityId) ?? ""}</span>
                    <span className="rounded-pill bg-chip px-2.5 py-1 font-body text-[11px] font-bold">
                      {submission.type.replace("_", " ")}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
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
