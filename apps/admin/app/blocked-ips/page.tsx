"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { useAdminGuard } from "@/lib/use-admin-guard";
import { adminFetch, adminMutate } from "@/lib/admin-api";
import { Button, Card, ConfirmDialog, Input, Select, Textarea } from "@durgapandals/ui";

type BlockReason = "SPAM_LIKES" | "SPAM_SUBMISSIONS" | "ABUSE" | "SCRAPING" | "OTHER";

interface BlockedIp {
  _id: string;
  ip: string;
  reason: BlockReason;
  notes?: string;
  blockedBy: string;
  expiresAt?: string;
  createdAt: string;
}

const REASON_LABELS: Record<BlockReason, string> = {
  SPAM_LIKES: "Spam likes",
  SPAM_SUBMISSIONS: "Spam submissions",
  ABUSE: "Abuse",
  SCRAPING: "Scraping",
  OTHER: "Other",
};

const EMPTY_FORM = {
  ip: "",
  reason: "SPAM_LIKES" as BlockReason,
  notes: "",
  expiresAt: "",
};

// Enforcement itself lives server-side (apps/api/src/security/blocked-ip-hook.ts,
// a global onRequest hook) — this page is only the admin CRUD for the list
// it reads from.
export default function BlockedIpsPage() {
  const ready = useAdminGuard();
  const [blockedIps, setBlockedIps] = useState<BlockedIp[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [unblockTarget, setUnblockTarget] = useState<BlockedIp | null>(null);

  async function loadBlockedIps() {
    const res = await adminFetch("/admin/blocked-ips");
    if (res.ok) setBlockedIps(await res.json());
  }

  useEffect(() => {
    if (ready) loadBlockedIps();
  }, [ready]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await adminFetch("/admin/blocked-ips", {
        method: "POST",
        body: JSON.stringify({
          ip: form.ip.trim(),
          reason: form.reason,
          notes: form.notes.trim() || undefined,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to block IP");
      }
      setForm(EMPTY_FORM);
      await loadBlockedIps();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleUnblock() {
    if (!unblockTarget) return;
    const result = await adminMutate(`/admin/blocked-ips/${unblockTarget._id}`, { method: "DELETE" });
    if (!result.ok) setError(result.error ?? "Couldn't unblock this IP.");
    setUnblockTarget(null);
    await loadBlockedIps();
  }

  if (!ready) return null;

  return (
    <AdminShell>
      <h1 className="mb-6 font-display text-3xl font-extrabold">Blocked IPs</h1>
      <p className="mb-4 -mt-2 font-body text-sm text-ink-muted">
        Blocked IPs are rejected on every request to the site (likes, submissions, browsing) except the admin
        panel itself, so you can't accidentally lock yourself out. Leave expiry blank for a permanent block.
      </p>

      {error && (
        <div className="mb-6 rounded-xl border border-brand/30 bg-brand/10 px-4 py-2.5 font-body text-sm text-brand">
          {error}
        </div>
      )}

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        {blockedIps.map((entry) => {
          const expired = entry.expiresAt ? new Date(entry.expiresAt).getTime() < Date.now() : false;
          return (
            <Card key={entry._id} padding="sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg font-bold">{entry.ip}</span>
                    <span className="rounded-pill bg-chip px-2 py-0.5 font-body text-[11px] font-bold text-ink-dim">
                      {REASON_LABELS[entry.reason]}
                    </span>
                    {expired && (
                      <span className="rounded-pill bg-accent/20 px-2 py-0.5 font-body text-[11px] font-bold text-accent">
                        Expired
                      </span>
                    )}
                  </div>
                  {entry.notes && <p className="mt-1 font-body text-sm text-ink-dim">{entry.notes}</p>}
                  <div className="mt-1 font-body text-xs text-ink-muted">
                    Blocked by {entry.blockedBy} on {new Date(entry.createdAt).toLocaleDateString()}
                    {entry.expiresAt && !expired
                      ? ` · expires ${new Date(entry.expiresAt).toLocaleDateString()}`
                      : ""}
                  </div>
                </div>
                <Button variant="secondary" className="flex-none" onClick={() => setUnblockTarget(entry)}>
                  Unblock
                </Button>
              </div>
            </Card>
          );
        })}
        {blockedIps.length === 0 && <p className="font-body text-ink-muted">No blocked IPs yet.</p>}
      </div>

      <Card padding="lg" className="max-w-xl">
        <form onSubmit={handleSubmit}>
          <h2 className="mb-4 font-body text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Block an IP
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Input
              required
              placeholder="IP address (e.g. 103.21.244.12)"
              value={form.ip}
              onChange={(e) => setForm({ ...form, ip: e.target.value })}
              className="col-span-2 h-12"
            />
            <Select
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value as BlockReason })}
              className="h-12"
            >
              {Object.entries(REASON_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Input
              type="date"
              placeholder="Expires (optional)"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              className="h-12"
            />
            <Textarea
              placeholder="Notes (optional) — what they did, evidence, etc."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="col-span-2"
            />
          </div>
          <Button type="submit" disabled={saving} className="mt-4">
            {saving ? "Blocking…" : "Block IP"}
          </Button>
        </form>
      </Card>

      <ConfirmDialog
        open={unblockTarget !== null}
        onClose={() => setUnblockTarget(null)}
        onConfirm={handleUnblock}
        title="Unblock this IP?"
        description={unblockTarget ? `"${unblockTarget.ip}" will be able to reach the site again immediately.` : ""}
        confirmLabel="Unblock"
        danger={false}
      />
    </AdminShell>
  );
}
