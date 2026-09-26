"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { useAdminGuard } from "@/lib/use-admin-guard";
import { adminFetch } from "@/lib/admin-api";
import { Button } from "@durgapandals/ui";

interface Submission {
  _id: string;
  type: string;
  status: string;
  submittedData: Record<string, unknown>;
  duplicateCandidates: { pandalId: string; score: number; reasons: string[]; distanceMeters: number }[];
  createdAt: string;
}

export default function SubmissionsPage() {
  const ready = useAdminGuard();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const res = await adminFetch("/admin/submissions?status=PENDING");
    if (res.ok) setSubmissions(await res.json());
  }

  useEffect(() => {
    if (ready) load();
  }, [ready]);

  async function review(id: string, action: "APPROVE" | "REJECT") {
    setBusyId(id);
    try {
      await adminFetch(`/admin/submissions/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (!ready) return null;

  return (
    <AdminShell>
      <h1 className="mb-6 font-display text-3xl font-extrabold">Submissions</h1>

      <div className="flex flex-col gap-4">
        {submissions.map((submission) => {
          const data = submission.submittedData as { canonicalName?: string; locality?: string };
          return (
            <div key={submission._id} className="rounded-card border border-border bg-panel p-5">
              <div className="flex items-start justify-between gap-4">
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

              {submission.duplicateCandidates.length > 0 && (
                <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                  <span className="font-body text-xs font-semibold uppercase tracking-wide text-accent">
                    Possible duplicates
                  </span>
                  {submission.duplicateCandidates.map((candidate) => (
                    <div key={candidate.pandalId} className="font-body text-sm text-ink-dim">
                      {Math.round(candidate.score * 100)}% match · {candidate.distanceMeters}m away ·{" "}
                      {candidate.reasons.join(", ")}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {submissions.length === 0 && <p className="font-body text-ink-muted">Nothing pending review.</p>}
      </div>
    </AdminShell>
  );
}
