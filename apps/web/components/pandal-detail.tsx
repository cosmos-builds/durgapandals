"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import maplibregl from "maplibre-gl";
import { MapCanvas } from "@durgapandals/maps/react";
import { externalDirectionsUrl } from "@durgapandals/maps";
import type { PandalSummary } from "@/lib/api";
import { getSavedPandalSlugs, getVisitorId, toggleSavedPandal } from "@/lib/visitor";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface PandalDetailProps {
  citySlug: string;
  cityName: string;
  pandal: PandalSummary;
  mapTilesUrl: string;
}

// Mobile keeps the original full-bleed scroll (hero photo, sticky bottom
// action bar). Desktop switches to a Google Maps place-page pattern instead
// of just stretching that layout wide: a fixed-width info panel that scrolls
// independently, with the map filling the rest of the viewport beside it.
export function PandalDetail({ citySlug, cityName, pandal, mapTilesUrl }: PandalDetailProps) {
  const router = useRouter();
  const [likes, setLikes] = useState(pandal.likes);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(getSavedPandalSlugs().includes(pandal.slug));
  }, [pandal.slug]);

  async function toggleLike() {
    if (!pandal.year) return;
    setLiked((prev) => !prev);
    setLikes((prev) => (liked ? prev - 1 : prev + 1));

    const response = await fetch(`${API_BASE_URL}/reactions/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pandalYearId: pandal.year.id, anonymousVisitorId: getVisitorId() }),
    });
    if (response.ok) {
      const body = await response.json();
      setLiked(body.liked);
      setLikes(body.count);
    }
  }

  function toggleSave() {
    setSaved(toggleSavedPandal(pandal.slug));
  }

  function handleMapReady(map: maplibregl.Map) {
    const el = document.createElement("div");
    el.style.width = "20px";
    el.style.height = "20px";
    el.style.borderRadius = "50%";
    el.style.background = "#FF4433";
    el.style.border = "3px solid #F4EFF6";
    el.style.boxShadow = "0 4px 12px rgba(0,0,0,.5)";
    new maplibregl.Marker({ element: el }).setLngLat([pandal.longitude, pandal.latitude]).addTo(map);
  }

  const visitRows = [
    { icon: "schedule", label: "Timings", value: pandal.year?.openingHours },
    { icon: "local_parking", label: "Parking", value: pandal.year?.parkingInfo },
    { icon: "door_front", label: "Entry", value: pandal.year?.entryInfo },
  ].filter((row) => row.value);

  return (
    <main className="bg-ground md:flex md:h-dvh md:overflow-hidden">
      {/* Info panel — full width on mobile, a fixed ~460px column on desktop
          that scrolls independently of the map beside it. */}
      <div className="pb-28 md:h-full md:w-[460px] md:flex-none md:overflow-y-auto md:border-r md:border-border md:pb-10">
        <div className="relative h-[340px] w-full overflow-hidden md:h-[280px]">
          {pandal.year?.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pandal.year.coverImage} alt={pandal.canonicalName} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-panel" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ground via-ground/10 to-transparent" />
          <div className="absolute inset-x-4 top-4 flex justify-between">
            <button onClick={() => router.back()} className="flex h-11 w-11 items-center justify-center rounded-full bg-ground/70">
              <span className="material-symbols-rounded">arrow_back</span>
            </button>
            <div className="flex gap-2">
              <a
                href={externalDirectionsUrl(pandal)}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden h-11 items-center gap-1.5 rounded-full bg-brand px-4 font-body text-sm font-bold text-brand-ink md:flex"
              >
                <span className="material-symbols-rounded text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                  directions
                </span>
                Directions
              </a>
              <button onClick={toggleSave} className="flex h-11 w-11 items-center justify-center rounded-full bg-ground/70">
                <span
                  className={`material-symbols-rounded ${saved ? "text-brand" : ""}`}
                  style={saved ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  bookmark
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5 px-5 pt-5">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {pandal.year && (
                <span className="rounded-pill bg-brand px-3 py-1 font-body text-sm font-bold text-brand-ink">
                  {pandal.year.year}
                </span>
              )}
              {pandal.verificationStatus === "VERIFIED" && (
                <span className="flex items-center gap-1 rounded-pill bg-card px-3 py-1 font-body text-xs font-semibold">
                  <span className="material-symbols-rounded text-accent text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                    verified
                  </span>
                  Verified information
                </span>
              )}
            </div>
            <h1 className="font-display text-[28px] font-extrabold leading-tight tracking-tight md:text-[26px]">
              {pandal.canonicalName}
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

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-accent/20 bg-gradient-to-br from-[#2A1B2C] to-[#1E1726] p-4">
            <div className="flex flex-col gap-0.5">
              <span className="font-display text-base font-bold">Did you like this pandal?</span>
              <span className="font-body text-xs text-ink-muted">One tap. No login.</span>
            </div>
            <button
              onClick={toggleLike}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 font-body font-bold ${
                liked ? "bg-accent text-accent-ink" : "bg-card text-ink"
              }`}
            >
              <span className="material-symbols-rounded" style={liked ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                thumb_up
              </span>
              {likes}
            </button>
          </div>

          {pandal.year?.theme && (
            <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-panel p-4">
              <span className="font-mono text-xs uppercase text-brand">Theme {pandal.year.year}</span>
              <span className="font-display text-lg font-bold">{pandal.year.theme}</span>
              {pandal.year.description && <p className="font-body text-sm text-ink-dim leading-relaxed">{pandal.year.description}</p>}
            </div>
          )}

          {visitRows.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="pb-1 font-display text-lg font-extrabold">Plan your visit</span>
              {visitRows.map((row) => (
                <div key={row.label} className="flex gap-3.5 border-b border-border py-2.5 last:border-0">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-card">
                    <span className="material-symbols-rounded text-brand">{row.icon}</span>
                  </span>
                  <div className="flex flex-col">
                    <span className="font-body text-xs font-semibold text-ink-muted">{row.label}</span>
                    <span className="font-body text-sm">{row.value}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="font-display text-lg font-extrabold">Address</span>
            <p className="font-body text-sm leading-relaxed text-ink-dim">{pandal.address}</p>
            <Link
              href={`/${citySlug}?pandal=${pandal.slug}`}
              className="flex w-fit items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2.5 font-body text-sm font-bold text-brand"
            >
              <span className="material-symbols-rounded text-lg">map</span>
              View on map
            </Link>
          </div>
        </div>
      </div>

      {/* Map — mobile has no inline map here (address text is enough given the
          sticky Directions bar below); desktop fills the remaining width. */}
      <div className="relative hidden md:block md:h-full md:flex-1">
        <MapCanvas
          styleUrl={mapTilesUrl}
          center={{ latitude: pandal.latitude, longitude: pandal.longitude }}
          zoom={16}
          onMapReady={handleMapReady}
          className="absolute inset-0"
        />
      </div>

      {/* Sticky action bar — mobile only, desktop's Directions button lives in the hero */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2.5 border-t border-border bg-ground/95 p-4 backdrop-blur md:hidden">
        <a
          href={externalDirectionsUrl(pandal)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 font-body font-bold text-brand-ink"
        >
          <span className="material-symbols-rounded" style={{ fontVariationSettings: "'FILL' 1" }}>
            directions
          </span>
          Directions
        </a>
      </div>
    </main>
  );
}
