"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { useAdminGuard } from "@/lib/use-admin-guard";
import { adminFetch } from "@/lib/admin-api";
import { Button } from "@durgapandals/ui";

interface City {
  _id: string;
  name: string;
}

interface DuplicateCandidate {
  pandalId: string;
  score: number;
  reasons: string[];
  distanceMeters: number;
}

const EMPTY_FORM = {
  cityId: "",
  canonicalName: "",
  organizerName: "",
  latitude: "",
  longitude: "",
  address: "",
  locality: "",
  landmark: "",
  publicContact: "",
};

// Admin creating a pandal directly still runs the same duplicate scoring a
// public submission does (spec §17.4, §23) — it just isn't blocking here,
// since the admin is the one making the final call.
export default function NewPandalPage() {
  const ready = useAdminGuard();
  const router = useRouter();
  const [cities, setCities] = useState<City[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    adminFetch("/admin/cities")
      .then((res) => (res.ok ? res.json() : []))
      .then(setCities);
  }, [ready]);

  function buildPayload() {
    return {
      cityId: form.cityId,
      canonicalName: form.canonicalName,
      organizerName: form.organizerName || undefined,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      address: form.address,
      locality: form.locality,
      landmark: form.landmark || undefined,
      publicContact: form.publicContact || undefined,
    };
  }

  async function handleCheckDuplicates() {
    setChecking(true);
    try {
      const res = await adminFetch("/admin/pandals/duplicate-check", {
        method: "POST",
        body: JSON.stringify(buildPayload()),
      });
      setDuplicates(res.ok ? await res.json() : []);
    } finally {
      setChecking(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await adminFetch("/admin/pandals", {
        method: "POST",
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create pandal");
      }
      const pandal = await res.json();
      router.push(`/pandals/${pandal._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return null;

  return (
    <AdminShell>
      <h1 className="mb-6 font-display text-3xl font-extrabold">Add Pandal</h1>

      <form onSubmit={handleSubmit} className="max-w-2xl rounded-card border border-border bg-panel p-6">
        <div className="grid grid-cols-2 gap-3">
          <select
            required
            value={form.cityId}
            onChange={(e) => setForm({ ...form, cityId: e.target.value })}
            className="col-span-2 h-11 rounded-lg border border-border bg-card px-3 font-body"
          >
            <option value="">Select city…</option>
            {cities.map((city) => (
              <option key={city._id} value={city._id}>
                {city.name}
              </option>
            ))}
          </select>
          <input
            required
            placeholder="Pandal name"
            value={form.canonicalName}
            onChange={(e) => setForm({ ...form, canonicalName: e.target.value })}
            className="col-span-2 h-11 rounded-lg border border-border bg-card px-3 font-body"
          />
          <input
            placeholder="Organizer / committee"
            value={form.organizerName}
            onChange={(e) => setForm({ ...form, organizerName: e.target.value })}
            className="col-span-2 h-11 rounded-lg border border-border bg-card px-3 font-body"
          />
          <input
            required
            type="number"
            step="any"
            placeholder="Latitude"
            value={form.latitude}
            onChange={(e) => setForm({ ...form, latitude: e.target.value })}
            className="h-11 rounded-lg border border-border bg-card px-3 font-body"
          />
          <input
            required
            type="number"
            step="any"
            placeholder="Longitude"
            value={form.longitude}
            onChange={(e) => setForm({ ...form, longitude: e.target.value })}
            className="h-11 rounded-lg border border-border bg-card px-3 font-body"
          />
          <input
            required
            placeholder="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="col-span-2 h-11 rounded-lg border border-border bg-card px-3 font-body"
          />
          <input
            required
            placeholder="Locality / area"
            value={form.locality}
            onChange={(e) => setForm({ ...form, locality: e.target.value })}
            className="h-11 rounded-lg border border-border bg-card px-3 font-body"
          />
          <input
            placeholder="Landmark"
            value={form.landmark}
            onChange={(e) => setForm({ ...form, landmark: e.target.value })}
            className="h-11 rounded-lg border border-border bg-card px-3 font-body"
          />
          <input
            placeholder="Public contact"
            value={form.publicContact}
            onChange={(e) => setForm({ ...form, publicContact: e.target.value })}
            className="col-span-2 h-11 rounded-lg border border-border bg-card px-3 font-body"
          />
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleCheckDuplicates}
            disabled={checking || !form.cityId || !form.canonicalName || !form.latitude || !form.longitude}
          >
            {checking ? "Checking…" : "Check for duplicates"}
          </Button>
        </div>

        {duplicates && (
          <div className="mt-4 flex flex-col gap-2">
            {duplicates.length === 0 ? (
              <p className="font-body text-sm text-ink-muted">No likely duplicates found nearby.</p>
            ) : (
              duplicates.map((candidate) => (
                <div
                  key={candidate.pandalId}
                  className="rounded-xl border border-accent/30 bg-card px-4 py-3 font-body text-sm"
                >
                  <span className="font-semibold text-accent">
                    {Math.round(candidate.score * 100)}% match
                  </span>{" "}
                  · {candidate.distanceMeters}m away · {candidate.reasons.join(", ")}
                </div>
              ))
            )}
          </div>
        )}

        {error && <p className="mt-3 font-body text-sm text-brand">{error}</p>}

        <Button type="submit" disabled={saving} className="mt-6 w-full">
          {saving ? "Creating…" : "Create & publish pandal"}
        </Button>
      </form>
    </AdminShell>
  );
}
