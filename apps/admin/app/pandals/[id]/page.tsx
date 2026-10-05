"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { useAdminGuard } from "@/lib/use-admin-guard";
import {
  adminFetch,
  adminMutate,
  uploadAdminPhoto,
  deleteAdminPhoto,
  deletePandal,
  deletePandalYear,
} from "@/lib/admin-api";
import { Button, Card, ConfirmDialog, Dialog, Field, Input, Select, Textarea, useToast } from "@durgapandals/ui";
import { LocationPicker } from "@/components/location-picker";

const MAP_TILES_URL = process.env.NEXT_PUBLIC_MAP_TILES_URL ?? "";

type AddedBy = "ADMIN" | "ORGANIZER" | "PUBLIC_SUBMISSION";
type VisitType = "WALKING_DARSHAN" | "PARK_AND_VISIT" | "DARSHAN_AND_GO";

interface Pandal {
  _id: string;
  canonicalName: string;
  alternateNames: string[];
  organizerName?: string;
  address: string;
  locality: string;
  landmark?: string;
  publicContact?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  websiteUrl?: string;
  publicationStatus: string;
  verificationStatus: string;
  latitude: number;
  longitude: number;
  addedBy: AddedBy;
  parkingAvailable: boolean;
  twoWheelerAccessible: boolean;
  fourWheelerAccessible: boolean;
  foodStallsNearby: boolean;
  streetShopsNearby: boolean;
  visitType: VisitType;
}

interface ScheduleEntry {
  time: string;
  label: string;
}

interface MediaAsset {
  url: string;
  width?: number;
  height?: number;
  altText?: string;
  caption?: string;
}

interface PandalYear {
  _id: string;
  year: number;
  theme?: string;
  description?: string;
  categories: string[];
  featured: boolean;
  publicationStatus: string;
  likes: number;
  schedule: ScheduleEntry[];
  coverImage?: string;
  photos: MediaAsset[];
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
  categories: [] as string[],
  schedule: [] as ScheduleEntry[],
};

const AMENITY_FIELDS: { key: keyof Pick<Pandal, "parkingAvailable" | "twoWheelerAccessible" | "fourWheelerAccessible" | "foodStallsNearby" | "streetShopsNearby">; label: string }[] = [
  { key: "parkingAvailable", label: "Parking available" },
  { key: "twoWheelerAccessible", label: "2-wheeler accessible" },
  { key: "fourWheelerAccessible", label: "4-wheeler accessible" },
  { key: "foodStallsNearby", label: "Food stalls nearby" },
  { key: "streetShopsNearby", label: "Street shops nearby" },
];

// Same curated set as the public Add Pandal form (apps/web) — kept as a
// separate small constant here rather than a shared package, since it's
// just a 5-item list. "Family Friendly" is deliberately excluded: it
// described nearly every pandal, so it wasn't a useful filter.
const CATEGORY_OPTIONS = ["Traditional", "Theme / Creative", "Community Pandal", "Eco-Friendly", "Historic"];

// Same limits as the public Add Pandal flow (apps/web/components/add-pandal-flow.tsx).
const MAX_YEAR_PHOTOS = 20;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO_SIZE_BYTES = 8 * 1024 * 1024;

export default function PandalDetailPage() {
  const ready = useAdminGuard();
  const router = useRouter();
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const [pandal, setPandal] = useState<Pandal | null>(null);
  // Snapshot of what's actually saved in the DB, separate from `pandal`
  // (which starts mutating the moment an admin drags the pin) — this is
  // what "reset to saved location" reverts to, and what's shown so a
  // mis-drag doesn't quietly get lost.
  const [savedPandal, setSavedPandal] = useState<Pandal | null>(null);
  // Edited as free text (comma-separated) rather than parsing to an array on
  // every keystroke — splitting live would eat a trailing "," while the
  // admin is still typing the next name.
  const [alternateNamesInput, setAlternateNamesInput] = useState("");
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const [years, setYears] = useState<PandalYear[]>([]);
  const [yearForm, setYearForm] = useState(EMPTY_YEAR_FORM);
  // Set while editing an existing, already-published year — the same form
  // below switches from POST (new year) to PATCH (this one) while it's set.
  const [editingYearId, setEditingYearId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [savingYear, setSavingYear] = useState(false);
  const [uploadingYearId, setUploadingYearId] = useState<string | null>(null);

  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeQuery, setMergeQuery] = useState("");
  const [mergeResults, setMergeResults] = useState<MergeCandidate[]>([]);
  const [mergeTarget, setMergeTarget] = useState<MergeCandidate | null>(null);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [deletePandalOpen, setDeletePandalOpen] = useState(false);
  const [yearToDelete, setYearToDelete] = useState<PandalYear | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<{ year: PandalYear; url: string } | null>(null);

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
    setAlternateNamesInput((flattened.alternateNames ?? []).join(", "));
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

  function updateField(field: keyof Pandal, value: string) {
    if (!pandal) return;
    setPandal({ ...pandal, [field]: value });
  }

  function toggleAmenity(field: (typeof AMENITY_FIELDS)[number]["key"]) {
    if (!pandal) return;
    setPandal({ ...pandal, [field]: !pandal[field] });
  }

  // Fields an admin can actually see/edit on this screen, paired with a
  // human label — used to build the confirmation summary below. Anything
  // not listed here (e.g. internal-only fields) is silently excluded from
  // the diff, which is fine since it can't have changed via this form.
  const TRACKED_FIELDS: { key: keyof Pandal; label: string }[] = [
    { key: "canonicalName", label: "Name" },
    { key: "organizerName", label: "Organiser" },
    { key: "address", label: "Address" },
    { key: "locality", label: "Locality" },
    { key: "landmark", label: "Landmark" },
    { key: "publicContact", label: "Contact" },
    { key: "visitType", label: "Visit type" },
    { key: "addedBy", label: "Added by" },
    { key: "publicationStatus", label: "Publication status" },
    { key: "verificationStatus", label: "Verification status" },
  ];

  function pendingChangesSummary(): string[] {
    if (!pandal || !savedPandal) return [];
    const changes: string[] = [];
    for (const { key, label } of TRACKED_FIELDS) {
      const before = savedPandal[key];
      const after = pandal[key];
      if (before !== after) changes.push(`${label}: "${before || "—"}" → "${after || "—"}"`);
    }
    if (hasMovedFromSaved) changes.push("Map location moved to a new pin");
    const amenityChanged = AMENITY_FIELDS.some((f) => savedPandal[f.key] !== pandal[f.key]);
    if (amenityChanged) changes.push("Amenities updated");
    const newAlternateNames = alternateNamesInput
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    if (JSON.stringify(newAlternateNames) !== JSON.stringify(savedPandal.alternateNames)) {
      changes.push("Alternate names updated");
    }
    return changes;
  }

  // `setSavedPandal` is what marks the edit as persisted (it's what
  // `hasMovedFromSaved` and the "Reset to saved" affordance compare
  // against) — it must only happen once the PATCH actually succeeded, or a
  // failed save silently looks identical to a successful one.
  //
  // publicationStatus/verificationStatus used to fire their own instant
  // PATCH the moment their dropdown changed — publishing or drafting a
  // pandal with no confirmation step at all. They're now just local edits
  // like every other field here, folded into this one save, which is now
  // gated behind a confirmation dialog (see saveConfirmOpen below) instead
  // of firing directly from a click.
  async function saveCanonical() {
    if (!pandal) return;
    setError(null);
    const result = await adminMutate(`/admin/pandals/${pandal._id}`, {
      method: "PATCH",
      body: JSON.stringify({
        canonicalName: pandal.canonicalName,
        alternateNames: alternateNamesInput
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean),
        organizerName: pandal.organizerName,
        address: pandal.address,
        locality: pandal.locality,
        landmark: pandal.landmark,
        publicContact: pandal.publicContact,
        instagramUrl: pandal.instagramUrl || undefined,
        facebookUrl: pandal.facebookUrl || undefined,
        websiteUrl: pandal.websiteUrl || undefined,
        latitude: pandal.latitude,
        longitude: pandal.longitude,
        addedBy: pandal.addedBy,
        parkingAvailable: pandal.parkingAvailable,
        twoWheelerAccessible: pandal.twoWheelerAccessible,
        fourWheelerAccessible: pandal.fourWheelerAccessible,
        foodStallsNearby: pandal.foodStallsNearby,
        streetShopsNearby: pandal.streetShopsNearby,
        visitType: pandal.visitType,
      }),
    });
    if (!result.ok) {
      const message = result.error ?? "Couldn't save changes.";
      setError(message);
      throw new Error(message);
    }

    // The main PATCH above doesn't persist publish/verification status (a
    // separate, narrower endpoint owns that transition) — only call it when
    // one of those two actually changed, so a plain details edit doesn't
    // fire an extra request.
    if (pandal.publicationStatus !== savedPandal?.publicationStatus || pandal.verificationStatus !== savedPandal?.verificationStatus) {
      const statusResult = await adminMutate(`/admin/pandals/${pandal._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          publicationStatus: pandal.publicationStatus,
          verificationStatus: pandal.verificationStatus,
        }),
      });
      if (!statusResult.ok) {
        const message = statusResult.error ?? "Couldn't update status.";
        setError(message);
        throw new Error(message);
      }
    }

    setSavedPandal(pandal);
    toast.success("Changes saved.");
  }

  function updateLocation(coords: { latitude: number; longitude: number }) {
    setPandal((prev) => (prev ? { ...prev, ...coords } : prev));
  }

  // "Use this location" inside the picker is the only thing that reaches
  // here — this is the undo for "oops, wrong spot" without having to
  // remember/retype the original coordinates.
  function resetLocation() {
    if (!savedPandal) return;
    setPandal((prev) => (prev ? { ...prev, latitude: savedPandal.latitude, longitude: savedPandal.longitude } : prev));
    setMapKey((k) => k + 1); // forces LocationPicker to remount centered on the reset point
  }

  // The one "Reset" next to the one "Save" — discards every pending edit on
  // this form (status selects included, since those are now just regular
  // fields here too) back to whatever's actually saved, instead of an admin
  // having to manually retype each field back or reload the page.
  function resetAll() {
    if (!savedPandal) return;
    setPandal(savedPandal);
    setAlternateNamesInput((savedPandal.alternateNames ?? []).join(", "));
    setMapKey((k) => k + 1);
  }

  const hasMovedFromSaved =
    !!savedPandal && (pandal?.latitude !== savedPandal.latitude || pandal?.longitude !== savedPandal.longitude);

  async function toggleFeatured(yearId: string, featured: boolean) {
    setError(null);
    const result = await adminMutate(`/admin/pandal-years/${yearId}`, {
      method: "PATCH",
      body: JSON.stringify({ featured: !featured }),
    });
    if (!result.ok) {
      setError(result.error ?? "Couldn't update featured status.");
      toast.error(result.error ?? "Couldn't update featured status.");
    }
    await load();
  }

  async function handleYearPhotoSelect(year: PandalYear, event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ""; // lets the same file be re-picked after removal
    if (files.length === 0) return;

    setError(null);
    setUploadingYearId(year._id);
    let nextPhotos = year.photos;
    for (const file of files) {
      if (nextPhotos.length >= MAX_YEAR_PHOTOS) {
        setError(`Up to ${MAX_YEAR_PHOTOS} photos per year.`);
        break;
      }
      if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
        setError("Only JPEG, PNG, or WebP images are supported.");
        continue;
      }
      if (file.size > MAX_PHOTO_SIZE_BYTES) {
        setError(`"${file.name}" is larger than 8MB.`);
        continue;
      }
      const result = await uploadAdminPhoto(file);
      if (!result.ok || !result.photo) {
        setError(result.error ?? "Could not upload photo.");
        continue;
      }
      nextPhotos = [...nextPhotos, result.photo];
    }

    const saveResult = await adminMutate(`/admin/pandal-years/${year._id}`, {
      method: "PATCH",
      body: JSON.stringify({ photos: nextPhotos }),
    });
    if (!saveResult.ok) setError(saveResult.error ?? "Uploaded, but couldn't save photos.");
    setUploadingYearId(null);
    await load();
  }

  // Uploaded to Cloudinary immediately on selection, same as the public Add
  // Pandal flow — removing it here would otherwise leave it orphaned in
  // storage with nothing pointing to it, so it's deleted best-effort.
  async function confirmRemoveYearPhoto() {
    if (!photoToDelete) return;
    const { year, url } = photoToDelete;
    setError(null);
    const nextPhotos = year.photos.filter((p) => p.url !== url);
    const clearingCover = year.coverImage === url;
    void deleteAdminPhoto(url);
    const result = await adminMutate(`/admin/pandal-years/${year._id}`, {
      method: "PATCH",
      body: JSON.stringify({ photos: nextPhotos, ...(clearingCover ? { coverImage: null } : {}) }),
    });
    if (!result.ok) throw new Error(result.error ?? "Couldn't remove photo.");
    setPhotoToDelete(null);
    toast.success("Photo removed.");
    await load();
  }

  async function setCoverImage(year: PandalYear, url: string) {
    setError(null);
    const result = await adminMutate(`/admin/pandal-years/${year._id}`, {
      method: "PATCH",
      body: JSON.stringify({ coverImage: url }),
    });
    if (!result.ok) setError(result.error ?? "Couldn't set cover photo.");
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

  function addScheduleRow() {
    setYearForm((prev) => ({ ...prev, schedule: [...prev.schedule, { time: "", label: "" }] }));
  }

  function updateScheduleRow(index: number, field: keyof ScheduleEntry, value: string) {
    setYearForm((prev) => ({
      ...prev,
      schedule: prev.schedule.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    }));
  }

  function removeScheduleRow(index: number) {
    setYearForm((prev) => ({ ...prev, schedule: prev.schedule.filter((_, i) => i !== index) }));
  }

  function startEditingYear(year: PandalYear) {
    setEditingYearId(year._id);
    setYearForm({
      year: String(year.year),
      theme: year.theme ?? "",
      description: year.description ?? "",
      categories: year.categories ?? [],
      schedule: year.schedule,
    });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cancelEditingYear() {
    setEditingYearId(null);
    setYearForm(EMPTY_YEAR_FORM);
  }

  async function addYear(event: React.FormEvent) {
    event.preventDefault();
    if (!pandal) return;
    setSavingYear(true);
    setError(null);
    try {
      // Editing an existing year PATCHes it in place (its `year` field is
      // immutable server-side — pandalYearSchema.partial().omit({ year })
      // on that route — so the Year input stays disabled while editing
      // rather than silently accepting a value the server will ignore).
      const result = editingYearId
        ? await adminMutate(`/admin/pandal-years/${editingYearId}`, {
            method: "PATCH",
            body: JSON.stringify({
              theme: yearForm.theme || undefined,
              description: yearForm.description || undefined,
              categories: yearForm.categories,
              schedule: yearForm.schedule.filter((row) => row.time && row.label),
            }),
          })
        : await adminMutate("/admin/pandal-years", {
            method: "POST",
            body: JSON.stringify({
              pandalId: pandal._id,
              year: Number(yearForm.year),
              theme: yearForm.theme || undefined,
              description: yearForm.description || undefined,
              categories: yearForm.categories,
              schedule: yearForm.schedule.filter((row) => row.time && row.label),
            }),
          });
      if (!result.ok) {
        setError(result.error ?? "Couldn't save year.");
        toast.error(result.error ?? "Couldn't save year.");
        return;
      }
      toast.success(editingYearId ? `${yearForm.year} updated.` : `${yearForm.year} added.`);
      setEditingYearId(null);
      setYearForm(EMPTY_YEAR_FORM);
      await load();
    } finally {
      setSavingYear(false);
    }
  }

  async function confirmDeleteYear() {
    if (!yearToDelete) return;
    const result = await deletePandalYear(yearToDelete._id);
    if (!result.ok) throw new Error(result.error ?? "Couldn't delete this year.");
    setYearToDelete(null);
    toast.success(`${yearToDelete.year} deleted.`);
    await load();
  }

  async function confirmDeletePandal() {
    if (!pandal) return;
    const result = await deletePandal(pandal._id);
    if (!result.ok) throw new Error(result.error ?? "Couldn't delete this pandal.");
    toast.success(`"${pandal.canonicalName}" deleted.`);
    router.push("/pandals");
  }

  // This pandal (the "loser") gets archived and its years reassigned to
  // mergeTarget (the "winner") — apps/api already implements this fully,
  // it just had no UI caller anywhere in admin until now.
  async function confirmMerge() {
    if (!pandal || !mergeTarget) return;
    setMerging(true);
    setMergeError(null);
    const result = await adminMutate(`/admin/pandals/${pandal._id}/merge-into/${mergeTarget._id}`, {
      method: "POST",
    });
    setMerging(false);
    if (!result.ok) {
      // Stays open on failure — closing it unconditionally (the previous
      // behavior) made a failed merge indistinguishable from one the admin
      // just decided to cancel.
      setMergeError(result.error ?? "Couldn't merge — please try again.");
      return;
    }
    setMergeOpen(false);
    router.push(`/pandals/${mergeTarget._id}`);
  }

  if (!ready || !pandal) return null;

  const isDirty = pendingChangesSummary().length > 0;

  return (
    <AdminShell>
      {/* One action bar: the title/status at a glance on the left; Merge and
          Delete grouped together on the right (same prominence as Save, but
          a divider away from it — neither is ever triggered by Save); and a
          Reset+"Update pandal" pair that's always visible but disabled
          until something's actually dirty — so an admin can always see
          where the save action lives instead of it appearing/disappearing
          as they edit. */}
      <div className="sticky top-0 z-10 -mx-4 mb-6 flex items-center gap-4 border-b border-border bg-ground-deep/95 px-4 py-4 backdrop-blur md:-mx-8 md:px-8">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate font-display text-xl font-extrabold">{pandal.canonicalName}</h1>
            <span className="flex-none rounded-pill bg-info/15 px-2 py-0.5 font-body text-[10px] font-bold text-info">
              {pandal.publicationStatus}
            </span>
            <span className="flex-none rounded-pill bg-accent/15 px-2 py-0.5 font-body text-[10px] font-bold text-accent">
              {pandal.verificationStatus}
            </span>
          </div>
        </div>

        <div className="flex flex-none items-center gap-2">
          <Button variant="secondary" uiSize="sm" onClick={() => setMergeOpen(true)}>
            Merge into…
          </Button>
          <Button variant="secondary" uiSize="sm" className="border-brand/40 text-brand" onClick={() => setDeletePandalOpen(true)}>
            Delete pandal
          </Button>

          <div className="h-6 w-px bg-border" />
          <div
            className={`flex items-center gap-2 rounded-xl border py-1.5 pl-3 pr-1.5 ${
              isDirty ? "border-accent/30 bg-accent/10" : "border-border bg-card/40"
            }`}
          >
            {isDirty && (
              <span className="flex items-center gap-1.5 font-body text-xs font-bold text-accent">
                <span className="h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                Unsaved changes
              </span>
            )}
            <Button variant="secondary" uiSize="sm" disabled={!isDirty} onClick={resetAll}>
              Reset
            </Button>
            <Button uiSize="sm" disabled={!isDirty} onClick={() => setSaveConfirmOpen(true)}>
              Update pandal
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-brand/30 bg-brand/10 px-4 py-2.5 font-body text-sm text-brand">
          {error}
        </div>
      )}

      <Card className="mb-8 max-w-5xl">
        <h2 className="mb-4 font-body text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Canonical details
        </h2>
        <div className="flex flex-col gap-6 md:flex-row">
          <div className="grid flex-1 grid-cols-2 gap-3">
            <div className="col-span-2 grid grid-cols-3 gap-3 rounded-xl bg-card px-4 py-3">
              <Field label="Publication status">
                <Select value={pandal.publicationStatus} onChange={(e) => updateField("publicationStatus", e.target.value)}>
                  {["DRAFT", "PENDING", "PUBLISHED", "ARCHIVED", "REJECTED"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Verification status">
                <Select value={pandal.verificationStatus} onChange={(e) => updateField("verificationStatus", e.target.value)}>
                  {["UNVERIFIED", "VERIFIED", "DUPLICATE"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Added by">
                <Select value={pandal.addedBy} onChange={(e) => updateField("addedBy", e.target.value)}>
                  <option value="PUBLIC_SUBMISSION">Visitor</option>
                  <option value="ORGANIZER">Organiser</option>
                  <option value="ADMIN">Admin</option>
                </Select>
              </Field>
            </div>
            <Field label="Pandal name" className="col-span-2">
              <Input value={pandal.canonicalName} onChange={(e) => updateField("canonicalName", e.target.value)} />
            </Field>
            <Field label="Also known as" className="col-span-2">
              <Input
                placeholder="Comma-separated — other names people search for this pandal by"
                value={alternateNamesInput}
                onChange={(e) => setAlternateNamesInput(e.target.value)}
              />
            </Field>
            <Field label="Organiser / committee" className="col-span-2">
              <Input
                placeholder="Optional"
                value={pandal.organizerName ?? ""}
                onChange={(e) => updateField("organizerName", e.target.value)}
              />
            </Field>
            <Field label="Address" className="col-span-2">
              <Input value={pandal.address} onChange={(e) => updateField("address", e.target.value)} />
            </Field>
            <Field label="Locality">
              <Input value={pandal.locality} onChange={(e) => updateField("locality", e.target.value)} />
            </Field>
            <Field label="Landmark">
              <Input
                placeholder="Optional"
                value={pandal.landmark ?? ""}
                onChange={(e) => updateField("landmark", e.target.value)}
              />
            </Field>
            <Field label="Public contact" className="col-span-2">
              <Input
                placeholder="Phone number visitors can call"
                value={pandal.publicContact ?? ""}
                onChange={(e) => updateField("publicContact", e.target.value)}
              />
            </Field>
            <Field label="Instagram">
              <Input
                placeholder="https://instagram.com/…"
                value={pandal.instagramUrl ?? ""}
                onChange={(e) => updateField("instagramUrl", e.target.value)}
              />
            </Field>
            <Field label="Facebook">
              <Input
                placeholder="https://facebook.com/…"
                value={pandal.facebookUrl ?? ""}
                onChange={(e) => updateField("facebookUrl", e.target.value)}
              />
            </Field>
            <Field label="Website" className="col-span-2">
              <Input
                placeholder="https://…"
                value={pandal.websiteUrl ?? ""}
                onChange={(e) => updateField("websiteUrl", e.target.value)}
              />
            </Field>
            <Field label="Visit type" className="col-span-2">
              <Select value={pandal.visitType} onChange={(e) => updateField("visitType", e.target.value)}>
                <option value="WALKING_DARSHAN">Walking darshan · quick visit</option>
                <option value="PARK_AND_VISIT">Park &amp; visit</option>
                <option value="DARSHAN_AND_GO">Darshan &amp; go</option>
              </Select>
            </Field>
            <div className="col-span-2 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-card px-4 py-3">
              {AMENITY_FIELDS.map((field) => (
                <label key={field.key} className="flex items-center gap-2 font-body text-sm">
                  <input
                    type="checkbox"
                    checked={pandal[field.key]}
                    onChange={() => toggleAmenity(field.key)}
                    className="h-4 w-4 accent-brand"
                  />
                  {field.label}
                </label>
              ))}
            </div>
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
              onAddressResolved={(result) => {
                // Only ever fires when the admin explicitly clicks "Use
                // this location" inside the picker — never on a bare drag —
                // so applying it straight to the fields can't surprise
                // anyone mid-pan.
                updateField("address", result.road ?? result.label);
                if (result.locality) updateField("locality", result.locality);
              }}
            />
            {/* Always visible, not just after a move — so an admin who
                hasn't touched the map yet still sees what's currently
                saved, and one who has can compare against what's pending. */}
            <div className="flex flex-col gap-1 rounded-xl bg-card px-3 py-2 font-body text-xs">
              <div className="flex items-start gap-1.5 text-ink-muted">
                <span className="material-symbols-rounded flex-none text-sm">bookmark</span>
                <span>
                  Saved: {savedPandal?.address}, {savedPandal?.locality}
                </span>
              </div>
              {hasMovedFromSaved && (
                <div className="flex items-center justify-between gap-1.5 text-accent">
                  <span className="flex items-start gap-1.5">
                    <span className="material-symbols-rounded flex-none text-sm">pin_drop</span>
                    <span>
                      Pending: {pandal.address}, {pandal.locality}
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card className="max-w-3xl">
        <h2 className="mb-1 font-body text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Festival years
        </h2>
        <p className="mb-4 font-body text-sm text-ink-muted">
          This pandal is one physical location — the address and amenities above don&apos;t change. Each year it puts
          up a new theme, photos, and schedule, so it gets its own row below. Add one per year you have content for.
        </p>
        <div className="mb-4 flex flex-col gap-2">
          {years.map((year) => (
            <div key={year._id} className="flex flex-col gap-3 rounded-xl bg-card px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-body font-semibold">
                    {year.year} {year.theme && `· ${year.theme}`}
                  </div>
                  <div className="flex items-center gap-2 font-body text-xs text-ink-muted">
                    <span>{year.publicationStatus}</span>
                    <span className="flex items-center gap-0.5 text-brand">
                      <span className="material-symbols-rounded text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                        favorite
                      </span>
                      {year.likes}
                    </span>
                    {year.schedule.length > 0 && <span>{year.schedule.length} schedule rows</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleFeatured(year._id, year.featured)}
                    className={`rounded-lg px-3 py-1.5 font-body text-xs font-bold ${
                      year.featured ? "bg-accent text-accent-ink" : "border border-border text-ink-muted"
                    }`}
                  >
                    {year.featured ? "Featured" : "Feature"}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEditingYear(year)}
                    aria-label={`Edit ${year.year}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-brand/10 hover:text-brand"
                  >
                    <span className="material-symbols-rounded text-lg">edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setYearToDelete(year)}
                    aria-label={`Delete ${year.year}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-brand/10 hover:text-brand"
                  >
                    <span className="material-symbols-rounded text-lg">delete</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {year.photos.map((photo) => (
                  <div key={photo.url} className="relative h-20 w-20 flex-none overflow-hidden rounded-xl bg-panel">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt={photo.altText ?? ""} className="h-full w-full object-cover" />
                    {year.coverImage === photo.url && (
                      <span className="absolute left-1 top-1 rounded bg-brand px-1 py-0.5 font-body text-[9px] font-bold text-brand-ink">
                        Cover
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setPhotoToDelete({ year, url: photo.url })}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ground/80"
                    >
                      <span className="material-symbols-rounded text-xs">close</span>
                    </button>
                    {year.coverImage !== photo.url && (
                      <button
                        type="button"
                        onClick={() => setCoverImage(year, photo.url)}
                        className="absolute inset-x-0 bottom-0 bg-ground/70 py-0.5 font-body text-[9px] font-bold text-white"
                      >
                        Set cover
                      </button>
                    )}
                  </div>
                ))}
                {year.photos.length < MAX_YEAR_PHOTOS && (
                  <label className="flex h-20 w-20 flex-none cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-ink-muted">
                    {uploadingYearId === year._id ? (
                      <span className="material-symbols-rounded animate-spin text-xl">progress_activity</span>
                    ) : (
                      <>
                        <span className="material-symbols-rounded text-xl">add_photo_alternate</span>
                        <span className="font-body text-[10px] font-semibold">Add</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      disabled={uploadingYearId === year._id}
                      onChange={(e) => handleYearPhotoSelect(year, e)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          ))}
          {years.length === 0 && <p className="font-body text-sm text-ink-muted">No years added yet.</p>}
        </div>

        <form ref={formRef} onSubmit={addYear} className="flex flex-col gap-3 border-t border-border pt-4">
          <span className="-mb-1 font-body text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {editingYearId ? `Editing ${yearForm.year}` : "Add a festival year"}
          </span>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Year">
              <Input
                type="number"
                value={yearForm.year}
                onChange={(e) => setYearForm({ ...yearForm, year: e.target.value })}
                disabled={!!editingYearId}
                className="text-sm"
              />
            </Field>
            <Field label="Theme">
              <Input
                placeholder="Optional"
                value={yearForm.theme}
                onChange={(e) => setYearForm({ ...yearForm, theme: e.target.value })}
                className="text-sm"
              />
            </Field>
          </div>
          <Field label="Theme details">
            <Textarea
              placeholder="What makes this year's theme worth visiting?"
              value={yearForm.description}
              onChange={(e) => setYearForm({ ...yearForm, description: e.target.value })}
              className="min-h-20 text-sm"
            />
          </Field>
          <div className="flex flex-col gap-2">
            <span className="font-body text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Puja schedule
            </span>
            {yearForm.schedule.map((row, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="Time"
                  value={row.time}
                  onChange={(e) => updateScheduleRow(index, "time", e.target.value)}
                  className="h-12 w-28 text-sm"
                />
                <Input
                  placeholder="Event"
                  value={row.label}
                  onChange={(e) => updateScheduleRow(index, "label", e.target.value)}
                  className="h-12 flex-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeScheduleRow(index)}
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-card"
                >
                  <span className="material-symbols-rounded text-sm text-ink-muted">close</span>
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addScheduleRow}
              className="flex h-10 items-center justify-center rounded-xl border border-dashed border-border font-body text-xs font-bold text-brand"
            >
              + Add a schedule row
            </button>
          </div>
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
          <div className="flex gap-2">
            <Button type="submit" disabled={savingYear} className="flex-1">
              {savingYear ? "Saving…" : editingYearId ? "Save changes" : "Add festival year"}
            </Button>
            {editingYearId && (
              <Button type="button" variant="secondary" onClick={cancelEditingYear}>
                Cancel
              </Button>
            )}
          </div>
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
          className="h-12 w-full"
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
        {mergeError && <p className="font-body text-sm text-brand">{mergeError}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setMergeOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!mergeTarget || merging} onClick={confirmMerge}>
            {merging ? "Merging…" : "Merge"}
          </Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={saveConfirmOpen}
        onClose={() => setSaveConfirmOpen(false)}
        onConfirm={async () => {
          await saveCanonical();
          setSaveConfirmOpen(false);
        }}
        title="Update this pandal?"
        description={
          pendingChangesSummary().length > 0
            ? pendingChangesSummary().join("  •  ")
            : "No changes to save."
        }
        confirmLabel="Update pandal"
        danger={false}
      />

      <ConfirmDialog
        open={deletePandalOpen}
        onClose={() => setDeletePandalOpen(false)}
        onConfirm={confirmDeletePandal}
        title="Delete this pandal?"
        description={`"${pandal.canonicalName}" and all of its festival years, photos, and likes will be permanently deleted. This can't be undone.`}
        confirmLabel="Delete pandal"
      />

      <ConfirmDialog
        open={!!yearToDelete}
        onClose={() => setYearToDelete(null)}
        onConfirm={confirmDeleteYear}
        title="Delete this festival year?"
        description={
          yearToDelete
            ? `The ${yearToDelete.year} entry (theme, photos, schedule, likes) will be permanently deleted. The pandal itself and its other years are untouched. This can't be undone.`
            : ""
        }
        confirmLabel="Delete year"
      />

      <ConfirmDialog
        open={!!photoToDelete}
        onClose={() => setPhotoToDelete(null)}
        onConfirm={confirmRemoveYearPhoto}
        title="Remove this photo?"
        description="This photo will be permanently removed from this festival year."
        confirmLabel="Remove photo"
      />
    </AdminShell>
  );
}
