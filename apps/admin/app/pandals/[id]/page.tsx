"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { useAdminGuard } from "@/lib/use-admin-guard";
import { adminFetch } from "@/lib/admin-api";
import { Button } from "@durgapandals/ui";

interface Pandal {
  _id: string;
  canonicalName: string;
  organizerName?: string;
  address: string;
  locality: string;
  landmark?: string;
  publicContact?: string;
  publicationStatus: string;
  verificationStatus: string;
}

interface PandalYear {
  _id: string;
  year: number;
  theme?: string;
  description?: string;
  featured: boolean;
  publicationStatus: string;
}

const EMPTY_YEAR_FORM = { year: String(new Date().getFullYear()), theme: "", description: "" };

export default function PandalDetailPage() {
  const ready = useAdminGuard();
  const params = useParams<{ id: string }>();
  const [pandal, setPandal] = useState<Pandal | null>(null);
  const [years, setYears] = useState<PandalYear[]>([]);
  const [yearForm, setYearForm] = useState(EMPTY_YEAR_FORM);
  const [savingYear, setSavingYear] = useState(false);

  async function load() {
    const res = await adminFetch(`/admin/pandals/${params.id}`);
    if (!res.ok) return;
    const data = await res.json();
    setPandal(data.pandal);
    setYears(data.years);
  }

  useEffect(() => {
    if (ready) load();
  }, [ready, params.id]);

  async function updateField(field: keyof Pandal, value: string) {
    if (!pandal) return;
    setPandal({ ...pandal, [field]: value });
  }

  async function saveCanonical() {
    if (!pandal) return;
    await adminFetch(`/admin/pandals/${pandal._id}`, {
      method: "PATCH",
      body: JSON.stringify({
        canonicalName: pandal.canonicalName,
        organizerName: pandal.organizerName,
        address: pandal.address,
        locality: pandal.locality,
        landmark: pandal.landmark,
        publicContact: pandal.publicContact,
      }),
    });
  }

  async function setStatus(field: "publicationStatus" | "verificationStatus", value: string) {
    if (!pandal) return;
    await adminFetch(`/admin/pandals/${pandal._id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ [field]: value }),
    });
    await load();
  }

  async function toggleFeatured(yearId: string, featured: boolean) {
    await adminFetch(`/admin/pandal-years/${yearId}`, {
      method: "PATCH",
      body: JSON.stringify({ featured: !featured }),
    });
    await load();
  }

  async function addYear(event: React.FormEvent) {
    event.preventDefault();
    if (!pandal) return;
    setSavingYear(true);
    try {
      await adminFetch("/admin/pandal-years", {
        method: "POST",
        body: JSON.stringify({
          pandalId: pandal._id,
          year: Number(yearForm.year),
          theme: yearForm.theme || undefined,
          description: yearForm.description || undefined,
        }),
      });
      setYearForm(EMPTY_YEAR_FORM);
      await load();
    } finally {
      setSavingYear(false);
    }
  }

  if (!ready || !pandal) return null;

  return (
    <AdminShell>
      <h1 className="mb-6 font-display text-3xl font-extrabold">{pandal.canonicalName}</h1>

      <div className="mb-6 flex gap-3">
        <select
          value={pandal.publicationStatus}
          onChange={(e) => setStatus("publicationStatus", e.target.value)}
          className="h-10 rounded-lg border border-border bg-card px-3 font-body text-sm"
        >
          {["DRAFT", "PENDING", "PUBLISHED", "ARCHIVED", "REJECTED"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={pandal.verificationStatus}
          onChange={(e) => setStatus("verificationStatus", e.target.value)}
          className="h-10 rounded-lg border border-border bg-card px-3 font-body text-sm"
        >
          {["UNVERIFIED", "VERIFIED", "DUPLICATE"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-8 max-w-2xl rounded-card border border-border bg-panel p-6">
        <h2 className="mb-4 font-body text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Canonical details
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <input
            value={pandal.canonicalName}
            onChange={(e) => updateField("canonicalName", e.target.value)}
            className="col-span-2 h-11 rounded-lg border border-border bg-card px-3 font-body"
          />
          <input
            placeholder="Organizer"
            value={pandal.organizerName ?? ""}
            onChange={(e) => updateField("organizerName", e.target.value)}
            className="col-span-2 h-11 rounded-lg border border-border bg-card px-3 font-body"
          />
          <input
            placeholder="Address"
            value={pandal.address}
            onChange={(e) => updateField("address", e.target.value)}
            className="col-span-2 h-11 rounded-lg border border-border bg-card px-3 font-body"
          />
          <input
            placeholder="Locality"
            value={pandal.locality}
            onChange={(e) => updateField("locality", e.target.value)}
            className="h-11 rounded-lg border border-border bg-card px-3 font-body"
          />
          <input
            placeholder="Landmark"
            value={pandal.landmark ?? ""}
            onChange={(e) => updateField("landmark", e.target.value)}
            className="h-11 rounded-lg border border-border bg-card px-3 font-body"
          />
          <input
            placeholder="Public contact"
            value={pandal.publicContact ?? ""}
            onChange={(e) => updateField("publicContact", e.target.value)}
            className="col-span-2 h-11 rounded-lg border border-border bg-card px-3 font-body"
          />
        </div>
        <Button className="mt-4" onClick={saveCanonical}>
          Save changes
        </Button>
      </div>

      <div className="max-w-2xl rounded-card border border-border bg-panel p-6">
        <h2 className="mb-4 font-body text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Festival years
        </h2>
        <div className="mb-4 flex flex-col gap-2">
          {years.map((year) => (
            <div key={year._id} className="flex items-center justify-between rounded-xl bg-card px-4 py-3">
              <div>
                <div className="font-body font-semibold">
                  {year.year} {year.theme && `· ${year.theme}`}
                </div>
                <div className="font-body text-xs text-ink-muted">{year.publicationStatus}</div>
              </div>
              <button
                onClick={() => toggleFeatured(year._id, year.featured)}
                className={`rounded-lg px-3 py-1.5 font-body text-xs font-bold ${
                  year.featured ? "bg-accent text-accent-ink" : "border border-border text-ink-muted"
                }`}
              >
                {year.featured ? "Featured" : "Feature"}
              </button>
            </div>
          ))}
          {years.length === 0 && <p className="font-body text-sm text-ink-muted">No years added yet.</p>}
        </div>

        <form onSubmit={addYear} className="flex flex-col gap-2 border-t border-border pt-4">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Year"
              value={yearForm.year}
              onChange={(e) => setYearForm({ ...yearForm, year: e.target.value })}
              className="h-10 rounded-lg border border-border bg-card px-3 font-body text-sm"
            />
            <input
              placeholder="Theme"
              value={yearForm.theme}
              onChange={(e) => setYearForm({ ...yearForm, theme: e.target.value })}
              className="h-10 rounded-lg border border-border bg-card px-3 font-body text-sm"
            />
          </div>
          <textarea
            placeholder="Description"
            value={yearForm.description}
            onChange={(e) => setYearForm({ ...yearForm, description: e.target.value })}
            className="min-h-20 rounded-lg border border-border bg-card px-3 py-2 font-body text-sm"
          />
          <Button type="submit" variant="secondary" disabled={savingYear}>
            {savingYear ? "Adding…" : "Add year"}
          </Button>
        </form>
      </div>
    </AdminShell>
  );
}
