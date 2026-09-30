"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { useAdminGuard } from "@/lib/use-admin-guard";
import { adminFetch, adminMutate } from "@/lib/admin-api";
import { Button, Card, Input, Select } from "@durgapandals/ui";

interface City {
  _id: string;
  name: string;
  slug: string;
  state: string;
  stateCode: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  defaultMapZoom: number;
  status: "ACTIVE" | "COMING_SOON" | "DISABLED";
  activeFestivalYear: number;
  tier: "MAJOR" | "MINOR";
}

const EMPTY_FORM = {
  name: "",
  state: "",
  stateCode: "",
  countryCode: "IN",
  latitude: "",
  longitude: "",
  defaultMapZoom: "10",
  status: "ACTIVE" as City["status"],
  activeFestivalYear: String(new Date().getFullYear()),
  tier: "MINOR" as City["tier"],
};

// This is the ONLY place cities get created (spec §5.1) — nothing about
// Bhopal/Indore is hardcoded in web/admin/api; a third city is just a row
// added here.
export default function CitiesPage() {
  const ready = useAdminGuard();
  const [cities, setCities] = useState<City[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadCities() {
    const res = await adminFetch("/admin/cities");
    if (res.ok) setCities(await res.json());
  }

  useEffect(() => {
    if (ready) loadCities();
  }, [ready]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await adminFetch("/admin/cities", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
          defaultMapZoom: Number(form.defaultMapZoom),
          activeFestivalYear: Number(form.activeFestivalYear),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create city");
      }
      setForm(EMPTY_FORM);
      await loadCities();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: City["status"]) {
    setError(null);
    const result = await adminMutate(`/admin/cities/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    if (!result.ok) setError(result.error ?? "Couldn't update status.");
    await loadCities();
  }

  async function updateTier(id: string, tier: City["tier"]) {
    setError(null);
    const result = await adminMutate(`/admin/cities/${id}`, { method: "PATCH", body: JSON.stringify({ tier }) });
    if (!result.ok) setError(result.error ?? "Couldn't update tier.");
    await loadCities();
  }

  if (!ready) return null;

  return (
    <AdminShell>
      <h1 className="mb-6 font-display text-3xl font-extrabold">Cities</h1>
      <p className="mb-4 -mt-2 font-body text-sm text-ink-muted">
        Any city can be enabled — not just a fixed pair. MAJOR cities are pinned in the app's city picker; MINOR
        cities go live but only surface there once someone searches for them.
      </p>

      {error && (
        <div className="mb-6 rounded-xl border border-brand/30 bg-brand/10 px-4 py-2.5 font-body text-sm text-brand">
          {error}
        </div>
      )}

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        {cities.map((city) => (
          <Card key={city._id} padding="sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg font-bold">{city.name}</span>
                  <span
                    className={`rounded-pill px-2 py-0.5 font-body text-[11px] font-bold ${
                      city.tier === "MAJOR" ? "bg-accent text-accent-ink" : "bg-chip text-ink-dim"
                    }`}
                  >
                    {city.tier}
                  </span>
                </div>
                <div className="font-body text-sm text-ink-muted">
                  {city.state} · /{city.slug} · festival year {city.activeFestivalYear}
                </div>
              </div>
              <div className="flex flex-none flex-col gap-2">
                <Select
                  value={city.status}
                  onChange={(e) => updateStatus(city._id, e.target.value as City["status"])}
                  className="h-12 w-40 text-sm"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="COMING_SOON">Coming soon</option>
                  <option value="DISABLED">Disabled</option>
                </Select>
                <Select
                  value={city.tier}
                  onChange={(e) => updateTier(city._id, e.target.value as City["tier"])}
                  className="h-12 w-40 text-sm"
                >
                  <option value="MAJOR">Major</option>
                  <option value="MINOR">Minor</option>
                </Select>
              </div>
            </div>
          </Card>
        ))}
        {cities.length === 0 && <p className="font-body text-ink-muted">No cities yet — add one below.</p>}
      </div>

      <Card padding="lg" className="max-w-xl">
        <form onSubmit={handleSubmit}>
          <h2 className="mb-4 font-body text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Add a city
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Input
              required
              placeholder="Name (e.g. Jabalpur)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="col-span-2 h-12"
            />
            <Input
              required
              placeholder="State"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              className="h-12"
            />
            <Input
              required
              placeholder="State code (e.g. MP)"
              value={form.stateCode}
              onChange={(e) => setForm({ ...form, stateCode: e.target.value })}
              className="h-12"
            />
            <Input
              required
              type="number"
              step="any"
              placeholder="Latitude"
              value={form.latitude}
              onChange={(e) => setForm({ ...form, latitude: e.target.value })}
              className="h-12"
            />
            <Input
              required
              type="number"
              step="any"
              placeholder="Longitude"
              value={form.longitude}
              onChange={(e) => setForm({ ...form, longitude: e.target.value })}
              className="h-12"
            />
            <Input
              type="number"
              placeholder="Map zoom"
              value={form.defaultMapZoom}
              onChange={(e) => setForm({ ...form, defaultMapZoom: e.target.value })}
              className="h-12"
            />
            <Input
              type="number"
              placeholder="Active festival year"
              value={form.activeFestivalYear}
              onChange={(e) => setForm({ ...form, activeFestivalYear: e.target.value })}
              className="h-12"
            />
            <Select
              value={form.tier}
              onChange={(e) => setForm({ ...form, tier: e.target.value as City["tier"] })}
              className="col-span-2 h-12"
            >
              <option value="MINOR">Minor — search-only in the city picker</option>
              <option value="MAJOR">Major — pinned in the city picker</option>
            </Select>
          </div>
          <Button type="submit" disabled={saving} className="mt-4">
            {saving ? "Saving…" : "Add city"}
          </Button>
        </form>
      </Card>
    </AdminShell>
  );
}
