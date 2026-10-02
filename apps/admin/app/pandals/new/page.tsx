"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { useAdminGuard } from "@/lib/use-admin-guard";
import { adminFetch } from "@/lib/admin-api";
import { Button, Card, Field, Input, Select, Textarea, useToast } from "@durgapandals/ui";
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
  alternateNames: "",
  organizerName: "",
  latitude: "",
  longitude: "",
  address: "",
  locality: "",
  landmark: "",
  publicContact: "",
  instagramUrl: "",
  facebookUrl: "",
  websiteUrl: "",
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

// Same curated set as the pandal edit page's "Add a festival year" form.
const CATEGORY_OPTIONS = ["Traditional", "Theme / Creative", "Community Pandal", "Eco-Friendly", "Historic"];

const EMPTY_YEAR_FORM = {
  year: String(new Date().getFullYear()),
  theme: "",
  description: "",
  categories: [] as string[],
};

// Admin creating a pandal directly still runs the same duplicate scoring a
// public submission does (spec §17.4, §23) — it just isn't blocking here,
// since the admin is the one making the final call.
export default function NewPandalPage() {
  const ready = useAdminGuard();
  const router = useRouter();
  const toast = useToast();
  const [selectedCity, setSelectedCity] = useState<SelectedCity | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [yearForm, setYearForm] = useState(EMPTY_YEAR_FORM);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleYearCategory(category: string) {
    setYearForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }));
  }

  // Seed lat/lng from the city's centre right away — the picker no longer
  // auto-commits anything on its own (only its explicit "Use this location"
  // button does), so without this, Check-duplicates/Create would stay
  // empty until the admin deliberately confirmed a pin at least once.
  function handleCitySelect(city: SelectedCity) {
    setSelectedCity(city);
    setForm((prev) => ({ ...prev, cityId: city._id, latitude: String(city.latitude), longitude: String(city.longitude) }));
  }

  function handleLocationChange(coords: { latitude: number; longitude: number }) {
    setForm((prev) => ({ ...prev, latitude: String(coords.latitude), longitude: String(coords.longitude) }));
  }

  // Only ever fires when the admin explicitly clicks "Use this location"
  // inside the picker (never on a bare drag), so always applying it here is
  // safe — it's a deliberate one-time action, not a silent live sync.
  function handleAddressResolved(result: { label: string; locality?: string; road?: string }) {
    setForm((prev) => ({
      ...prev,
      locality: result.locality ?? prev.locality,
      address: result.road ?? result.label,
    }));
  }

  function buildPayload() {
    return {
      cityId: form.cityId,
      canonicalName: form.canonicalName,
      alternateNames: form.alternateNames
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean),
      organizerName: form.organizerName || undefined,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      address: form.address,
      locality: form.locality,
      landmark: form.landmark || undefined,
      publicContact: form.publicContact || undefined,
      instagramUrl: form.instagramUrl || undefined,
      facebookUrl: form.facebookUrl || undefined,
      websiteUrl: form.websiteUrl || undefined,
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

      // Optional — an admin who just wants the profile created can leave
      // this blank and add the year later on the pandal's own page, same as
      // before. Only bother creating a year record when there's actually
      // something in it, so a blank pandal doesn't get a blank year row.
      const hasYearContent = yearForm.theme.trim() || yearForm.description.trim() || yearForm.categories.length > 0;
      if (hasYearContent) {
        const yearRes = await adminFetch("/admin/pandal-years", {
          method: "POST",
          body: JSON.stringify({
            pandalId: pandal._id,
            year: Number(yearForm.year),
            theme: yearForm.theme || undefined,
            description: yearForm.description || undefined,
            categories: yearForm.categories,
          }),
        });
        if (!yearRes.ok) {
          toast.error(`"${pandal.canonicalName}" was created, but adding ${yearForm.year} failed — add it from the pandal's page.`);
          router.push(`/pandals/${pandal._id}`);
          return;
        }
      }

      toast.success(`"${pandal.canonicalName}" created.`);
      router.push(`/pandals/${pandal._id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return null;

  return (
    <AdminShell>
      <form onSubmit={handleSubmit}>
        {/* Matches the Edit page's action bar: both actions that used to sit
            mid-form (duplicate check, create) stay reachable without
            scrolling back up through a long form. Add Pandal never had
            scattered status/delete/merge actions to consolidate — this is
            just the same visual language, not the same fix. */}
        <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-6 flex items-center justify-between gap-4 border-b border-border bg-ground-deep/95 px-4 py-4 backdrop-blur md:-mx-8 md:-mt-8 md:px-8">
          <div>
            <div className="font-body text-xs text-ink-muted">Pandals / New</div>
            <h1 className="font-display text-xl font-extrabold">Add Pandal</h1>
          </div>
          <div className="flex flex-none items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              uiSize="sm"
              onClick={handleCheckDuplicates}
              disabled={checking || !form.cityId || !form.canonicalName || !form.latitude || !form.longitude}
            >
              {checking ? "Checking…" : "Check for duplicates"}
            </Button>
            <Button type="submit" uiSize="sm" disabled={saving}>
              {saving ? "Creating…" : "Create & publish pandal"}
            </Button>
          </div>
        </div>

        {error && <p className="mb-4 font-body text-sm text-brand">{error}</p>}

        <Card className="mb-6 max-w-5xl">
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="mb-3 font-body text-xs font-extrabold uppercase tracking-wide text-accent">
                City &amp; basics
              </h2>
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
                <Field label="Organiser / committee">
                  <Input
                    placeholder="e.g. Kumartuli Sarbojanin Committee"
                    value={form.organizerName}
                    onChange={(e) => setForm({ ...form, organizerName: e.target.value })}
                  />
                </Field>
                <Field label="Also known as">
                  <Input
                    placeholder="Comma-separated"
                    value={form.alternateNames}
                    onChange={(e) => setForm({ ...form, alternateNames: e.target.value })}
                  />
                </Field>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Map lives beside the location fields instead of as a whole
                separate card down/beside the entire page. */}
            <div>
              <h2 className="mb-3 font-body text-xs font-extrabold uppercase tracking-wide text-accent">
                Location
              </h2>
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="flex flex-1 flex-col gap-3">
                  <Field label="Address">
                    <Input
                      required
                      placeholder="Full street address"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
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
                  </div>
                  {duplicates && (
                    <div className="flex flex-col gap-2">
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
                </div>
                <div className="overflow-hidden rounded-xl md:w-[380px] md:flex-none">
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
                    <div className="flex h-[220px] w-full items-center justify-center rounded-xl bg-card font-body text-sm text-ink-muted">
                      Select a city to drop the pin
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div>
              <h2 className="mb-3 font-body text-xs font-extrabold uppercase tracking-wide text-accent">
                Contact &amp; links
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Public contact" className="col-span-2">
                  <Input
                    placeholder="Phone number visitors can call"
                    value={form.publicContact}
                    onChange={(e) => setForm({ ...form, publicContact: e.target.value })}
                  />
                </Field>
                <Field label="Instagram">
                  <Input
                    placeholder="https://instagram.com/…"
                    value={form.instagramUrl}
                    onChange={(e) => setForm({ ...form, instagramUrl: e.target.value })}
                  />
                </Field>
                <Field label="Facebook">
                  <Input
                    placeholder="https://facebook.com/…"
                    value={form.facebookUrl}
                    onChange={(e) => setForm({ ...form, facebookUrl: e.target.value })}
                  />
                </Field>
                <Field label="Website" className="col-span-2">
                  <Input
                    placeholder="https://…"
                    value={form.websiteUrl}
                    onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
                  />
                </Field>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div>
              <h2 className="mb-3 font-body text-xs font-extrabold uppercase tracking-wide text-accent">
                Amenities &amp; visit type
              </h2>
              <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-card px-4 py-3">
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
              <Field label="Visit type" className="max-w-xs">
                <Select value={form.visitType} onChange={(e) => setForm({ ...form, visitType: e.target.value })}>
                  <option value="WALKING_DARSHAN">Walking darshan · quick visit</option>
                  <option value="PARK_AND_VISIT">Park &amp; visit</option>
                  <option value="DARSHAN_AND_GO">Darshan &amp; go</option>
                </Select>
              </Field>
            </div>
          </div>
        </Card>

        {/* Boxed off and dashed, same as the Edit page's Festival Years —
            optional and a different lifecycle from the pandal fields above. */}
        <div className="max-w-5xl">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-body text-sm font-bold">This festival year</h2>
            <span className="font-body text-xs text-ink-muted">
              Optional — leave blank and add it later from the pandal&apos;s own page
            </span>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-border bg-card/40 p-5">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Year">
                <Input
                  type="number"
                  value={yearForm.year}
                  onChange={(e) => setYearForm({ ...yearForm, year: e.target.value })}
                />
              </Field>
              <Field label="Theme">
                <Input
                  placeholder="Optional"
                  value={yearForm.theme}
                  onChange={(e) => setYearForm({ ...yearForm, theme: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Theme details">
              <Textarea
                placeholder="What makes this year's theme worth visiting?"
                value={yearForm.description}
                onChange={(e) => setYearForm({ ...yearForm, description: e.target.value })}
                className="min-h-20"
              />
            </Field>
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
            <p className="font-body text-xs text-ink-muted">
              Photos and a detailed schedule can only be added after the pandal is created, from its own page.
            </p>
          </div>
        </div>
      </form>
    </AdminShell>
  );
}
