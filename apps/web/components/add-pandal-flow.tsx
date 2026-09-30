"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import { MapCanvas } from "@durgapandals/maps/react";
import { Button, Field, Input, Select, Textarea, useToast } from "@durgapandals/ui";
import {
  fetchNearbyPandals,
  reverseGeocode,
  sendVerificationCode,
  verifyCode,
  submitPandal,
  uploadPhoto,
  deletePhoto,
  type NearbyPandal,
  type LocationSearchResult,
  type UploadedPhoto,
} from "@/lib/api";
import { LocationSearchBox } from "./location-search-box";
import { MobileHeader } from "./mobile-header";
import { getAvailableFestivalYears } from "@/lib/festival-years";

// OTP verification is off by default (contributors submit directly) but the
// code path stays in place — flip this back on with
// NEXT_PUBLIC_REQUIRE_CONTRIBUTOR_VERIFICATION=true (and the matching
// server-side REQUIRE_CONTRIBUTOR_VERIFICATION on the API) to require it
// again without restoring any deleted code.
const REQUIRE_VERIFICATION = process.env.NEXT_PUBLIC_REQUIRE_CONTRIBUTOR_VERIFICATION === "true";

export interface AddPandalFlowProps {
  cityId: string;
  citySlug: string;
  cityName: string;
  center: { latitude: number; longitude: number };
  zoom: number;
  activeFestivalYear: number;
  mapTilesUrl: string;
}

type Step = "location" | "details" | "verify" | "done";

const emptyDetails = {
  canonicalName: "",
  organizerName: "",
  theme: "",
  description: "",
  address: "",
  locality: "",
  landmark: "",
  publicContact: "",
};

// Curated, not free text — a fixed multi-select reads faster than typing
// tags, and keeps the set meaningful. "Family Friendly" deliberately isn't
// here: it described nearly every pandal, so it wasn't actually helping
// anyone filter (see the Explore category chips it used to clutter).
const CATEGORY_OPTIONS = ["Traditional", "Theme / Creative", "Community Pandal", "Eco-Friendly", "Historic"];

const VISIT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "WALKING_DARSHAN", label: "Walking darshan · quick visit" },
  { value: "PARK_AND_VISIT", label: "Park & visit" },
  { value: "DARSHAN_AND_GO", label: "Darshan & go" },
];

const emptyAmenities = {
  parkingAvailable: false,
  twoWheelerAccessible: false,
  fourWheelerAccessible: false,
  foodStallsNearby: false,
  streetShopsNearby: false,
};

type ScheduleRow = { time: string; label: string };

const SCHEDULE_HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const SCHEDULE_MINUTES = ["00", "15", "30", "45"];
const SCHEDULE_PERIODS = ["AM", "PM"] as const;

// `ScheduleRow.time` is still stored (and displayed elsewhere, e.g.
// pandal-detail's schedule list) as a plain "7:00 PM"-style string, so the
// hour/minute/AM-PM dropdowns below parse it in and compose it back out
// rather than changing the stored shape — free text just let people type
// anything unparseable ("evening", "7ish"), which this closes off.
function parseScheduleTime(time: string): { hour: string; minute: string; period: (typeof SCHEDULE_PERIODS)[number] } {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time.trim());
  if (!match) return { hour: "7", minute: "00", period: "PM" };
  const [rawHour, rawMinute, rawPeriod] = [match[1]!, match[2]!, match[3]!];
  const hour = String(Math.min(12, Math.max(1, Number(rawHour))));
  const minute = SCHEDULE_MINUTES.includes(rawMinute) ? rawMinute : "00";
  const period = rawPeriod.toUpperCase() === "AM" ? "AM" : "PM";
  return { hour, minute, period };
}

function formatScheduleTime(hour: string, minute: string, period: string): string {
  return `${hour}:${minute} ${period}`;
}

const MAX_PHOTOS = 5;
const MAX_PHOTO_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Everything worth resuming after an accidental refresh/back-nav/tab-close —
// deliberately excludes transient/re-derivable state (nearby results,
// geocoding flags, the OTP code) and anything already-submitted (`step:
// "done"` is never saved, see the write-back effect below). sessionStorage,
// not localStorage: a half-finished submission (with an email address in
// it) shouldn't silently persist across browser restarts indefinitely — it
// only needs to survive the same tab/session.
interface AddPandalDraft {
  step: Step;
  coords: { latitude: number; longitude: number };
  categories: string[];
  photos: UploadedPhoto[];
  details: typeof emptyDetails;
  festivalYear: number;
  amenities: typeof emptyAmenities;
  visitType: string;
  schedule: ScheduleRow[];
  email: string;
}

function draftKey(citySlug: string): string {
  return `durgapandals_add_pandal_draft:${citySlug}`;
}

function loadDraft(citySlug: string): AddPandalDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(draftKey(citySlug));
    return raw ? (JSON.parse(raw) as AddPandalDraft) : null;
  } catch {
    return null;
  }
}

function saveDraft(citySlug: string, draft: AddPandalDraft) {
  try {
    window.sessionStorage.setItem(draftKey(citySlug), JSON.stringify(draft));
  } catch {
    // sessionStorage full/unavailable (private browsing) — losing autosave
    // isn't worth surfacing an error over.
  }
}

function clearDraft(citySlug: string) {
  window.sessionStorage.removeItem(draftKey(citySlug));
}

// The contribution flow from spec §14.2: drop pin (with a live nearby check,
// purely informational — see below) -> progressive details -> OTP verify ->
// pending-review confirmation. Nothing here writes a canonical Pandal
// directly — it always ends in a PandalSubmission (spec §14.1).
//
// This used to also offer "it's mine" on any nearby pandal, jumping into an
// update/correction path — removed because it let any anonymous visitor
// claim any existing pandal and submit only a fixed category label (no real
// content), which even on admin approval never actually changed anything.
// Updating or reporting an issue on an *existing* pandal now lives on that
// pandal's own detail page instead (see report-pandal-flow.tsx), where it
// captures an actual description instead of a bare label.
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
  const toast = useToast();
  // Computed once per mount, not on every render — this is the only place
  // any of the fields below read it.
  const [initialDraft] = useState(() => loadDraft(citySlug));
  const [draftRestored, setDraftRestored] = useState(() => initialDraft !== null);
  const [step, setStep] = useState<Step>(initialDraft?.step ?? "location");
  const [coords, setCoords] = useState(initialDraft?.coords ?? center);
  // The map/search/locate-me pin only ever moves this — never `coords` or
  // `details` directly. Those only change when "Use this location" commits
  // them together (see useThisLocation below). This is exactly the pattern
  // admin's LocationPicker already used (apps/admin/components/location-picker.tsx):
  // without it, every stray drag silently overwrote the address fields with
  // wherever the pin currently was, with no checkpoint where a visitor could
  // actually see and confirm "yes, this resolved address is right" before
  // it became part of the submission.
  const [pendingCoords, setPendingCoords] = useState(initialDraft?.coords ?? center);
  const [pendingAddress, setPendingAddress] = useState<LocationSearchResult | null>(null);
  const [nearby, setNearby] = useState<NearbyPandal[]>([]);
  const [nearbyCheckFailed, setNearbyCheckFailed] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeFailed, setGeocodeFailed] = useState(false);
  const [categories, setCategories] = useState<string[]>(initialDraft?.categories ?? []);
  const [photos, setPhotos] = useState<UploadedPhoto[]>(initialDraft?.photos ?? []);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [details, setDetails] = useState(initialDraft?.details ?? emptyDetails);
  const [festivalYear, setFestivalYear] = useState(initialDraft?.festivalYear ?? activeFestivalYear);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [searchingArea, setSearchingArea] = useState(false);
  const [amenities, setAmenities] = useState(initialDraft?.amenities ?? emptyAmenities);
  const [visitType, setVisitType] = useState(initialDraft?.visitType ?? "WALKING_DARSHAN");
  const [schedule, setSchedule] = useState<ScheduleRow[]>(initialDraft?.schedule ?? []);
  const [email, setEmail] = useState(initialDraft?.email ?? "");
  const [website, setWebsite] = useState(""); // honeypot — real visitors never see or fill this
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const nearbyMarkersRef = useRef<maplibregl.Marker[]>([]);
  const coordsRef = useRef(coords);
  coordsRef.current = coords;

  const hasPendingMove = pendingCoords.latitude !== coords.latitude || pendingCoords.longitude !== coords.longitude;

  // Autosaves the in-progress submission so a refresh, accidental back-nav,
  // or closed tab doesn't lose it — debounced so typing doesn't write on
  // every keystroke. Cleared once the flow reaches "done" (see doSubmit)
  // rather than saved, since a completed submission has nothing left to
  // resume.
  useEffect(() => {
    if (step === "done") return;
    const timeout = setTimeout(() => {
      saveDraft(citySlug, {
        step,
        coords,
        categories,
        photos,
        details,
        festivalYear,
        amenities,
        visitType,
        schedule,
        email,
      });
    }, 400);
    return () => clearTimeout(timeout);
  }, [citySlug, step, coords, categories, photos, details, festivalYear, amenities, visitType, schedule, email]);

  // The draft is being resumed, not started fresh — deletes any photos it
  // was holding (they'd otherwise be orphaned the moment the form resets
  // under them) and wipes the saved draft, same cleanup a completed
  // submission gets, just triggered by the visitor instead of a successful
  // POST.
  function discardDraft() {
    photos.forEach((photo) => void deletePhoto(photo.url));
    clearDraft(citySlug);
    setDraftRestored(false);
    setStep("location");
    setCoords(center);
    setPendingCoords(center);
    setPendingAddress(null);
    setDetails(emptyDetails);
    setCategories([]);
    setPhotos([]);
    setFestivalYear(activeFestivalYear);
    setAmenities(emptyAmenities);
    setVisitType("WALKING_DARSHAN");
    setSchedule([]);
    setEmail("");
  }

  function scheduleNearbyFetch(next: { latitude: number; longitude: number }) {
    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(async () => {
      try {
        const results = await fetchNearbyPandals(cityId, next.latitude, next.longitude);
        setNearby(results);
        setNearbyCheckFailed(false);
      } catch {
        // A failed check must not look identical to "checked, found
        // nothing" — that's exactly the gap that lets someone submit a
        // real duplicate believing the app already looked and found none.
        setNearbyCheckFailed(true);
      }
    }, 400);
  }

  const handleMapReady = useCallback(
    (map: MapLibreMap) => {
      mapRef.current = map;
      map.on("moveend", () => {
        const c = map.getCenter();
        const next = { latitude: c.lat, longitude: c.lng };
        setPendingCoords(next);
        scheduleNearbyFetch(next);
        scheduleReverseGeocode(next);
      });
      // `coordsRef`, not the fixed `center` prop — this callback is memoized
      // once (deps: []) but fires again on every remount of the map (see the
      // `coords`-as-center comment above), so a stale closure over `center`
      // would run the initial nearby/geocode check for the *original* city
      // center instead of wherever the map is actually now starting.
      scheduleNearbyFetch(coordsRef.current);
      scheduleReverseGeocode(coordsRef.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Searching a place is an alternative to dragging the pin — flying the map
  // triggers the same 'moveend' handler above, so the nearby-duplicate check
  // and pending-address preview update exactly as if the user had dragged
  // there by hand. The search result already carries a resolved address, so
  // there's no need to wait on a separate reverse-geocode call for it.
  function handleLocationSelect(result: LocationSearchResult) {
    mapRef.current?.flyTo({ center: [result.longitude, result.latitude], zoom: 16 });
    setPendingCoords({ latitude: result.latitude, longitude: result.longitude });
    setPendingAddress(result);
    setGeocodeFailed(false);
  }

  // The one and only place a map move ever reaches the actual submission —
  // current vs pending are always shown side by side (see the confirm bar
  // below) so it's never ambiguous which address is currently committed.
  function useThisLocation() {
    setCoords(pendingCoords);
    if (pendingAddress) {
      // Always overwrite from the confirmed pin position, even with an
      // empty string — falling back to `prev.locality` here would leave a
      // moved pin showing the *previous* location's locality with no sign
      // it's stale.
      setDetails((prev) => ({
        ...prev,
        locality: pendingAddress.locality ?? "",
        address: pendingAddress.road ?? pendingAddress.label,
      }));
    }
  }

  // Drag-to-adjust matching Google Maps: the pin stays fixed at screen
  // centre, the map moves under it, and a preview address resolves below —
  // without this, dragging visibly did nothing and there was no feedback at
  // all until "Use this location" was clicked.
  const reverseGeocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleReverseGeocode(next: { latitude: number; longitude: number }) {
    if (reverseGeocodeTimer.current) clearTimeout(reverseGeocodeTimer.current);
    setGeocodeFailed(false);
    setPendingAddress(null);
    reverseGeocodeTimer.current = setTimeout(async () => {
      setGeocoding(true);
      const result = await reverseGeocode(next.latitude, next.longitude);
      setGeocoding(false);
      if (result) setPendingAddress(result);
      // Never leave someone stuck with no explanation — if the preview
      // didn't resolve (provider hiccup, network, whatever), tell them to
      // type it in instead of just looking broken.
      else setGeocodeFailed(true);
    }, 500);
  }

  // "Search this area" (Google-Maps pattern) — re-runs the nearby-duplicate
  // check and reverse geocode for the map's current center on click, instead
  // of relying only on the debounced moveend handler above.
  function searchThisArea() {
    const map = mapRef.current;
    if (!map) return;
    setSearchingArea(true);
    const c = map.getCenter();
    const next = { latitude: c.lat, longitude: c.lng };
    setPendingCoords(next);
    scheduleNearbyFetch(next);
    scheduleReverseGeocode(next);
    setTimeout(() => setSearchingArea(false), 500);
  }

  // Geolocation alongside the existing drag-the-map-pin flow (spec §3) —
  // permission-denied gets a visible message instead of failing silently.
  function locateMe() {
    if (!navigator.geolocation) {
      setLocationError("Location isn't available on this device.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        mapRef.current?.flyTo({ center: [next.longitude, next.latitude], zoom: 16 });
        setPendingCoords(next);
        scheduleNearbyFetch(next);
        scheduleReverseGeocode(next);
      },
      (err) => {
        setLocating(false);
        setLocationError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — drag the map to your pandal instead."
            : "Couldn't get your location — drag the map to your pandal instead."
        );
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function toggleAmenity(key: keyof typeof emptyAmenities) {
    setAmenities((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function addScheduleRow() {
    setSchedule((prev) => [...prev, { time: formatScheduleTime("7", "00", "PM"), label: "" }]);
  }

  function updateScheduleRow(index: number, field: keyof ScheduleRow, value: string) {
    setSchedule((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function removeScheduleRow(index: number) {
    setSchedule((prev) => prev.filter((_, i) => i !== index));
  }

  // Plots whatever the live proximity check just found — same marker style
  // used everywhere else in the app, so it's immediately readable as "an
  // existing pandal is right here" before someone adds a duplicate. Purely
  // informational: tapping one opens that pandal's own page in a new tab
  // (where "Suggest an edit" lives, see report-pandal-flow.tsx) rather than
  // claiming/updating it from here — see the flow comment above for why.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    nearbyMarkersRef.current.forEach((marker) => marker.remove());
    nearbyMarkersRef.current = nearby.map((candidate) => {
      const el = document.createElement("a");
      el.href = `/${citySlug}/pandal/${candidate.slug}`;
      el.target = "_blank";
      el.rel = "noopener noreferrer";
      el.setAttribute("aria-label", candidate.canonicalName);
      el.style.display = "block";
      el.style.width = "26px";
      el.style.height = "26px";
      el.style.cursor = "pointer";
      el.innerHTML = '<img src="/images/marker-icon.svg" alt="" style="width:26px;height:26px" />';
      return new maplibregl.Marker({ element: el })
        .setLngLat([candidate.longitude, candidate.latitude])
        .addTo(map);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearby, citySlug]);

  function continueAsNew() {
    setStep("details");
  }

  // Mirrors the forward progression so "back" always lands on the step the
  // user actually came from, not just always the first step.
  function goBack() {
    if (step === "location") {
      router.push(`/${citySlug}`);
    } else if (step === "verify") {
      setStep("details");
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
        const message = result.error ?? "Could not upload photo.";
        setPhotoError(message);
        toast.error(message);
      }
    }
  }

  // Each photo is uploaded to Cloudinary immediately on selection (so the
  // thumbnail/progress state has something real to show), well before the
  // submission that would actually reference it — removing one here left it
  // orphaned in storage forever with nothing pointing to it. Deleting it now
  // is best-effort/fire-and-forget: the UI has already dropped it from
  // `photos`, so there's nothing to roll back to if the delete call fails.
  function removePhoto(url: string) {
    setPhotos((prev) => prev.filter((p) => p.url !== url));
    void deletePhoto(url);
  }

  async function doSubmit() {
    const submittedData = {
      canonicalName: details.canonicalName,
      organizerName: details.organizerName || undefined,
      latitude: coords.latitude,
      longitude: coords.longitude,
      address: details.address,
      locality: details.locality,
      landmark: details.landmark || undefined,
      publicContact: details.publicContact || undefined,
      theme: details.theme || undefined,
      description: details.description || undefined,
      categories,
      photos: photos.map((p) => ({ url: p.url })),
      year: festivalYear,
      ...amenities,
      visitType,
      schedule: schedule.filter((row) => row.time && row.label),
    };

    const result = await submitPandal({
      cityId,
      type: "NEW_PANDAL",
      submittedData,
      contributorContact: email,
      website: website || undefined,
    });

    setSubmitting(false);
    if (!result.ok) {
      const message = result.error ?? "Could not submit";
      setError(message);
      toast.error(message);
      return;
    }
    setSubmissionId(result.id ?? null);
    setStep("done");
    clearDraft(citySlug);
    toast.success("Shubho! Your pandal is in the queue.");
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
    const order: Step[] = ["location", "details", "verify"];
    const index = order.indexOf(step === "done" ? "verify" : step);
    return { index: index === -1 ? 0 : index, total: order.length };
  }, [step]);

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
        {/* Back arrow: mobile only — desktop relies on the persistent top
            nav bar instead, matching the design. */}
        <button onClick={goBack} className="flex h-10 w-10 items-center justify-center rounded-full bg-card md:hidden">
          <span className="material-symbols-rounded">arrow_back</span>
        </button>
        <MobileHeader citySlug={citySlug} cityName={cityName} year={activeFestivalYear} className="md:hidden" />
        <span className="hidden font-body text-sm font-bold md:inline">Add your pandal</span>
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

      {draftRestored && step !== "done" && (
        <div className="mx-4 mb-1 flex items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent/10 px-3.5 py-2.5 md:mx-auto md:max-w-xl">
          <span className="font-body text-xs text-ink-dim">Resumed your in-progress submission.</span>
          <div className="flex flex-none items-center gap-3">
            <button onClick={discardDraft} className="font-body text-xs font-bold text-brand">
              Start over
            </button>
            <button onClick={() => setDraftRestored(false)} aria-label="Dismiss" className="flex text-ink-muted">
              <span className="material-symbols-rounded text-base">close</span>
            </button>
          </div>
        </div>
      )}

      {step === "location" && (
        <div className="flex flex-col md:h-[600px] md:flex-row-reverse">
          {/* DOM order is [map, panel] so mobile (flex-col, no reverse) stacks
              map-on-top/panel-below like the design; md:flex-row-reverse then
              flips it to panel-left/map-right on desktop, matching the
              Google Maps "add a place" split — both from the same markup. */}
          <div className="relative h-[360px] w-full flex-none overflow-hidden md:h-full md:flex-1">
            {/* `coords`, not the fixed `center` prop — MapCanvas only reads
                its `center` at mount time (see packages/maps/src/react), and
                this step's subtree unmounts/remounts on every trip through
                "details" and back (see `goBack`). Passing the city's fixed
                center here meant the map visually snapped back to it on
                return, even though `coords` (and the nearby/geocode results
                tied to it) had already moved with the visitor's drag. */}
            <MapCanvas styleUrl={mapTilesUrl} center={coords} zoom={zoom} onMapReady={handleMapReady} className="absolute inset-0" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full flex flex-col items-center">
              <span className="mb-1.5 rounded-xl bg-accent px-2.5 py-1 font-body text-xs font-bold text-accent-ink shadow">
                Your pandal · drag map to adjust
              </span>
              <span className="material-symbols-rounded text-[38px] text-accent" style={{ fontVariationSettings: "'FILL' 1" }}>
                add_location
              </span>
            </div>
            <div className="absolute inset-x-3 top-3 z-10 md:max-w-[420px]">
              <LocationSearchBox citySlug={citySlug} placeholder="Search your pandal's area" onSelect={handleLocationSelect} biasCenter={pendingCoords} />
            </div>
            <button
              onClick={searchThisArea}
              disabled={searchingArea}
              className="absolute bottom-3 left-1/2 z-10 flex h-8 -translate-x-1/2 items-center gap-1 rounded-pill bg-ground/80 pl-2.5 pr-3 font-body text-xs font-bold text-ink shadow-lg disabled:opacity-70"
            >
              <span className="material-symbols-rounded text-base">{searchingArea ? "sync" : "search"}</span>
              {searchingArea ? "Searching…" : "Search this area"}
            </button>

            {/* The only place a drag/search/locate ever reaches the actual
                form — pending vs confirmed are always shown side by side so
                it's never ambiguous which address is currently committed.
                Same pattern as admin's LocationPicker. */}
            {hasPendingMove && (
              <div className="absolute inset-x-3 bottom-14 z-10 flex items-center justify-between gap-2 rounded-2xl bg-panel/95 px-3.5 py-2.5 shadow-2xl">
                <span className="flex min-w-0 items-start gap-1.5 font-body text-xs text-accent">
                  <span className="material-symbols-rounded flex-none text-sm">pin_drop</span>
                  <span className="truncate">
                    {geocoding ? "Resolving address…" : pendingAddress ? pendingAddress.label : "Couldn't resolve — type the address manually"}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={useThisLocation}
                  className="flex-none rounded-xl bg-brand px-3 py-1.5 font-body text-xs font-bold text-brand-ink"
                >
                  Use this location
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 px-4 pt-5 md:w-[420px] md:flex-none md:overflow-y-auto md:border-l md:border-border md:pt-6">
            <button
              onClick={locateMe}
              disabled={locating}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-brand px-3 font-body text-sm font-bold text-brand-ink disabled:opacity-70"
            >
              <span className="material-symbols-rounded text-lg">{locating ? "sync" : "my_location"}</span>
              {locating ? "Locating…" : "Use my current location"}
            </button>
            {locationError && (
              <span className="flex items-center gap-1.5 font-body text-xs text-accent">
                <span className="material-symbols-rounded text-sm">info</span>
                {locationError}
              </span>
            )}

            <span className="font-body text-xs font-extrabold tracking-wide text-accent">BASIC DETAILS</span>

            <Field label="Festival year">
              <Select value={String(festivalYear)} onChange={(e) => setFestivalYear(Number(e.target.value))}>
                {getAvailableFestivalYears().map((year) => (
                  <option key={year} value={year}>
                    {year}
                    {year === activeFestivalYear ? " (current)" : ""}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Locality / area">
                <Input
                  placeholder="e.g. Kumartuli"
                  value={details.locality}
                  onChange={(e) => setDetails({ ...details, locality: e.target.value })}
                />
              </Field>
              <Field label="Landmark">
                <Input
                  placeholder="Optional"
                  value={details.landmark}
                  onChange={(e) => setDetails({ ...details, landmark: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Address">
              <Input
                placeholder="Full street address"
                value={details.address}
                onChange={(e) => setDetails({ ...details, address: e.target.value })}
              />
            </Field>

            {!details.locality && !details.address && (
              <span className="flex items-center gap-1.5 font-body text-xs text-ink-muted">
                <span className="material-symbols-rounded text-sm">info</span>
                Drag the map, search, or use your location above, then tap "Use this location" — or type the address directly.
              </span>
            )}

            <div className="flex flex-col gap-2 rounded-3xl border border-border bg-panel p-4 md:bg-card/60">
              <div className="flex flex-col gap-1">
                <span className="font-display text-lg font-extrabold">Is your pandal already here?</span>
                <span className="font-body text-sm text-ink-muted">
                  {nearbyCheckFailed
                    ? "Couldn't check — please look on the map or Explore before continuing, to avoid adding a duplicate."
                    : nearby.length > 0
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
                  <Link
                    href={`/${citySlug}/pandal/${candidate.slug}`}
                    target="_blank"
                    className="flex-none rounded-xl border-[1.5px] border-brand px-3 py-2 font-body text-xs font-bold text-brand"
                  >
                    View pandal
                  </Link>
                </div>
              ))}
              <Button
                onClick={continueAsNew}
                disabled={!details.locality || !details.address}
                className="mt-1 flex items-center justify-center gap-1.5"
              >
                None of these — continue
                <span className="material-symbols-rounded text-lg">arrow_forward</span>
              </Button>
            </div>
          </div>

        </div>
      )}

      {step === "details" && (
        <form onSubmit={submitDetails} className={formStepClass}>
          <h2 className="font-display text-[20px] md:text-[22px] font-extrabold">Tell us about your pandal</h2>

          {/* Reminder of the location picked on the previous step — that
              screen scrolls out of view by the time someone's filling this
              one in, so without this the address they typed is invisible
              until after they've already submitted. */}
          <div className="flex items-start gap-2.5 rounded-2xl border border-border bg-panel px-3.5 py-3 md:bg-card/60">
            <span className="material-symbols-rounded mt-0.5 flex-none text-lg text-accent">location_on</span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-body text-sm font-bold">
                {details.address || "No address set"}
              </span>
              <span className="truncate font-body text-xs text-ink-muted">
                {[details.locality, details.landmark].filter(Boolean).join(" · ") || "No locality set"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setStep("location")}
              className="ml-auto flex-none font-body text-xs font-bold text-brand"
            >
              Edit
            </button>
          </div>

          <span className="font-body text-xs font-extrabold tracking-wide text-accent">BASIC DETAILS</span>

          <div className="flex flex-col gap-3 rounded-3xl border border-border bg-panel p-4 md:bg-card/60">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-chip">
                <span className="material-symbols-rounded text-brand">storefront</span>
              </span>
              <span className="font-display text-base font-bold">Basics</span>
            </div>
            <Field label="Pandal name">
              <Input
                required
                placeholder="e.g. Kumartuli Sarbojanin"
                value={details.canonicalName}
                onChange={(e) => setDetails({ ...details, canonicalName: e.target.value })}
              />
            </Field>
            <Field label="Organiser / committee">
              <Input
                placeholder="Optional"
                value={details.organizerName}
                onChange={(e) => setDetails({ ...details, organizerName: e.target.value })}
              />
            </Field>
          </div>

          <span className="mt-1 font-body text-xs font-extrabold tracking-wide text-accent">OPTIONAL DETAILS</span>

          <div className="flex flex-col gap-3 rounded-3xl border border-accent/20 bg-gradient-to-br from-[#2A1B2C] to-[#1E1726] p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-chip">
                <span className="material-symbols-rounded text-accent">palette</span>
              </span>
              <span className="font-display text-base font-bold">Theme for {festivalYear}</span>
              <span className="ml-auto font-body text-xs text-ink-muted">optional</span>
            </div>
            <Field label="Theme name">
              <Input
                placeholder="e.g. Rural Bengal"
                value={details.theme}
                onChange={(e) => setDetails({ ...details, theme: e.target.value })}
              />
            </Field>
            <Field label="Theme details">
              <Textarea
                placeholder="What makes it worth visiting?"
                value={details.description}
                onChange={(e) => setDetails({ ...details, description: e.target.value })}
              />
            </Field>
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
              <span className="font-display text-base font-bold">Good to know for visitors</span>
              <span className="ml-auto font-body text-xs text-ink-muted">optional</span>
            </div>
            <Field label="Public contact">
              <Input
                placeholder="Phone number visitors can call"
                value={details.publicContact}
                onChange={(e) => setDetails({ ...details, publicContact: e.target.value })}
              />
            </Field>
            {(
              [
                ["parkingAvailable", "Parking available"],
                ["twoWheelerAccessible", "2-wheeler accessible"],
                ["fourWheelerAccessible", "4-wheeler accessible"],
                ["foodStallsNearby", "Food stalls nearby"],
                ["streetShopsNearby", "Street shops nearby"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between font-body text-sm">
                {label}
                <input
                  type="checkbox"
                  checked={amenities[key]}
                  onChange={() => toggleAmenity(key)}
                  className="h-5 w-5 accent-brand"
                />
              </label>
            ))}
            <Field label="Visit type">
              <Select value={visitType} onChange={(e) => setVisitType(e.target.value)}>
                {VISIT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="flex flex-col gap-3 rounded-3xl border border-border bg-panel p-4 md:bg-card/60">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-chip">
                <span className="material-symbols-rounded text-brand">schedule</span>
              </span>
              <span className="font-display text-base font-bold">Puja schedule</span>
              <span className="ml-auto font-body text-xs text-ink-muted">optional</span>
            </div>
            {schedule.map((row, index) => {
              const { hour, minute, period } = parseScheduleTime(row.time);
              return (
              <div key={index} className="flex gap-2">
                <div className="flex flex-none gap-1">
                  <Select
                    aria-label="Hour"
                    value={hour}
                    onChange={(e) => updateScheduleRow(index, "time", formatScheduleTime(e.target.value, minute, period))}
                    className="w-[60px]"
                  >
                    {SCHEDULE_HOURS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </Select>
                  <Select
                    aria-label="Minute"
                    value={minute}
                    onChange={(e) => updateScheduleRow(index, "time", formatScheduleTime(hour, e.target.value, period))}
                    className="w-[68px]"
                  >
                    {SCHEDULE_MINUTES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </Select>
                  <Select
                    aria-label="AM or PM"
                    value={period}
                    onChange={(e) => updateScheduleRow(index, "time", formatScheduleTime(hour, minute, e.target.value))}
                    className="w-[68px]"
                  >
                    {SCHEDULE_PERIODS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </div>
                <Input
                  placeholder="Event — e.g. Evening Aarti"
                  value={row.label}
                  onChange={(e) => updateScheduleRow(index, "label", e.target.value)}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeScheduleRow(index)}
                  className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-card"
                >
                  <span className="material-symbols-rounded text-ink-muted">close</span>
                </button>
              </div>
              );
            })}
            <button
              type="button"
              onClick={addScheduleRow}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 font-body text-sm font-bold text-brand"
            >
              <span className="material-symbols-rounded text-lg">add</span>
              Add a schedule row
            </button>
          </div>

          <Button type="submit" disabled={!details.canonicalName}>
            Continue
          </Button>
        </form>
      )}

      {step === "verify" && (
        <div className={formStepClass.replace("gap-4", "gap-5")}>
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-[20px] md:text-[22px] font-extrabold leading-tight">
              {REQUIRE_VERIFICATION ? "Quick check it's you" : "How can we reach you?"}
            </h2>
            <p className="font-body text-sm text-ink-muted">
              {REQUIRE_VERIFICATION
                ? "We only use this to confirm your submission and reach you if we have questions. No account, no newsletters."
                : "We only use this to reach you if we have questions about your submission. No account, no newsletters."}
            </p>
          </div>
          <div className="flex h-11 md:h-12 items-center gap-2.5 rounded-2xl border border-border bg-panel px-3.5 md:bg-card">
            <span className="material-symbols-rounded text-[20px] text-ink-muted">mail</span>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              disabled={REQUIRE_VERIFICATION && codeSent}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 bg-transparent font-body text-[14.5px] md:text-[15.5px] outline-none"
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
                  className="h-12 md:h-14 rounded-2xl bg-ink text-center font-mono text-lg md:text-xl text-ground tracking-[0.4em]"
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
          <h2 className="font-display text-[22px] md:text-[26px] font-extrabold">Shubho! It's in the queue.</h2>
          <p className="font-body text-ink-dim">
            Every listing is checked before it appears on the {cityName} map. We'll email you only if something needs a fix.
          </p>
          {submissionId && <p className="font-mono text-xs text-ink-muted">#{submissionId.slice(-6)}</p>}
          <div className="mt-4 flex w-full flex-col gap-2.5">
            <Button onClick={() => router.push(`/${citySlug}`)}>Back to map</Button>
            <Button
              variant="secondary"
              onClick={() => {
                setDraftRestored(false);
                setStep("location");
                setCoords(center);
                setPendingCoords(center);
                setPendingAddress(null);
                setDetails(emptyDetails);
                setEmail("");
                setCode("");
                setCodeSent(false);
                setWebsite("");
                setCategories([]);
                setPhotos([]);
                setPhotoError(null);
                setSubmissionId(null);
                setFestivalYear(activeFestivalYear);
                setAmenities(emptyAmenities);
                setVisitType("WALKING_DARSHAN");
                setSchedule([]);
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
