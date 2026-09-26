"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { MapCanvas } from "@durgapandals/maps/react";
import type { LocationSearchResult, PandalSummary } from "@/lib/api";
import { PandalPreviewSheet } from "./pandal-preview-sheet";
import { LocationSearchBox } from "./location-search-box";

export interface MapHomeProps {
  citySlug: string;
  cityName: string;
  center: { latitude: number; longitude: number };
  zoom: number;
  mapTilesUrl: string;
  pandals: PandalSummary[];
}

const DESKTOP_QUERY = "(min-width: 768px)";

// Home is the map (spec §6.1). Layout differs by device on purpose (not just
// CSS scaling): mobile is a full-bleed map with a bottom sheet on marker tap;
// desktop is a scrollable list (left) + map (right), where tapping a marker
// scrolls/highlights the matching row instead of opening a floating card,
// and picking a row flies the map to it — both directions of the same
// selection state.
export function MapHome({ citySlug, cityName, center, zoom, mapTilesUrl, pandals }: MapHomeProps) {
  const searchParams = useSearchParams();
  const focusSlug = searchParams.get("pandal");
  const [isDesktop, setIsDesktop] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locationOn, setLocationOn] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const mapRef = useRef<maplibregl.Map | null>(null);
  const meMarkerRef = useRef<maplibregl.Marker | null>(null);
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null);
  const markerRefs = useRef<Record<string, maplibregl.Marker>>({});
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  function selectPandal(id: string, { fly = false }: { fly?: boolean } = {}) {
    setSelectedId(id);
    const pandal = pandals.find((p) => p.id === id);
    if (!pandal) return;

    if (isDesktop) {
      rowRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (fly) mapRef.current?.flyTo({ center: [pandal.longitude, pandal.latitude], zoom: Math.max(zoom, 15) });
    }
  }

  function handleMapReady(map: maplibregl.Map) {
    mapRef.current = map;
    for (const pandal of pandals) {
      const el = document.createElement("button");
      el.setAttribute("aria-label", pandal.canonicalName);
      el.style.width = "34px";
      el.style.height = "34px";
      el.style.borderRadius = "50%";
      el.style.background = "#FF4433";
      el.style.border = "2px solid #0F0C15";
      el.style.cursor = "pointer";
      el.style.boxShadow = "0 4px 12px rgba(0,0,0,.4)";
      el.onclick = () => selectPandal(pandal.id);

      const marker = new maplibregl.Marker({ element: el }).setLngLat([pandal.longitude, pandal.latitude]).addTo(map);
      markerRefs.current[pandal.id] = marker;
    }

    // Deep link from the pandal detail page's "View on map" action — unlike
    // a marker/list click, the map hasn't necessarily visited this pandal
    // yet, so this always flies there regardless of device.
    if (focusSlug) {
      const target = pandals.find((p) => p.slug === focusSlug);
      if (target) {
        map.flyTo({ center: [target.longitude, target.latitude], zoom: Math.max(zoom, 15) });
        setSelectedId(target.id);
        rowRefs.current[target.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  // Location permission is optional (spec §6.1) — denial/failure falls back
  // to the city's configured center silently, it never blocks the map.
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
        setLocationOn(true);
        const { latitude, longitude } = position.coords;
        const map = mapRef.current;
        if (!map) return;

        map.flyTo({ center: [longitude, latitude], zoom: Math.max(zoom, 15) });

        if (!meMarkerRef.current) {
          const el = document.createElement("div");
          el.style.width = "18px";
          el.style.height = "18px";
          el.style.borderRadius = "50%";
          el.style.background = "#4DA3FF";
          el.style.border = "3px solid #F4EFF6";
          el.style.boxShadow = "0 2px 8px rgba(0,0,0,.5)";
          meMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat([longitude, latitude]).addTo(map);
        } else {
          meMarkerRef.current.setLngLat([longitude, latitude]);
        }
      },
      () => {
        setLocating(false);
        setLocationError("Location permission denied — showing city centre instead.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  // Jumps the map to a searched place (spec: location search on both Map home
  // and the Add Pandal flow) — separate from a pandal marker, so it gets its
  // own pin style rather than reusing the pandal-red circle.
  function handleLocationSelect(result: LocationSearchResult) {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center: [result.longitude, result.latitude], zoom: 16 });

    if (!searchMarkerRef.current) {
      const el = document.createElement("div");
      el.style.width = "16px";
      el.style.height = "16px";
      el.style.borderRadius = "50%";
      el.style.background = "#FFB547";
      el.style.border = "3px solid #F4EFF6";
      el.style.boxShadow = "0 2px 8px rgba(0,0,0,.5)";
      searchMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([result.longitude, result.latitude])
        .addTo(map);
    } else {
      searchMarkerRef.current.setLngLat([result.longitude, result.latitude]);
    }
  }

  const selectedPandal = pandals.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="h-dvh w-full bg-ground md:flex md:pt-[64px]">
      {/* Desktop sidebar — scrollable list, map lives beside it, not under it */}
      <aside className="hidden md:flex md:w-[420px] md:flex-none md:flex-col md:overflow-y-auto md:border-r md:border-border">
        <div className="flex flex-col gap-3 px-4 pb-3 pt-4">
          <LocationSearchBox citySlug={citySlug} onSelect={handleLocationSelect} biasCenter={center} />
          <span className="font-body text-sm font-semibold text-ink-muted">
            {pandals.length} pandals in {cityName}
          </span>
        </div>
        <div className="flex flex-col px-3 pb-4">
          {pandals.map((pandal) => {
            const isSelected = pandal.id === selectedId;
            return (
              <div
                key={pandal.id}
                ref={(el) => {
                  rowRefs.current[pandal.id] = el;
                }}
                onClick={() => selectPandal(pandal.id, { fly: true })}
                className={`flex cursor-pointer gap-3 rounded-2xl p-2.5 transition-colors ${
                  isSelected ? "bg-card ring-2 ring-brand" : "hover:bg-card/60"
                }`}
              >
                <div className="h-20 w-20 flex-none overflow-hidden rounded-xl bg-panel">
                  {pandal.year?.coverImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pandal.year.coverImage} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    {pandal.year?.featured && (
                      <span className="material-symbols-rounded flex-none text-sm text-accent" style={{ fontVariationSettings: "'FILL' 1" }}>
                        star
                      </span>
                    )}
                    <span className="truncate font-body text-[15.5px] font-bold">{pandal.canonicalName}</span>
                    {pandal.verificationStatus === "VERIFIED" && (
                      <span className="material-symbols-rounded flex-none text-sm text-accent" style={{ fontVariationSettings: "'FILL' 1" }}>
                        verified
                      </span>
                    )}
                  </div>
                  <span className="truncate font-body text-sm text-ink-muted">
                    {pandal.locality}
                    {pandal.organizerName ? ` · ${pandal.organizerName}` : ""}
                  </span>
                  {pandal.year?.theme && (
                    <span className="truncate font-body text-xs text-ink-dim">{pandal.year.theme}</span>
                  )}
                  {pandal.year && pandal.year.tags.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {pandal.year.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded-pill bg-chip px-2 py-0.5 font-body text-[11px] font-medium text-ink-dim">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <span className="mt-0.5 flex items-center gap-1 font-body text-xs font-semibold text-accent">
                    <span className="material-symbols-rounded text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                      thumb_up
                    </span>
                    {pandal.likes}
                  </span>
                  {isSelected && (
                    <Link
                      href={`/${citySlug}/pandal/${pandal.slug}`}
                      className="mt-1 flex w-fit items-center gap-1 font-body text-xs font-bold text-brand"
                    >
                      View details
                      <span className="material-symbols-rounded text-sm">arrow_forward</span>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
          {pandals.length === 0 && (
            <p className="px-2 py-8 text-center font-body text-sm text-ink-muted">
              No pandals published yet in {cityName}.
            </p>
          )}
        </div>
      </aside>

      <div className="relative h-full flex-1 overflow-hidden">
        <MapCanvas
          styleUrl={mapTilesUrl}
          center={center}
          zoom={zoom}
          onMapReady={handleMapReady}
          className="absolute inset-0"
        />

        {/* Mobile-only chrome — desktop uses the sidebar instead */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[240px] bg-gradient-to-b from-ground via-ground/80 to-transparent md:hidden" />

        <div className="absolute inset-x-4 top-[64px] z-10 flex flex-col gap-2.5 md:hidden">
          <LocationSearchBox citySlug={citySlug} placeholder="Search a location…" onSelect={handleLocationSelect} biasCenter={center} />
        </div>

        {!locationOn && (
          <div className="absolute inset-x-4 bottom-[160px] z-10 flex items-center gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-lg md:bottom-4 md:left-4 md:right-auto md:w-[320px]">
            <span className="material-symbols-rounded text-ink-muted">location_off</span>
            <span className="flex-1 font-body text-sm text-ink-dim">
              {locationError ?? `Showing ${cityName} centre. Turn on location to see distances.`}
            </span>
            <button className="font-body text-sm font-bold text-brand disabled:opacity-50" onClick={locateMe} disabled={locating}>
              {locating ? "Locating…" : "Turn on"}
            </button>
          </div>
        )}

        <Link
          href={`/${citySlug}/explore`}
          className="absolute bottom-[102px] left-1/2 z-10 flex h-[46px] -translate-x-1/2 items-center gap-2 rounded-pill bg-ink pl-4 pr-5 font-body text-[15px] font-bold text-ground shadow-lg md:hidden"
        >
          <span className="material-symbols-rounded">view_agenda</span>
          List · {pandals.length}
        </Link>

        <button
          onClick={locateMe}
          disabled={locating}
          className="absolute bottom-[100px] right-4 z-10 flex h-[50px] w-[50px] items-center justify-center rounded-full border border-border bg-card shadow-lg disabled:opacity-60 md:bottom-4"
        >
          <span className={`material-symbols-rounded ${locationOn ? "text-info" : ""}`}>my_location</span>
        </button>
      </div>

      {!isDesktop && selectedPandal && (
        <PandalPreviewSheet citySlug={citySlug} pandal={selectedPandal} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
