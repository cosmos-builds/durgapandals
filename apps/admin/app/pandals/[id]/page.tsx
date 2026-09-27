"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { useAdminGuard } from "@/lib/use-admin-guard";
import { adminFetch } from "@/lib/admin-api";
import { Button, Card, Dialog, Input, Select, Textarea } from "@durgapandals/ui";
import { LocationPicker } from "@/components/location-picker";
import type { ReverseGeocodeResult } from "@/lib/admin-api";

const MAP_TILES_URL = process.env.NEXT_PUBLIC_MAP_TILES_URL ?? "";

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
  latitude: number;
  longitude: number;
}

interface PandalYear {
  _id: string;
  year: number;
  theme?: string;
  description?: string;
  featured: boolean;
  publicationStatus: string;
  likes: number;
}

interface MergeCandidate {
  _id: string;
  canonicalName: string;
  locality: string;
}

const EMPTY_YEAR_FORM = {
  year: String(new Date().getFullYear()),
  theme: "",
  description: "",
  parkingInfo: "",
  categories: [] as string[],
};

// Same curated set as the public Add Pandal form (apps/web) — kept as a
// separate small constant here rather than a shared package, since it's
// just a 5-item list. "Family Friendly" is deliberately excluded: it
// described nearly every pandal, so it wasn't a useful filter.
const CATEGORY_OPTIONS = ["Traditional", "Theme / Creative", "Community Pandal", "Eco-Friendly", "Historic"];

export default function PandalDetailPage() {
  const ready = useAdminGuard();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [pandal, setPandal] = useState<Pandal | null>(null);
  // Snapshot of what's actually saved in the DB, separate from `pandal`
  // (which starts mutating the moment an admin drags the pin) — this is
  // what "reset to saved location" reverts to, and what's shown so a
  // mis-drag doesn't quietly get lost.
  const [savedPandal, setSavedPandal] = useState<Pandal | null>(null);
  const [draggedAddress, setDraggedAddress] = useState<ReverseGeocodeResult | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [years, setYears] = useState<PandalYear[]>([]);
  const [yearForm, setYearForm] = useState(EMPTY_YEAR_FORM);
  const [savingYear, setSavingYear] = useState(false);

  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeQuery, setMergeQuery] = useState("");
  const [mergeResults, setMergeResults] = useState<MergeCandidate[]>([]);
  const [mergeTarget, setMergeTarget] = useState<MergeCandidate | null>(null);
  const [merging, setMerging] = useState(false);

  async function load() {
    const res = await adminFetch(`/admin/pandals/${params.id}`);
    if (!res.ok) return;
    const data = await res.json();
    // The API only stores a GeoJSON `location` point ([lng, lat]) — flatten
    // it into latitude/longitude here so the rest of this component can
    // treat them like any other plain field.
    const [longitude, latitude] = data.pandal.location.coordinates as [number, number];
    const flattened = { ...data.pandal, latitude, longitude };
    setPandal(flattened);
    setSavedPandal(flattened);
    setDraggedAddress(null);
    setYears(data.years);
  }

  useEffect(() => {
    if (ready) load();
  }, [ready, params.id]);

  useEffect(() => {
    if (!mergeOpen || mergeQuery.trim().length < 2) {
      setMergeResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await adminFetch(`/admin/pandals?search=${encodeURIComponent(mergeQuery)}&pageSize=8`);
      if (!res.ok) return;
      const page = await res.json();
      setMergeResults(page.items.filter((p: MergeCandidate) => p._id !== params.id));
    }, 300);
    return () => clearTimeout(timer);
  }, [mergeOpen, mergeQuery, params.id]);

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
        latitude: pandal.latitude,
        longitude: pandal.longitude,
      }),
    });
    setSavedPandal(pandal);
    setDraggedAddress(null);
  }

  function updateLocation(coords: { latitude: number; longitude: number }) {
    setPandal((prev) => (prev ? { ...prev, ...coords } : prev));
  }

  // Dragging moves the pin immediately, with no confirm step — this is the
  // undo for "oops, wrong spot" without having to remember/retype the
  // original coordinates.
  function resetLocation() {
    if (!savedPandal) return;
    setPandal((prev) => (prev ? { ...prev, latitude: savedPandal.latitude, longitude: savedPandal.longitude } : prev));
    setDraggedAddress(null);
    setMapKey((k) => k + 1); // forces LocationPicker to remount centered on the reset point
  }

  const hasMovedFromSaved =
    !!savedPandal && (pandal?.latitude !== savedPandal.latitude || pandal?.longitude !== savedPandal.longitude);

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

  function toggleYearCategory(category: string) {
    setYearForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }));
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
          parkingInfo: yearForm.parkingInfo || undefined,
          categories: yearForm.categories,
        }),
      });
      setYearForm(EMPTY_YEAR_FORM);
      await load();
    } finally {
      setSavingYear(false);
    }
  }

  // This pandal (the "loser") gets archived and its years reassigned to
  // mergeTarget (the "winner") — apps/api already implements this fully,
  // it just had no UI caller anywhere in admin until now.
  async function confirmMerge() {
    if (!pandal || !mergeTarget) return;
    setMerging(true);
    try {
      const res = await adminFetch(`/admin/pandals/${pandal._id}/merge-into/${mergeTarget._id}`, {
        method: "POST",
      });
      if (res.ok) {
        router.push(`/pandals/${mergeTarget._id}`);
      }
    } finally {
      setMerging(false);
      setMergeOpen(false);
    }
  }

  if (!ready || !pandal) return null;

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-extrabold">{pandal.canonicalName}</h1>
        <Button variant="secondary" onClick={() => setMergeOpen(true)}>
          Merge into another pandal…
        </Button>
      </div>

      <div className="mb-6 flex gap-3">
        <Select
          value={pandal.publicationStatus}
          onChange={(e) => setStatus("publicationStatus", e.target.value)}
          className="h-10 w-44 text-sm"
        >
          {["DRAFT", "PENDING", "PUBLISHED", "ARCHIVED", "REJECTED"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select
          value={pandal.verificationStatus}
          onChange={(e) => setStatus("verificationStatus", e.target.value)}
          className="h-10 w-44 text-sm"
        >
          {["UNVERIFIED", "VERIFIED", "DUPLICATE"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      <Card className="mb-8 max-w-5xl">
        <h2 className="mb-4 font-body text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Canonical details
        </h2>
        <div className="flex flex-col gap-6 md:flex-row">
          <div className="grid flex-1 grid-cols-2 gap-3">
            <Input
              value={pandal.canonicalName}
              onChange={(e) => updateField("canonicalName", e.target.value)}
              className="col-span-2 h-11"
            />
            <Input
              placeholder="Organizer"
              value={pandal.organizerName ?? ""}
              onChange={(e) => updateField("organizerName", e.target.value)}
              className="col-span-2 h-11"
            />
            <Input
              placeholder="Address"
              value={pandal.address}
              onChange={(e) => updateField("address", e.target.value)}
              className="col-span-2 h-11"
            />
            <Input
              placeholder="Locality"
              value={pandal.locality}
              onChange={(e) => updateField("locality", e.target.value)}
              className="h-11"
            />
            <Input
              placeholder="Landmark"
              value={pandal.landmark ?? ""}
              onChange={(e) => updateField("landmark", e.target.value)}
              className="h-11"
            />
            <Input
              placeholder="Public contact"
              value={pandal.publicContact ?? ""}
              onChange={(e) => updateField("publicContact", e.target.value)}
              className="col-span-2 h-11"
            />
          </div>

          {/* Map lives beside the form instead of stacked above/below it —
              side by side, not one-above-the-other. */}
          <div className="flex flex-col gap-2 md:w-[380px] md:flex-none">
            <div className="flex items-center justify-between">
              <span className="font-body text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Location
              </span>
              {hasMovedFromSaved && (
                <button
                  type="button"
                  onClick={resetLocation}
                  className="flex items-center gap-1 font-body text-xs font-bold text-brand"
                >
                  <span className="material-symbols-rounded text-sm">undo</span>
                  Reset to saved
                </button>
              )}
            </div>
            <LocationPicker
              key={mapKey}
              center={{ latitude: pandal.latitude, longitude: pandal.longitude }}
              mapTilesUrl={MAP_TILES_URL}
              onChange={updateLocation}
              onAddressResolved={setDraggedAddress}
            />
            {/* Always visible, not just after a drag — so an admin who
                hasn't touched the map yet still sees what's currently
                saved, and one who has can compare against it. */}
            <div className="flex flex-col gap-1 rounded-xl bg-card px-3 py-2 font-body text-xs">
              <div className="flex items-start gap-1.5 text-ink-muted">
                <span className="material-symbols-rounded flex-none text-sm">bookmark</span>
                <span>
                  Saved: {savedPandal?.address}, {savedPandal?.locality}
                </span>
              </div>
              {hasMovedFromSaved && (
                <div className="flex items-start gap-1.5 text-accent">
                  <span className="material-symbols-rounded flex-none text-sm">pin_drop</span>
                  <span>{draggedAddress ? `New: ${draggedAddress.label}` : "Locating new address…"}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <Button className="mt-4" onClick={saveCanonical}>
          Save changes
        </Button>
      </Card>

      <Card className="max-w-2xl">
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
                <div className="flex items-center gap-2 font-body text-xs text-ink-muted">
                  <span>{year.publicationStatus}</span>
                  <span className="flex items-center gap-0.5 text-accent">
                    <span className="material-symbols-rounded text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                      thumb_up
                    </span>
                    {year.likes}
                  </span>
                </div>
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
            <Input
              type="number"
              placeholder="Year"
              value={yearForm.year}
              onChange={(e) => setYearForm({ ...yearForm, year: e.target.value })}
              className="h-10 text-sm"
            />
            <Input
              placeholder="Theme"
              value={yearForm.theme}
              onChange={(e) => setYearForm({ ...yearForm, theme: e.target.value })}
              className="h-10 text-sm"
            />
          </div>
          <Textarea
            placeholder="Theme details"
            value={yearForm.description}
            onChange={(e) => setYearForm({ ...yearForm, description: e.target.value })}
            className="min-h-20 text-sm"
          />
          <Input
            placeholder="Parking — e.g. Street parking available near the entrance"
            value={yearForm.parkingInfo}
            onChange={(e) => setYearForm({ ...yearForm, parkingInfo: e.target.value })}
            className="h-10 text-sm"
          />
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_OPTIONS.map((category) => {
              const isActive = yearForm.categories.includes(category);
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => toggleYearCategory(category)}
                  className={`rounded-pill border px-2.5 py-1 font-body text-xs font-semibold ${
                    isActive ? "border-brand bg-brand text-brand-ink" : "border-border text-ink-muted"
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>
          <Button type="submit" variant="secondary" disabled={savingYear}>
            {savingYear ? "Adding…" : "Add year"}
          </Button>
        </form>
      </Card>

      <Dialog open={mergeOpen} onClose={() => setMergeOpen(false)} title="Merge into another pandal">
        <p className="font-body text-sm text-ink-muted">
          <span className="font-bold text-ink">{pandal.canonicalName}</span> will be archived and its festival years
          moved onto whichever pandal you pick below. This can't be undone.
        </p>
        <Input
          autoFocus
          placeholder="Search pandals by name…"
          value={mergeQuery}
          onChange={(e) => {
            setMergeQuery(e.target.value);
            setMergeTarget(null);
          }}
          className="h-11 w-full"
        />
        <div className="flex max-h-52 flex-col gap-1 overflow-y-auto">
          {mergeResults.map((candidate) => (
            <button
              key={candidate._id}
              onClick={() => setMergeTarget(candidate)}
              className={`rounded-xl px-3 py-2 text-left font-body text-sm ${
                mergeTarget?._id === candidate._id ? "bg-brand text-brand-ink" : "bg-card hover:bg-chip"
              }`}
            >
              <div className="font-semibold">{candidate.canonicalName}</div>
              <div className="text-xs opacity-70">{candidate.locality}</div>
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setMergeOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!mergeTarget || merging} onClick={confirmMerge}>
            {merging ? "Merging…" : "Merge"}
          </Button>
        </div>
      </Dialog>
    </AdminShell>
  );
}
