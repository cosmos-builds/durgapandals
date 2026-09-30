"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { useAdminGuard } from "@/lib/use-admin-guard";
import { adminFetch, adminMutate } from "@/lib/admin-api";
import { Button, Card, Textarea } from "@durgapandals/ui";
import { CandidatesMap, type Candidate } from "@/components/candidates-map";

const MAP_TILES_URL = process.env.NEXT_PUBLIC_MAP_TILES_URL ?? "";

// Shape submitted by apps/web's AddPandalFlow (see doSubmit there) — every
// field is optional here because a CORRECTION/UPDATE_PANDAL submission only
// ever carries `note`, not the full pandal shape.
interface SubmittedPandalData {
  canonicalName?: string;
  organizerName?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  locality?: string;
  landmark?: string;
  publicContact?: string;
  theme?: string;
  description?: string;
  categories?: string[];
  photos?: { url: string }[];
  year?: number;
  parkingAvailable?: boolean;
  twoWheelerAccessible?: boolean;
  fourWheelerAccessible?: boolean;
  foodStallsNearby?: boolean;
  streetShopsNearby?: boolean;
  visitType?: string;
  schedule?: { time: string; label: string }[];
  note?: string;
  // REPORT type only (see apps/web's report-pandal-flow.tsx) — a visitor
  // flagging something about an *existing* pandal, replacing the old
  // "It's mine" claim flow that captured no real content.
  category?: string;
}

interface Submission {
  _id: string;
  type: string;
  status: string;
  submittedData: SubmittedPandalData;
  submitterIp?: string;
  possiblePandalId?: string;
  cityDistanceMeters?: number;
  contributor: { id: string; identifier: string; blocked: boolean } | null;
  duplicateCandidates: (Candidate & { reasons: string[]; distanceMeters: number; canonicalName?: string })[];
  createdAt: string;
}

type Tab = "ALL" | "NEW_PANDAL" | "REPORT" | "CORRECTION";

const TABS: { key: Tab; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "NEW_PANDAL", label: "New pandal" },
  { key: "REPORT", label: "Reports" },
  { key: "CORRECTION", label: "Corrections" },
];

const REPORT_CATEGORY_LABELS: Record<string, string> = {
  OUTDATED_INFO: "Info is outdated",
  WRONG_LOCATION: "Wrong location",
  PERMANENTLY_CLOSED: "No longer exists",
  DUPLICATE: "Duplicate listing",
  INAPPROPRIATE: "Inappropriate content",
  OTHER: "Other",
};

// Generous on purpose — a real city's outskirts can genuinely be this far
// from its center pin. This isn't trying to be precise, just to catch the
// unambiguous case (a submission attributed to a city tens/hundreds of km
// away from where it actually is).
const CITY_DISTANCE_WARNING_METERS = 50_000;

const VISIT_TYPE_LABELS: Record<string, string> = {
  WALKING_DARSHAN: "Walking darshan · quick visit",
  PARK_AND_VISIT: "Park & visit",
  DARSHAN_AND_GO: "Darshan & go",
};

const AMENITY_LABELS: [keyof SubmittedPandalData, string][] = [
  ["parkingAvailable", "Parking available"],
  ["twoWheelerAccessible", "2-wheeler accessible"],
  ["fourWheelerAccessible", "4-wheeler accessible"],
  ["foodStallsNearby", "Food stalls nearby"],
  ["streetShopsNearby", "Street shops nearby"],
];

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-body text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
      <span className="font-body text-sm text-ink">{value}</span>
    </div>
  );
}

export default function SubmissionsPage() {
  const ready = useAdminGuard();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [tab, setTab] = useState<Tab>("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleSubmissions = submissions.filter((s) => tab === "ALL" || s.type === tab);
  const active = visibleSubmissions.find((s) => s._id === activeId) ?? visibleSubmissions[0] ?? null;

  async function load() {
    const res = await adminFetch("/admin/submissions?status=PENDING");
    if (res.ok) setSubmissions(await res.json());
    setSelected(new Set());
  }

  useEffect(() => {
    if (ready) load();
  }, [ready]);

  // A failed approve/reject must not look identical to a successful one —
  // this used to fire-and-forget the POST and reload regardless, so a
  // rejected request (expired session, server error) silently left the
  // submission exactly where it was with no indication anything went wrong.
  async function review(id: string, action: "APPROVE" | "REJECT") {
    setBusyId(id);
    setError(null);
    const result = await adminMutate(`/admin/submissions/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ action, reviewNotes: notes[id] || undefined }),
    });
    if (!result.ok) setError(result.error ?? "Couldn't submit review.");
    await load();
    setBusyId(null);
  }

  async function bulkReview(action: "APPROVE" | "REJECT") {
    if (selected.size === 0) return;
    setBulkBusy(true);
    setError(null);
    const result = await adminMutate("/admin/submissions/bulk-review", {
      method: "POST",
      body: JSON.stringify({ ids: Array.from(selected), action }),
    });
    if (!result.ok) setError(result.error ?? "Couldn't submit bulk review.");
    await load();
    setBulkBusy(false);
  }

  async function toggleBlock(contributorId: string, blocked: boolean) {
    setError(null);
    const result = await adminMutate(`/admin/contributors/${contributorId}`, {
      method: "PATCH",
      body: JSON.stringify({ blocked }),
    });
    if (!result.ok) {
      setError(result.error ?? "Couldn't update contributor.");
      return;
    }
    setSubmissions((prev) =>
      prev.map((s) => (s.contributor?.id === contributorId ? { ...s, contributor: { ...s.contributor!, blocked } } : s))
    );
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!ready) return null;

  const data = active?.submittedData ?? {};
  const origin = data.latitude != null && data.longitude != null ? { latitude: data.latitude, longitude: data.longitude } : undefined;
  const activeAmenities = AMENITY_LABELS.filter(([key]) => data[key]);

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-extrabold">Submissions</h1>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="font-body text-sm text-ink-muted">{selected.size} selected</span>
            <Button variant="secondary" disabled={bulkBusy} onClick={() => bulkReview("REJECT")}>
              Reject selected
            </Button>
            <Button disabled={bulkBusy} onClick={() => bulkReview("APPROVE")}>
              Approve selected
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-brand/30 bg-brand/10 px-4 py-2.5 font-body text-sm text-brand">
          {error}
        </div>
      )}

      <div className="mb-5 flex gap-2">
        {TABS.map((t) => {
          const count = t.key === "ALL" ? submissions.length : submissions.filter((s) => s.type === t.key).length;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-xl px-4 py-2 font-body text-sm font-bold ${
                tab === t.key ? "bg-brand text-brand-ink" : "bg-chip text-ink-dim"
              }`}
            >
              {t.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Gmail-style split view: the list is a scannable queue, the detail
          pane is where the actual review (and its approve/reject decision)
          happens — a flat stack of full-detail cards made it slow to scan
          the queue and easy to lose your place after reviewing one. */}
      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        <div className="flex flex-col gap-2 md:sticky md:top-4 md:max-h-[calc(100vh-13rem)] md:w-[340px] md:flex-none md:overflow-y-auto md:pr-1">
          {visibleSubmissions.map((submission) => {
            const rowData = submission.submittedData;
            const isActive = active?._id === submission._id;
            return (
              <button
                key={submission._id}
                onClick={() => setActiveId(submission._id)}
                className={`flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 text-left transition-colors ${
                  isActive ? "border-brand bg-chip" : "border-border bg-panel hover:border-brand/40"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(submission._id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleSelected(submission._id);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 h-4 w-4 flex-none accent-brand"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-body text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    {submission.type}
                  </div>
                  <div className="truncate font-display text-base font-bold">
                    {rowData.canonicalName ??
                      (submission.type === "REPORT" ? REPORT_CATEGORY_LABELS[rowData.category ?? ""] ?? "Report" : "(update / correction)")}
                  </div>
                  <div className="truncate font-body text-xs text-ink-muted">{rowData.locality}</div>
                </div>
              </button>
            );
          })}
          {visibleSubmissions.length === 0 && (
            <p className="font-body text-sm text-ink-muted">
              {submissions.length === 0 ? "Nothing pending review." : "No submissions of this type right now."}
            </p>
          )}
        </div>

        {active && (
          <Card padding="md" className="flex flex-1 flex-col gap-5 md:max-h-[calc(100vh-13rem)] md:overflow-y-auto">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
              <div>
                <div className="font-body text-xs font-semibold uppercase tracking-wide text-ink-muted">{active.type}</div>
                <h2 className="font-display text-2xl font-extrabold">
                  {data.canonicalName ??
                    (active.type === "REPORT" ? REPORT_CATEGORY_LABELS[data.category ?? ""] ?? "Report" : "Update / correction")}
                </h2>
                <span className="font-body text-xs text-ink-muted">
                  Submitted {new Date(active.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={busyId === active._id} onClick={() => review(active._id, "REJECT")}>
                  {active.type === "REPORT" ? "Dismiss" : "Reject"}
                </Button>
                <Button disabled={busyId === active._id} onClick={() => review(active._id, "APPROVE")}>
                  {active.type === "REPORT" ? "Mark resolved" : "Approve"}
                </Button>
              </div>
            </div>

            {/* A pandal can pass every other check (published, verified,
                right festival year) and still never show up on its city's
                map because its cityId was silently wrong from the start —
                that has no visible symptom anywhere else in this review
                card, since the address/coordinates themselves are usually
                perfectly correct for wherever the contributor actually was.
                This is the one place that surfaces it before approval. */}
            {active.cityDistanceMeters != null && active.cityDistanceMeters > CITY_DISTANCE_WARNING_METERS && (
              <div className="flex items-start gap-2.5 rounded-xl border border-brand/40 bg-brand/10 px-3.5 py-2.5">
                <span className="material-symbols-rounded flex-none text-lg text-brand">warning</span>
                <span className="font-body text-sm text-brand">
                  This location is ~{Math.round(active.cityDistanceMeters / 1000)}km from the target city's center —
                  double-check it's actually in the right city before approving.
                </span>
              </div>
            )}

            {active.contributor && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-card px-3.5 py-2.5">
                <span className="material-symbols-rounded text-base text-ink-muted">person</span>
                <span className="font-body text-sm text-ink-dim">{active.contributor.identifier}</span>
                {active.submitterIp && (
                  <span className="font-body text-xs text-ink-muted">· IP {active.submitterIp}</span>
                )}
                <button
                  onClick={() => toggleBlock(active.contributor!.id, !active.contributor!.blocked)}
                  className={`ml-auto rounded-pill px-2.5 py-1 font-body text-[11px] font-bold ${
                    active.contributor.blocked
                      ? "bg-accent text-accent-ink"
                      : "border border-border text-ink-muted hover:border-brand hover:text-brand"
                  }`}
                >
                  {active.contributor.blocked ? "Unblock" : "Block"}
                </button>
              </div>
            )}

            {active.possiblePandalId && (
              <Link
                href={`/pandals/${active.possiblePandalId}`}
                target="_blank"
                className="font-body text-xs font-bold text-brand"
              >
                {active.type === "REPORT" ? "View reported pandal →" : "View possibly-related pandal →"}
              </Link>
            )}

            {active.type === "REPORT" && (
              <>
                <DetailRow label="Category" value={REPORT_CATEGORY_LABELS[data.category ?? ""] ?? data.category} />
                <DetailRow label="Details" value={data.description} />
                {data.photos && data.photos.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="font-body text-xs font-semibold uppercase tracking-wide text-ink-muted">Photos</span>
                    <div className="flex flex-wrap gap-2">
                      {data.photos.map((photo) => (
                        <a key={photo.url} href={photo.url} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.url}
                            alt=""
                            className="h-24 w-24 flex-none rounded-xl object-cover transition-opacity hover:opacity-80"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {data.note && (
              <div className="rounded-xl bg-card px-3.5 py-3">
                <span className="font-body text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Requested change
                </span>
                <p className="mt-1 font-body text-sm text-ink">{data.note}</p>
              </div>
            )}

            {/* Everything AddPandalFlow could have collected for a NEW_PANDAL
                submission — previously only name/locality/email/IP showed
                here, so an admin had no way to see organiser, theme,
                photos, categories, amenities, visit type, or the puja
                schedule without going around the review flow entirely. */}
            {active.type === "NEW_PANDAL" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <DetailRow label="Organiser / committee" value={data.organizerName} />
                  <DetailRow label="Festival year" value={data.year} />
                  <DetailRow label="Address" value={data.address} />
                  <DetailRow label="Locality" value={data.locality} />
                  <DetailRow label="Landmark" value={data.landmark} />
                  <DetailRow label="Public contact" value={data.publicContact} />
                  <DetailRow label="Theme" value={data.theme} />
                  <DetailRow label="Visit type" value={data.visitType ? VISIT_TYPE_LABELS[data.visitType] ?? data.visitType : undefined} />
                </div>

                <DetailRow label="Theme details" value={data.description} />

                {data.categories && data.categories.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="font-body text-xs font-semibold uppercase tracking-wide text-ink-muted">Categories</span>
                    <div className="flex flex-wrap gap-1.5">
                      {data.categories.map((c) => (
                        <span key={c} className="rounded-pill bg-chip px-2.5 py-1 font-body text-xs font-semibold text-ink-dim">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {activeAmenities.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="font-body text-xs font-semibold uppercase tracking-wide text-ink-muted">Amenities</span>
                    <div className="flex flex-wrap gap-1.5">
                      {activeAmenities.map(([, label]) => (
                        <span key={label} className="flex items-center gap-1 rounded-pill bg-chip px-2.5 py-1 font-body text-xs font-semibold text-ink-dim">
                          <span className="material-symbols-rounded text-sm text-brand">check</span>
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {data.schedule && data.schedule.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="pb-1 font-body text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Puja schedule
                    </span>
                    {data.schedule.map((entry, index) => (
                      <div key={index} className="flex items-center gap-3 py-1">
                        <span className="w-16 flex-none font-body text-sm font-bold text-accent">{entry.time}</span>
                        <span className="h-1.5 w-1.5 flex-none rounded-full bg-brand" />
                        <span className="font-body text-sm">{entry.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {data.photos && data.photos.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="font-body text-xs font-semibold uppercase tracking-wide text-ink-muted">Photos</span>
                    <div className="flex flex-wrap gap-2">
                      {data.photos.map((photo) => (
                        <a key={photo.url} href={photo.url} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.url}
                            alt=""
                            className="h-24 w-24 flex-none rounded-xl object-cover transition-opacity hover:opacity-80"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {active.duplicateCandidates.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <span className="font-body text-xs font-semibold uppercase tracking-wide text-accent">
                  Possible duplicates
                </span>
                <CandidatesMap mapTilesUrl={MAP_TILES_URL} origin={origin} candidates={active.duplicateCandidates} />
                {active.duplicateCandidates.map((candidate, index) => (
                  <div key={candidate.pandalId} className="font-body text-sm text-ink-dim">
                    <span className="font-semibold text-ink">
                      {index + 1}. {candidate.canonicalName ?? candidate.pandalId}
                    </span>{" "}
                    — {Math.round(candidate.score * 100)}% match · {candidate.distanceMeters}m away ·{" "}
                    {candidate.reasons.join(", ")}
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-border pt-4">
              <Textarea
                placeholder="Review notes (optional)"
                value={notes[active._id] ?? ""}
                onChange={(e) => setNotes((prev) => ({ ...prev, [active._id]: e.target.value }))}
                className="min-h-16 w-full text-sm"
              />
            </div>
          </Card>
        )}
      </div>
    </AdminShell>
  );
}
