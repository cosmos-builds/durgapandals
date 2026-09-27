"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { useAdminGuard } from "@/lib/use-admin-guard";
import { adminFetch } from "@/lib/admin-api";
import { Button, Card, Textarea } from "@durgapandals/ui";
import { CandidatesMap, type Candidate } from "@/components/candidates-map";

const MAP_TILES_URL = process.env.NEXT_PUBLIC_MAP_TILES_URL ?? "";

interface Submission {
  _id: string;
  type: string;
  status: string;
  submittedData: Record<string, unknown>;
  duplicateCandidates: (Candidate & { reasons: string[]; distanceMeters: number; canonicalName?: string })[];
  createdAt: string;
}

export default function SubmissionsPage() {
  const ready = useAdminGuard();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  async function load() {
    const res = await adminFetch("/admin/submissions?status=PENDING");
    if (res.ok) setSubmissions(await res.json());
    setSelected(new Set());
  }

  useEffect(() => {
    if (ready) load();
  }, [ready]);

  async function review(id: string, action: "APPROVE" | "REJECT") {
    setBusyId(id);
    try {
      await adminFetch(`/admin/submissions/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ action, reviewNotes: notes[id] || undefined }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function bulkReview(action: "APPROVE" | "REJECT") {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      await adminFetch("/admin/submissions/bulk-review", {
        method: "POST",
        body: JSON.stringify({ ids: Array.from(selected), action }),
      });
      await load();
    } finally {
      setBulkBusy(false);
    }
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

      <div className="flex flex-col gap-4">
        {submissions.map((submission) => {
          const data = submission.submittedData as {
            canonicalName?: string;
            locality?: string;
            latitude?: number;
            longitude?: number;
          };
          const origin =
            data.latitude != null && data.longitude != null
              ? { latitude: data.latitude, longitude: data.longitude }
              : undefined;

          return (
            <Card key={submission._id} padding="sm">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(submission._id)}
                  onChange={() => toggleSelected(submission._id)}
                  className="mt-1.5 h-4 w-4 flex-none accent-brand"
                />
                <div className="flex flex-1 items-start justify-between gap-4">
                  <div>
                    <div className="font-body text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      {submission.type}
                    </div>
                    <div className="font-display text-lg font-bold">
                      {data.canonicalName ?? "(update / correction)"}
                    </div>
                    <div className="font-body text-sm text-ink-muted">{data.locality}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      disabled={busyId === submission._id}
                      onClick={() => review(submission._id, "REJECT")}
                    >
                      Reject
                    </Button>
                    <Button disabled={busyId === submission._id} onClick={() => review(submission._id, "APPROVE")}>
                      Approve
                    </Button>
                  </div>
                </div>
              </div>

              {submission.duplicateCandidates.length > 0 && (
                <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
                  <span className="font-body text-xs font-semibold uppercase tracking-wide text-accent">
                    Possible duplicates
                  </span>
                  <CandidatesMap mapTilesUrl={MAP_TILES_URL} origin={origin} candidates={submission.duplicateCandidates} />
                  {submission.duplicateCandidates.map((candidate, index) => (
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

              <div className="mt-4 border-t border-border pt-4">
                <Textarea
                  placeholder="Review notes (optional)"
                  value={notes[submission._id] ?? ""}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [submission._id]: e.target.value }))}
                  className="min-h-16 w-full text-sm"
                />
              </div>
            </Card>
          );
        })}
        {submissions.length === 0 && <p className="font-body text-ink-muted">Nothing pending review.</p>}
      </div>
    </AdminShell>
  );
}
