"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { useAdminGuard } from "@/lib/use-admin-guard";
import { adminFetch } from "@/lib/admin-api";
import { Button, Card, Field, Input, Select } from "@durgapandals/ui";
import { LocationPicker } from "@/components/location-picker";
import { CityCombobox, type SelectedCity } from "@/components/city-combobox";

const MAP_TILES_URL = process.env.NEXT_PUBLIC_MAP_TILES_URL ?? "";

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
  parkingAvailable: false,
  twoWheelerAccessible: false,
  fourWheelerAccessible: false,
  foodStallsNearby: false,
  streetShopsNearby: false,
  visitType: "WALKING_DARSHAN",
};

const AMENITY_FIELDS: { key: "parkingAvailable" | "twoWheelerAccessible" | "fourWheelerAccessible" | "foodStallsNearby" | "streetShopsNearby"; label: string }[] = [
  { key: "parkingAvailable", label: "Parking available" },
  { key: "twoWheelerAccessible", label: "2-wheeler accessible" },
  { key: "fourWheelerAccessible", label: "4-wheeler accessible" },
  { key: "foodStallsNearby", label: "Food stalls nearby" },
  { key: "streetShopsNearby", label: "Street shops nearby" },
];

// Admin creating a pandal directly still runs the same duplicate scoring a
// public submission does (spec §17.4, §23) — it just isn't blocking here,
// since the admin is the one making the final call.
export default function NewPandalPage() {
  const ready = useAdminGuard();
  const router = useRouter();
  const [selectedCity, setSelectedCity] = useState<SelectedCity | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed lat/lng from the city's centre right away instead of waiting on the
  // map to finish loading and fire its first moveend — otherwise
  // Check-duplicates/Create would stay disabled/empty until the admin drags
  // the pin at least once.
  function handleCitySelect(city: SelectedCity) {
    setSelectedCity(city);
    setForm((prev) => ({ ...prev, cityId: city._id, latitude: String(city.latitude), longitude: String(city.longitude) }));
  }

  function handleLocationChange(coords: { latitude: number; longitude: number }) {
    setForm((prev) => ({ ...prev, latitude: String(coords.latitude), longitude: String(coords.longitude) }));
  }

  // Only fills locality/address when they're still blank — an admin who's
  // already typed something here shouldn't have it silently overwritten by
  // a drag on the map.
  function handleAddressResolved(result: { locality?: string; road?: string }) {
    setForm((prev) => ({
      ...prev,
      locality: prev.locality || result.locality || prev.locality,
      address: prev.address || result.road || prev.address,
    }));
  }

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
      parkingAvailable: form.parkingAvailable,
      twoWheelerAccessible: form.twoWheelerAccessible,
      fourWheelerAccessible: form.fourWheelerAccessible,
      foodStallsNearby: form.foodStallsNearby,
      streetShopsNearby: form.streetShopsNearby,
      visitType: form.visitType,
    };
  }

  function toggleAmenity(key: (typeof AMENITY_FIELDS)[number]["key"]) {
    setForm((prev) => ({ ...prev, [key]: !prev[key] }));
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

      <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-2">
        <Card padding="md">
        <div className="grid grid-cols-2 gap-3">
          <Field label="City" className="col-span-2">
            <CityCombobox value={selectedCity} onSelect={handleCitySelect} />
          </Field>
          <Field label="Pandal name" className="col-span-2">
            <Input
              required
              placeholder="e.g. Kumartuli Sarbojanin"
              value={form.canonicalName}
              onChange={(e) => setForm({ ...form, canonicalName: e.target.value })}
            />
          </Field>
          <Field label="Organiser / committee" className="col-span-2">
            <Input
              placeholder="e.g. Kumartuli Sarbojanin Committee"
              value={form.organizerName}
              onChange={(e) => setForm({ ...form, organizerName: e.target.value })}
            />
          </Field>
          <Field label="Address" className="col-span-2">
            <Input
              required
              placeholder="Full street address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
          <Field label="Locality / area">
            <Input
              required
              placeholder="e.g. Kumartuli"
              value={form.locality}
              onChange={(e) => setForm({ ...form, locality: e.target.value })}
            />
          </Field>
          <Field label="Landmark">
            <Input
              placeholder="Optional"
              value={form.landmark}
              onChange={(e) => setForm({ ...form, landmark: e.target.value })}
            />
          </Field>
          <Field label="Public contact" className="col-span-2">
            <Input
              placeholder="Phone number visitors can call"
              value={form.publicContact}
              onChange={(e) => setForm({ ...form, publicContact: e.target.value })}
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
          <span className="font-body text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Good to know for visitors
          </span>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {AMENITY_FIELDS.map((field) => (
              <label key={field.key} className="flex items-center gap-2 font-body text-sm">
                <input
                  type="checkbox"
                  checked={form[field.key]}
                  onChange={() => toggleAmenity(field.key)}
                  className="h-4 w-4 accent-brand"
                />
                {field.label}
              </label>
            ))}
          </div>
          <Field label="Visit type">
            <Select value={form.visitType} onChange={(e) => setForm({ ...form, visitType: e.target.value })}>
              <option value="WALKING_DARSHAN">Walking darshan · quick visit</option>
              <option value="PARK_AND_VISIT">Park &amp; visit</option>
              <option value="DARSHAN_AND_GO">Darshan &amp; go</option>
            </Select>
          </Field>
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
        </Card>

        <Card padding="none" className="overflow-hidden">
          {selectedCity ? (
            <LocationPicker
              key={selectedCity._id}
              center={{ latitude: selectedCity.latitude, longitude: selectedCity.longitude }}
              zoom={selectedCity.defaultMapZoom}
              mapTilesUrl={MAP_TILES_URL}
              onChange={handleLocationChange}
              onAddressResolved={handleAddressResolved}
            />
          ) : (
            <div className="flex h-[280px] w-full items-center justify-center font-body text-sm text-ink-muted">
              Select a city to drop the pin
            </div>
          )}
        </Card>
      </form>
    </AdminShell>
  );
}
