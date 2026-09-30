"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import maplibregl from "maplibre-gl";
import { MapCanvas } from "@durgapandals/maps/react";
import {
  ADDED_BY_LABELS,
  VISIT_TYPE_LABELS,
  fetchLikedStatus,
  toggleReaction,
  type NearbyRadiusPandal,
  type PandalSummary,
} from "@/lib/api";
import { getSavedPandalSlugs, getVisitorId, toggleSavedPandal } from "@/lib/visitor";
import { DirectionsButton } from "./directions-button";
import { PhotoCarousel } from "./photo-carousel";
import { MobileHeader } from "./mobile-header";
import { PandalPhotoPlaceholder } from "./pandal-photo-placeholder";

export interface PandalDetailProps {
  citySlug: string;
  cityName: string;
  pandal: PandalSummary;
  nearby: NearbyRadiusPandal[];
  mapTilesUrl: string;
}

// Only true amenities render (spec §2 — never show a false one dimmed/crossed
// out).
const AMENITY_DEFS: { key: keyof PandalSummary; icon: string; label: string }[] = [
  { key: "parkingAvailable", icon: "local_parking", label: "Parking available" },
  { key: "twoWheelerAccessible", icon: "two_wheeler", label: "2-wheeler accessible" },
  { key: "fourWheelerAccessible", icon: "directions_car", label: "4-wheeler accessible" },
  { key: "foodStallsNearby", icon: "restaurant", label: "Food stalls nearby" },
  { key: "streetShopsNearby", icon: "storefront", label: "Street shops nearby" },
];

// Matches the design's Google-Maps-place-page split: a wide scrollable
// content column (hero photo, name, schedule, amenities, nearby rail — same
// content mobile and desktop) plus a narrower column that only exists on
// desktop, holding a small static-feeling map preview and the
// Directions/Add-to-route actions. The mockup has no "did you like this"
// callout block — liking happens via the heart chip overlaid on the hero,
// same spot on both breakpoints, so that's the only like control here.
export function PandalDetail({ citySlug, cityName, pandal, nearby, mapTilesUrl }: PandalDetailProps) {
  const [likes, setLikes] = useState(pandal.likes);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<"copied" | "unavailable" | null>(null);

  // Same class of bug as MapHome's pandal list: navigating pandal-to-pandal
  // (e.g. via "Pandals near here") reuses this component instance rather
  // than remounting it, so `likes`/`liked` must be explicitly re-synced to
  // the newly-loaded pandal instead of quietly showing the previous one's.
  useEffect(() => {
    setLikes(pandal.likes);
    setSaved(getSavedPandalSlugs(citySlug).includes(pandal.slug));

    // Hydrates whether *this* visitor already liked this pandal — without
    // it, a returning visitor always saw an unfilled heart and tapping it
    // would silently un-like instead of liking, since the server already
    // knew but the client had just assumed "no."
    setLiked(false);
    if (pandal.year) {
      fetchLikedStatus(pandal.year.id, getVisitorId()).then(setLiked);
    }
  }, [pandal.slug, pandal.year?.id, pandal.likes, citySlug]);

  async function toggleLike() {
    if (!pandal.year) return;
    const yearId = pandal.year.id;
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikes((prev) => (wasLiked ? prev - 1 : prev + 1));

    try {
      const result = await toggleReaction(yearId, getVisitorId());
      setLiked(result.liked);
      setLikes(result.count);
    } catch {
      // Roll back the optimistic update — a network/server failure must
      // not leave the heart showing a state the server never actually
      // recorded.
      setLiked(wasLiked);
      setLikes((prev) => (wasLiked ? prev + 1 : prev - 1));
    }
  }

  function toggleSave() {
    setSaved(toggleSavedPandal(citySlug, pandal.slug));
  }

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try {
        await navigator.share({ title: pandal.canonicalName, url });
      } catch {
        // User cancelled the native share sheet — nothing to do.
      }
      return;
    }
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        setShareFeedback("copied");
      } catch {
        setShareFeedback("unavailable");
      }
    } else {
      setShareFeedback("unavailable");
    }
    setTimeout(() => setShareFeedback(null), 2000);
  }

  function handleMapReady(map: maplibregl.Map) {
    const el = document.createElement("div");
    el.style.width = "30px";
    el.style.height = "30px";
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.innerHTML = '<img src="/images/marker-icon.svg" alt="" style="width:30px;height:30px" />';
    new maplibregl.Marker({ element: el }).setLngLat([pandal.longitude, pandal.latitude]).addTo(map);
  }

  const amenities = AMENITY_DEFS.filter((def) => pandal[def.key]);
  const schedule = pandal.year?.schedule ?? [];

  return (
    <main className="bg-ground pb-[84px] md:flex md:h-[calc(100dvh-60px)] md:overflow-hidden md:pb-0">
      {/* Wide content column — full width on mobile, ~62% on desktop, scrolls
          independently of the narrow action column beside it. */}
      <div className="md:h-full md:flex-[1.6] md:overflow-y-auto md:border-r md:border-border">
        <div className="relative h-[340px] w-full overflow-hidden md:h-[280px]">
          <PhotoCarousel
            photos={pandal.year?.photos ?? []}
            fallbackImage={pandal.year?.coverImage}
            alt={pandal.canonicalName}
            dotsAlign="start"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ground via-ground/10 to-transparent" />
          <div className="absolute inset-x-4 top-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Back arrow: mobile only — desktop relies on the persistent
                  top nav bar (logo -> Home) instead, matching the design. */}
              <Link
                href={`/${citySlug}`}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-ground/70 md:hidden"
              >
                <span className="material-symbols-rounded">arrow_back</span>
              </Link>
              <MobileHeader
                citySlug={citySlug}
                cityName={cityName}
                year={pandal.year?.year}
                variant="overlay"
                className="md:hidden"
              />
            </div>
            <div className="relative flex items-center gap-2">
              <button onClick={handleShare} className="flex h-11 w-11 items-center justify-center rounded-full bg-ground/70">
                <span className="material-symbols-rounded">share</span>
              </button>
              {shareFeedback && (
                <span className="absolute right-0 top-[calc(100%+6px)] whitespace-nowrap rounded-xl bg-ground/90 px-3 py-1.5 font-body text-xs font-semibold shadow-lg">
                  {shareFeedback === "copied" ? "Link copied" : "Couldn't copy link"}
                </span>
              )}
              {/* Save/bookmark lives only in the sticky bottom bar (mobile)
                  and action column (desktop) below — having it here too, as
                  an unlabeled icon, was a duplicate control for the same
                  toggleSave action and added clutter to the photo overlay. */}
              <button
                onClick={toggleLike}
                className="flex h-11 items-center gap-1.5 rounded-pill bg-ground/70 px-3.5 font-body text-sm font-bold"
              >
                <span
                  className={`material-symbols-rounded text-lg ${liked ? "text-brand" : ""}`}
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  favorite
                </span>
                {likes}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5 px-5 pt-5 md:px-[22px] md:pb-8">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {pandal.year && (
                <span className="rounded-pill bg-brand px-3 py-1 font-body text-sm font-bold text-brand-ink">
                  {pandal.year.year}
                </span>
              )}
              <span className="rounded-pill bg-chip px-3 py-1 font-body text-xs font-bold">
                {VISIT_TYPE_LABELS[pandal.visitType]}
              </span>
            </div>
            <h1 className="flex items-center gap-2 font-display text-[21px] font-extrabold leading-tight tracking-tight md:text-[26px]">
              {pandal.canonicalName}
              {pandal.verificationStatus === "VERIFIED" && (
                <span
                  className="material-symbols-rounded text-accent text-xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                  title="Verified by admin"
                >
                  verified
                </span>
              )}
            </h1>
            <p className="flex items-center gap-1.5 font-body text-ink-dim">
              <span className="material-symbols-rounded text-brand text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                location_on
              </span>
              {pandal.locality}, {cityName}
            </p>
            {pandal.organizerName && (
              <p className="font-body text-sm text-ink-muted">Organised by {pandal.organizerName}</p>
            )}
            <p className="font-body text-xs text-ink-muted/80">{ADDED_BY_LABELS[pandal.addedBy]}</p>
            {pandal.year && pandal.year.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {pandal.year.tags.map((tag) => (
                  <span key={tag} className="rounded-pill border border-border bg-card px-3 py-1 font-body text-sm">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {pandal.year?.theme && (
            <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-panel p-4">
              <span className="font-mono text-xs uppercase text-brand">Theme {pandal.year.year}</span>
              <span className="font-display text-lg font-bold">{pandal.year.theme}</span>
              {pandal.year.description && <p className="font-body text-sm text-ink-dim leading-relaxed">{pandal.year.description}</p>}
            </div>
          )}

          {schedule.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="pb-1 font-display text-lg font-extrabold">
                Puja schedule <span className="font-body text-xs font-medium text-ink-muted">· set by this pandal</span>
              </span>
              {schedule.map((entry, index) => (
                <div key={index} className="flex items-center gap-3 py-1.5">
                  <span className="w-16 flex-none font-body text-sm font-bold text-accent">{entry.time}</span>
                  <span className="h-1.5 w-1.5 flex-none rounded-full bg-brand" />
                  <span className="font-body text-sm">{entry.label}</span>
                </div>
              ))}
            </div>
          )}

          {amenities.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="font-display text-lg font-extrabold">Good to know</span>
              <div className="grid grid-cols-2 gap-2.5">
                {amenities.map((amenity) => (
                  <span key={amenity.key} className="flex items-center gap-2 font-body text-sm text-ink-dim">
                    <span className="material-symbols-rounded text-accent text-lg">{amenity.icon}</span>
                    {amenity.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {nearby.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="font-display text-lg font-extrabold">Pandals near here (1-2km)</span>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {nearby.map((n) => (
                  <Link
                    key={n.id}
                    href={pandal.year ? `/${citySlug}/pandal/${n.slug}?year=${pandal.year.year}` : `/${citySlug}/pandal/${n.slug}`}
                    className="flex w-[110px] flex-none flex-col gap-1.5"
                  >
                    <div className="h-16 w-full overflow-hidden rounded-xl bg-card">
                      {n.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={n.coverImage} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <PandalPhotoPlaceholder className="h-full w-full" />
                      )}
                    </div>
                    <span className="truncate font-body text-xs font-bold">{n.canonicalName}</span>
                    <span className="font-body text-[11px] text-ink-muted">{(n.distanceMeters / 1000).toFixed(1)}km</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="font-display text-lg font-extrabold">Address</span>
            <p className="font-body text-sm leading-relaxed text-ink-dim">{pandal.address}</p>
            <Link
              href={
                pandal.year
                  ? `/${citySlug}?pandal=${pandal.slug}&year=${pandal.year.year}`
                  : `/${citySlug}?pandal=${pandal.slug}`
              }
              className="flex w-fit items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2.5 font-body text-sm font-bold text-brand"
            >
              <span className="material-symbols-rounded text-lg">map</span>
              View on map
            </Link>
          </div>

          <Link
            href={`/${citySlug}/pandal/${pandal.slug}/report`}
            className="flex w-fit items-center gap-1.5 font-body text-sm font-bold text-brand"
          >
            <span className="material-symbols-rounded text-lg">flag</span>
            Suggest an edit / report an issue
          </Link>

          <p className="font-body text-xs text-ink-muted/70">
            Details here are crowdsourced and not independently verified — timings and themes may
            change. Please confirm with the organizer before visiting.{" "}
            <Link href="/disclaimer" className="underline">
              Learn more
            </Link>
          </p>
        </div>
      </div>

      {/* Narrow action column — desktop only. Mobile gets the sticky bottom
          bar instead. */}
      <div className="hidden md:flex md:h-full md:flex-1 md:flex-col md:gap-4 md:overflow-y-auto md:p-[22px]">
        <div className="relative h-[180px] w-full flex-none overflow-hidden rounded-2xl">
          <MapCanvas
            styleUrl={mapTilesUrl}
            center={{ latitude: pandal.latitude, longitude: pandal.longitude }}
            zoom={15}
            onMapReady={handleMapReady}
            className="absolute inset-0"
          />
        </div>
        <div className="flex gap-2.5">
          <DirectionsButton pandal={pandal} variant="block" />
          <button
            onClick={toggleSave}
            className={`flex h-10 flex-1 items-center justify-center gap-1 rounded-2xl font-body text-xs font-bold ${
              saved ? "bg-card text-brand" : "border border-border text-ink"
            }`}
          >
            <span className="material-symbols-rounded text-sm" style={saved ? { fontVariationSettings: "'FILL' 1" } : undefined}>
              bookmark
            </span>
            {saved ? "Added to route" : "Add to route"}
          </button>
        </div>
      </div>

      {/* Sticky action bar — mobile only, desktop's actions live in the
          right column instead. */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2.5 border-t border-border bg-ground/95 p-4 backdrop-blur md:hidden">
        <DirectionsButton pandal={pandal} variant="block" />
        <button
          onClick={toggleSave}
          className={`flex h-10 flex-1 items-center justify-center gap-1 rounded-2xl font-body text-xs font-bold ${
            saved ? "bg-card text-brand" : "border border-border text-ink"
          }`}
        >
          <span className="material-symbols-rounded text-sm" style={saved ? { fontVariationSettings: "'FILL' 1" } : undefined}>
            bookmark
          </span>
          {saved ? "Added to route" : "Add to route"}
        </button>
      </div>
    </main>
  );
}
