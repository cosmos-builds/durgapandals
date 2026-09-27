"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Map as MapLibreMap } from "maplibre-gl";
import { MapCanvas } from "@durgapandals/maps/react";
import { distanceMeters } from "@durgapandals/deduplication";
import { Button } from "@durgapandals/ui";
import {
  fetchNearbyPandals,
  reverseGeocode,
  sendVerificationCode,
  verifyCode,
  submitPandal,
  uploadPhoto,
  type NearbyPandal,
  type LocationSearchResult,
  type UploadedPhoto,
} from "@/lib/api";
import { LocationSearchBox } from "./location-search-box";

// OTP verification is off by default (contributors submit directly) but the
// code path stays in place — flip this back on with
// NEXT_PUBLIC_REQUIRE_CONTRIBUTOR_VERIFICATION=true (and the matching
// server-side REQUIRE_CONTRIBUTOR_VERIFICATION on the API) to require it
// again without restoring any deleted code.
const REQUIRE_VERIFICATION = process.env.NEXT_PUBLIC_REQUIRE_CONTRIBUTOR_VERIFICATION === "true";

// We only serve specific cities (spec §5.1) — a pin dropped hours away isn't
// a "correction to the city center," it's a different city we don't cover
// yet. 40km comfortably covers a metro area plus its outer suburbs without
// letting someone submit from a different city entirely.
const MAX_DISTANCE_FROM_CITY_KM = 40;

export interface AddPandalFlowProps {
  cityId: string;
  citySlug: string;
  cityName: string;
  center: { latitude: number; longitude: number };
  zoom: number;
  activeFestivalYear: number;
  mapTilesUrl: string;
}

type Step = "location" | "update-choice" | "details" | "verify" | "done";

const UPDATE_OPTIONS = [
  { key: "NEW_YEAR", icon: "event", title: "Add this year's information", subtitle: "Theme, dates, photos for the current festival" },
  { key: "PHOTOS", icon: "photo_camera", title: "Add photos", subtitle: "Share photos from this year" },
  { key: "CORRECTION", icon: "edit_note", title: "Correct details", subtitle: "Name, organiser, contact info" },
  { key: "LOCATION", icon: "location_on", title: "Correct location", subtitle: "The pin is in the wrong place" },
] as const;

const emptyDetails = {
  canonicalName: "",
  organizerName: "",
  theme: "",
  description: "",
  address: "",
  locality: "",
  landmark: "",
  publicContact: "",
  parkingInfo: "",
};

// Curated, not free text — a fixed multi-select reads faster than typing
// tags, and keeps the set meaningful. "Family Friendly" deliberately isn't
// here: it described nearly every pandal, so it wasn't actually helping
// anyone filter (see the Explore category chips it used to clutter).
const CATEGORY_OPTIONS = ["Traditional", "Theme / Creative", "Community Pandal", "Eco-Friendly", "Historic"];

const MAX_PHOTOS = 5;
const MAX_PHOTO_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// The full contribution flow from spec §14.2: drop pin (with a live nearby
// check) -> either "it's mine" (update/correction) or continue as new ->
// progressive details -> OTP verify -> pending-review confirmation. Nothing
// here writes a canonical Pandal directly — it always ends in a
// PandalSubmission (spec §14.1).
export function AddPandalFlow({
  cityId,
  citySlug,
  cityName,
  center,
  zoom,
  activeFestivalYear,
  mapTilesUrl,
}: AddPandalFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("location");
  const [coords, setCoords] = useState(center);
  const [nearby, setNearby] = useState<NearbyPandal[]>([]);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeFailed, setGeocodeFailed] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [selectedExisting, setSelectedExisting] = useState<NearbyPandal | null>(null);
  const [updateChoice, setUpdateChoice] = useState<(typeof UPDATE_OPTIONS)[number]["key"] | null>(null);
  const [details, setDetails] = useState(emptyDetails);
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — real visitors never see or fill this
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  const isNewPandal = !selectedExisting;
  const distanceFromCityKm = distanceMeters(coords, center) / 1000;
  const isOutsideServiceArea = distanceFromCityKm > MAX_DISTANCE_FROM_CITY_KM;

  function scheduleNearbyFetch(next: { latitude: number; longitude: number }) {
    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(async () => {
      const results = await fetchNearbyPandals(cityId, next.latitude, next.longitude);
      setNearby(results);
    }, 400);
  }

  const handleMapReady = useCallback(
    (map: MapLibreMap) => {
      mapRef.current = map;
      map.on("moveend", () => {
        const c = map.getCenter();
        const next = { latitude: c.lat, longitude: c.lng };
        setCoords(next);
        scheduleNearbyFetch(next);
        scheduleReverseGeocode(next);
      });
      scheduleNearbyFetch(center);
      scheduleReverseGeocode(center);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Searching a place is an alternative to dragging the pin — flying the map
  // triggers the same 'moveend' handler above, so the nearby-duplicate check
  // and coords state update exactly as if the user had dragged there by hand.
  function handleLocationSelect(result: LocationSearchResult) {
    mapRef.current?.flyTo({ center: [result.longitude, result.latitude], zoom: 16 });
    applyGeocodedDetails(result);
  }

  function applyGeocodedDetails(result: LocationSearchResult) {
    setDetails((prev) => ({
      ...prev,
      locality: result.locality ?? prev.locality,
      address: result.road ?? result.label,
    }));
  }

  // Drag-to-adjust matching Google Maps: the pin stays fixed at screen
  // centre, the map moves under it, and the address fields fill in from
  // reverse geocoding — without this, dragging visibly did nothing and the
  // Continue button stayed disabled since locality/address had nothing to
  // populate them.
  const reverseGeocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleReverseGeocode(next: { latitude: number; longitude: number }) {
    if (reverseGeocodeTimer.current) clearTimeout(reverseGeocodeTimer.current);
    setGeocodeFailed(false);
    reverseGeocodeTimer.current = setTimeout(async () => {
      setGeocoding(true);
      const result = await reverseGeocode(next.latitude, next.longitude);
      setGeocoding(false);
      if (result) applyGeocodedDetails(result);
      // Never leave someone stuck on a disabled Continue button with no
      // explanation — if auto-fill didn't work (provider hiccup, network,
      // whatever), tell them to type it in instead of just looking broken.
      else setGeocodeFailed(true);
    }, 500);
  }

  function pickExisting(candidate: NearbyPandal) {
    setSelectedExisting(candidate);
    setStep("update-choice");
  }

  function continueAsNew() {
    setSelectedExisting(null);
    setStep("details");
  }

  function confirmUpdateChoice() {
    setStep("verify");
  }

  // Mirrors the forward progression so "back" always lands on the step the
  // user actually came from, not just always the first step.
  function goBack() {
    if (step === "location") {
      router.push(`/${citySlug}`);
    } else if (step === "verify") {
      setStep(isNewPandal ? "details" : "update-choice");
    } else {
      setStep("location");
    }
  }

  function submitDetails(event: React.FormEvent) {
    event.preventDefault();
    setStep("verify");
  }

  function toggleCategory(category: string) {
    setCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  }

  // The resolution cap itself is enforced server-side (can't be bypassed) —
  // this is just fast client-side feedback so a rejected file fails
  // instantly instead of after a slow upload.
  async function handlePhotoSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ""; // lets the same file be picked again if removed
    setPhotoError(null);

    for (const file of files) {
      if (photos.length >= MAX_PHOTOS) {
        setPhotoError(`You can add up to ${MAX_PHOTOS} photos.`);
        break;
      }
      if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
        setPhotoError("Only JPEG, PNG, or WebP images are supported.");
        continue;
      }
      if (file.size > MAX_PHOTO_SIZE_BYTES) {
        setPhotoError(`"${file.name}" is larger than ${MAX_PHOTO_SIZE_BYTES / 1024 / 1024}MB.`);
        continue;
      }

      setUploadingPhoto(true);
      const result = await uploadPhoto(file);
      setUploadingPhoto(false);
      if (result.ok && result.photo) {
        setPhotos((prev) => [...prev, result.photo!]);
      } else {
        setPhotoError(result.error ?? "Could not upload photo.");
      }
    }
  }

  function removePhoto(url: string) {
    setPhotos((prev) => prev.filter((p) => p.url !== url));
  }

  async function doSubmit() {
    const submittedData = isNewPandal
      ? {
          canonicalName: details.canonicalName,
          organizerName: details.organizerName || undefined,
          latitude: coords.latitude,
          longitude: coords.longitude,
          address: details.address,
          locality: details.locality,
          landmark: details.landmark || undefined,
          publicContact: details.publicContact || undefined,
          parkingInfo: details.parkingInfo || undefined,
          theme: details.theme || undefined,
          description: details.description || undefined,
          categories,
          photos: photos.map((p) => ({ url: p.url })),
          year: activeFestivalYear,
        }
      : { note: `Requested update: ${updateChoice}` };

    const result = await submitPandal({
      cityId,
      type: isNewPandal ? "NEW_PANDAL" : updateChoice === "CORRECTION" || updateChoice === "LOCATION" ? "CORRECTION" : "UPDATE_PANDAL",
      possiblePandalId: selectedExisting?.id,
      submittedData,
      contributorContact: email,
      website: website || undefined,
    });

    setSubmitting(false);
    if (!result.ok) return setError(result.error ?? "Could not submit");
    setSubmissionId(result.id ?? null);
    setStep("done");
  }

  // Direct-submit path (REQUIRE_VERIFICATION off): no OTP round-trip.
  async function handleSubmitRequest() {
    setSubmitting(true);
    setError(null);
    await doSubmit();
  }

  async function handleSendCode() {
    setSending(true);
    setError(null);
    const result = await sendVerificationCode(email);
    setSending(false);
    if (!result.ok) return setError(result.error ?? "Could not send code");
    setCodeSent(true);
  }

  // OTP path (REQUIRE_VERIFICATION on): confirm the code before submitting.
  async function handleVerifyAndSubmit() {
    setSubmitting(true);
    setError(null);

    const verified = await verifyCode(email, code);
    if (!verified.ok) {
      setSubmitting(false);
      return setError(verified.error ?? "Incorrect code");
    }

    await doSubmit();
  }

  const progress = useMemo(() => {
    const order: Step[] = isNewPandal ? ["location", "details", "verify"] : ["location", "update-choice", "verify"];
    const index = order.indexOf(step === "done" ? "verify" : step);
    return { index: index === -1 ? 0 : index, total: order.length };
  }, [step, isNewPandal]);

  // Non-location steps are a single scrollable form — full width reads fine
  // on mobile, but needs an explicit constrained column on desktop instead of
  // inputs stretching edge to edge; wrapped in a card there so it doesn't
  // just look like the mobile page centered.
  const formStepClass =
    "flex flex-col gap-4 px-4 pt-6 md:mx-auto md:mt-6 md:max-w-xl md:rounded-3xl md:border md:border-border md:bg-panel md:p-8 md:pt-8";

  // One header for every step (location included) — the previous version
  // only rendered this for steps after "location", which is exactly why the
  // first screen had no back button and no visible chrome at all.
  const headerBlock = step !== "done" && (
    <div className="flex flex-col gap-3 px-4 pb-3 pt-4 md:mx-auto md:max-w-xl">
      <div className="flex items-center justify-between">
        <button onClick={goBack} className="flex h-10 w-10 items-center justify-center rounded-full bg-card">
          <span className="material-symbols-rounded">arrow_back</span>
        </button>
        <span className="font-body text-sm font-bold">Add your pandal</span>
        <span className="font-mono text-xs text-ink-muted">
          {progress.index + 1}/{progress.total}
        </span>
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${progress.total}, 1fr)` }}>
        {Array.from({ length: progress.total }).map((_, i) => (
          <div key={i} className={`h-1 rounded-full ${i <= progress.index ? "bg-brand" : "bg-chip"}`} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="relative min-h-dvh bg-ground pb-24">
      {headerBlock}

      {step === "location" && (
        <div className="flex flex-col md:h-[600px] md:flex-row-reverse">
          {/* DOM order is [map, panel] so mobile (flex-col, no reverse) stacks
              map-on-top/panel-below like the design; md:flex-row-reverse then
              flips it to panel-left/map-right on desktop, matching the
              Google Maps "add a place" split — both from the same markup. */}
          <div className="relative h-[360px] w-full flex-none overflow-hidden md:h-full md:flex-1">
            <MapCanvas styleUrl={mapTilesUrl} center={center} zoom={zoom} onMapReady={handleMapReady} className="absolute inset-0" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full flex flex-col items-center">
              <span className="mb-1.5 rounded-xl bg-accent px-2.5 py-1 font-body text-xs font-bold text-accent-ink shadow">
                Your pandal · drag map to adjust
              </span>
              <span className="material-symbols-rounded text-[38px] text-accent" style={{ fontVariationSettings: "'FILL' 1" }}>
                add_location
              </span>
            </div>
            <div className="absolute inset-x-3 top-3 z-10 md:max-w-[420px]">
              <LocationSearchBox citySlug={citySlug} placeholder="Search your pandal's area" onSelect={handleLocationSelect} biasCenter={coords} />
            </div>
          </div>

          <div className="flex flex-col gap-4 px-4 pt-5 md:w-[420px] md:flex-none md:overflow-y-auto md:border-l md:border-border md:pt-6">
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="Locality / area"
                value={details.locality}
                onChange={(e) => setDetails({ ...details, locality: e.target.value })}
                className="h-12 rounded-2xl border border-border bg-panel px-4 font-body md:bg-card"
              />
              <input
                placeholder="Landmark (optional)"
                value={details.landmark}
                onChange={(e) => setDetails({ ...details, landmark: e.target.value })}
                className="h-12 rounded-2xl border border-border bg-panel px-4 font-body md:bg-card"
              />
            </div>
            <input
              placeholder="Address"
              value={details.address}
              onChange={(e) => setDetails({ ...details, address: e.target.value })}
              className="h-12 rounded-2xl border border-border bg-panel px-4 font-body md:bg-card"
            />

            {geocoding && (
              <span className="flex items-center gap-1.5 font-body text-xs text-ink-muted">
                <span className="material-symbols-rounded animate-spin text-sm">progress_activity</span>
                Locating…
              </span>
            )}
            {!geocoding && geocodeFailed && !details.locality && !details.address && (
              <span className="flex items-center gap-1.5 font-body text-xs text-accent">
                <span className="material-symbols-rounded text-sm">info</span>
                Couldn't auto-fill from the map — type your locality and address above.
              </span>
            )}

            <div className="flex flex-col gap-2 rounded-3xl border border-border bg-panel p-4 md:bg-card/60">
              <div className="flex flex-col gap-1">
                <span className="font-display text-lg font-extrabold">Is your pandal already here?</span>
                <span className="font-body text-sm text-ink-muted">
                  {nearby.length > 0
                    ? `We found ${nearby.length} pandal${nearby.length > 1 ? "s" : ""} near your pin.`
                    : "No existing pandals found near this pin."}
                </span>
              </div>
              {nearby.map((candidate) => (
                <div key={candidate.id} className="flex items-center gap-3 rounded-2xl bg-card p-2.5 md:bg-panel">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-body text-sm font-bold">{candidate.canonicalName}</span>
                    <span className="truncate font-body text-xs text-ink-muted">{candidate.locality}</span>
                  </div>
                  <button
                    onClick={() => pickExisting(candidate)}
                    className="rounded-xl border-[1.5px] border-brand px-3 py-2 font-body text-xs font-bold text-brand"
                  >
                    It's mine
                  </button>
                </div>
              ))}
              {isOutsideServiceArea && (
                <span className="flex items-center gap-1.5 rounded-2xl bg-card p-2.5 font-body text-xs text-accent md:bg-panel">
                  <span className="material-symbols-rounded text-base">location_off</span>
                  That pin is {Math.round(distanceFromCityKm)}km from {cityName} — we only cover pandals in and
                  around {cityName} right now.
                </span>
              )}
              <Button
                onClick={continueAsNew}
                disabled={!details.locality || !details.address || isOutsideServiceArea}
                className="mt-1 flex items-center justify-center gap-1.5"
              >
                None of these — continue
                <span className="material-symbols-rounded text-lg">arrow_forward</span>
              </Button>
            </div>
          </div>

        </div>
      )}

      {step === "update-choice" && selectedExisting && (
        <div className={formStepClass}>
          <div className="flex items-center gap-3 rounded-3xl border border-border bg-panel p-3 md:bg-card">
            <div className="h-14 w-14 flex-none rounded-2xl bg-chip" />
            <div className="flex flex-col">
              <span className="font-body font-bold">{selectedExisting.canonicalName}</span>
              <span className="font-body text-sm text-ink-muted">{selectedExisting.locality}, {cityName}</span>
            </div>
          </div>
          <h2 className="font-display text-2xl font-extrabold">What would you like to update?</h2>
          <div className="flex flex-col gap-2">
            {UPDATE_OPTIONS.map((option) => (
              <button
                key={option.key}
                onClick={() => setUpdateChoice(option.key)}
                className={`flex items-center gap-3 rounded-2xl p-3 text-left ${
                  updateChoice === option.key ? "bg-card ring-2 ring-brand" : "bg-panel md:bg-card/60"
                }`}
              >
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-chip">
                  <span className="material-symbols-rounded text-brand">{option.icon}</span>
                </span>
                <span className="flex flex-col">
                  <span className="font-body text-[15.5px] font-bold">{option.title}</span>
                  <span className="font-body text-xs text-ink-muted">{option.subtitle}</span>
                </span>
              </button>
            ))}
          </div>
          <Button onClick={confirmUpdateChoice} disabled={!updateChoice}>
            Continue
          </Button>
        </div>
      )}

      {step === "details" && (
        <form onSubmit={submitDetails} className={formStepClass}>
          <h2 className="font-display text-2xl font-extrabold">Tell us about your pandal</h2>

          <div className="flex flex-col gap-3 rounded-3xl border border-border bg-panel p-4 md:bg-card/60">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-chip">
                <span className="material-symbols-rounded text-brand">storefront</span>
              </span>
              <span className="font-display text-base font-bold">Basics</span>
            </div>
            <input
              required
              placeholder="Pandal name"
              value={details.canonicalName}
              onChange={(e) => setDetails({ ...details, canonicalName: e.target.value })}
              className="h-13 rounded-2xl border border-border bg-panel px-4 font-body md:bg-card"
            />
            <input
              placeholder="Organiser / committee · optional"
              value={details.organizerName}
              onChange={(e) => setDetails({ ...details, organizerName: e.target.value })}
              className="h-13 rounded-2xl border border-border bg-panel px-4 font-body md:bg-card"
            />
          </div>

          <div className="flex flex-col gap-3 rounded-3xl border border-accent/20 bg-gradient-to-br from-[#2A1B2C] to-[#1E1726] p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-chip">
                <span className="material-symbols-rounded text-accent">palette</span>
              </span>
              <span className="font-display text-base font-bold">Theme for {activeFestivalYear}</span>
              <span className="ml-auto font-body text-xs text-ink-muted">optional</span>
            </div>
            <input
              placeholder="Theme name — e.g. Rural Bengal"
              value={details.theme}
              onChange={(e) => setDetails({ ...details, theme: e.target.value })}
              className="h-13 rounded-2xl border border-border bg-panel px-4 font-body md:bg-card"
            />
            <textarea
              placeholder="Theme details — what makes it worth visiting?"
              value={details.description}
              onChange={(e) => setDetails({ ...details, description: e.target.value })}
              className="min-h-24 rounded-2xl border border-border bg-panel px-4 py-3 font-body md:bg-card"
            />
          </div>

          <div className="flex flex-col gap-3 rounded-3xl border border-border bg-panel p-4 md:bg-card/60">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-chip">
                <span className="material-symbols-rounded text-brand">photo_camera</span>
              </span>
              <span className="font-display text-base font-bold">Photos</span>
              <span className="ml-auto font-body text-xs text-ink-muted">optional · up to {MAX_PHOTOS}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {photos.map((photo) => (
                <div key={photo.url} className="relative h-20 w-20 flex-none overflow-hidden rounded-xl bg-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.url)}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ground/80"
                  >
                    <span className="material-symbols-rounded text-xs">close</span>
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <label className="flex h-20 w-20 flex-none cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-ink-muted">
                  {uploadingPhoto ? (
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
                    disabled={uploadingPhoto}
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            {photoError && <p className="font-body text-xs text-brand">{photoError}</p>}
          </div>

          <div className="flex flex-col gap-3 rounded-3xl border border-border bg-panel p-4 md:bg-card/60">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-chip">
                <span className="material-symbols-rounded text-brand">sell</span>
              </span>
              <span className="font-display text-base font-bold">Categories</span>
              <span className="ml-auto font-body text-xs text-ink-muted">optional</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((category) => {
                const isActive = categories.includes(category);
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className={`rounded-pill border px-3 py-1.5 font-body text-sm font-semibold transition-colors ${
                      isActive ? "border-brand bg-brand text-brand-ink" : "border-border bg-card text-ink-dim"
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-3xl border border-border bg-panel p-4 md:bg-card/60">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-chip">
                <span className="material-symbols-rounded text-brand">local_parking</span>
              </span>
              <span className="font-display text-base font-bold">Good to know</span>
              <span className="ml-auto font-body text-xs text-ink-muted">optional</span>
            </div>
            <input
              placeholder="Parking — e.g. Street parking available near the entrance"
              value={details.parkingInfo}
              onChange={(e) => setDetails({ ...details, parkingInfo: e.target.value })}
              className="h-13 rounded-2xl border border-border bg-panel px-4 font-body md:bg-card"
            />
            <input
              placeholder="Public contact number"
              value={details.publicContact}
              onChange={(e) => setDetails({ ...details, publicContact: e.target.value })}
              className="h-13 rounded-2xl border border-border bg-panel px-4 font-body md:bg-card"
            />
          </div>

          <Button type="submit" disabled={!details.canonicalName}>
            Continue
          </Button>
        </form>
      )}

      {step === "verify" && (
        <div className={formStepClass.replace("gap-4", "gap-5")}>
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-[28px] font-extrabold leading-tight">
              {REQUIRE_VERIFICATION ? "Quick check it's you" : "How can we reach you?"}
            </h2>
            <p className="font-body text-sm text-ink-muted">
              {REQUIRE_VERIFICATION
                ? "We only use this to confirm your submission and reach you if we have questions. No account, no newsletters."
                : "We only use this to reach you if we have questions about your submission. No account, no newsletters."}
            </p>
          </div>
          <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-panel p-3.5 md:bg-card">
            <span className="material-symbols-rounded text-ink-muted">mail</span>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              disabled={REQUIRE_VERIFICATION && codeSent}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 bg-transparent font-body outline-none"
            />
            {REQUIRE_VERIFICATION && codeSent && (
              <button className="font-body text-sm font-bold text-brand" onClick={() => setCodeSent(false)}>
                Change
              </button>
            )}
          </div>

          {/* Honeypot — hidden from real visitors via CSS, off the tab order,
              and skipped by screen readers; a script that fills every field
              it finds trips this instead of a real one. */}
          <input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
          />

          {!REQUIRE_VERIFICATION && (
            <Button onClick={handleSubmitRequest} disabled={submitting || !email}>
              {submitting ? "Submitting…" : "Submit request"}
            </Button>
          )}

          {REQUIRE_VERIFICATION && !codeSent && (
            <Button onClick={handleSendCode} disabled={sending || !email}>
              {sending ? "Sending…" : "Send code"}
            </Button>
          )}

          {REQUIRE_VERIFICATION && codeSent && (
            <>
              <label className="flex flex-col gap-2">
                <span className="font-body text-xs font-semibold text-ink-muted">Enter the 6-digit code we sent</span>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="h-16 rounded-2xl border border-border bg-panel text-center font-mono text-2xl tracking-[0.4em] md:bg-card"
                  placeholder="000000"
                />
              </label>
              <Button onClick={handleVerifyAndSubmit} disabled={submitting || code.length !== 6}>
                {submitting ? "Submitting…" : "Verify & submit"}
              </Button>
            </>
          )}

          {error && <p className="font-body text-sm text-brand">{error}</p>}
        </div>
      )}

      {step === "done" && (
        <div className="flex flex-col items-center gap-5 px-6 pt-20 text-center md:mx-auto md:max-w-md md:rounded-3xl md:border md:border-border md:bg-panel md:pb-10 md:pt-16">
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-brand">
            <span className="material-symbols-rounded text-5xl text-brand-ink" style={{ fontVariationSettings: "'FILL' 1" }}>
              check
            </span>
          </span>
          <h2 className="font-display text-[30px] font-extrabold">Shubho! It's in the queue.</h2>
          <p className="font-body text-ink-dim">
            Every listing is checked before it appears on the {cityName} map. We'll email you only if something needs a fix.
          </p>
          {submissionId && <p className="font-mono text-xs text-ink-muted">#{submissionId.slice(-6)}</p>}
          <div className="mt-4 flex w-full flex-col gap-2.5">
            <Button onClick={() => router.push(`/${citySlug}`)}>Back to map</Button>
            <Button
              variant="secondary"
              onClick={() => {
                setStep("location");
                setSelectedExisting(null);
                setUpdateChoice(null);
                setDetails(emptyDetails);
                setEmail("");
                setCode("");
                setCodeSent(false);
                setWebsite("");
                setCategories([]);
                setPhotos([]);
                setPhotoError(null);
                setSubmissionId(null);
              }}
            >
              Add another pandal
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
