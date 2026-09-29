"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { MapCanvas } from "@durgapandals/maps/react";
import { reverseGeocode, searchLocations, type LocationSearchResult, type ReverseGeocodeResult } from "@/lib/admin-api";

export interface LocationPickerProps {
  center: { latitude: number; longitude: number };
  zoom?: number;
  mapTilesUrl: string;
  onChange: (coords: { latitude: number; longitude: number }) => void;
  onAddressResolved?: (result: ReverseGeocodeResult) => void;
}

const SEARCH_DEBOUNCE_MS = 350;

// Pin-drop picker for admin's pandal forms — same "pin stays fixed at
// screen centre, map moves under it" pattern as the public Add Pandal flow,
// plus a typed address search and "use my location" button.
//
// Dragging, searching, and geolocating all only move a PENDING pin — none
// of them touch the form's actual saved location or address fields. Only
// the explicit "Use this location" button commits the pending pin's
// coordinates AND resolved address together. This is deliberate: an admin
// panning/zooming to look around was silently overwriting the saved
// location on every stray drag, and editing the address text afterward
// could never accidentally be confused with moving the pin, since the two
// are only ever connected by that one button.
export function LocationPicker({ center, zoom = 14, mapTilesUrl, onChange, onAddressResolved }: LocationPickerProps) {
  const [pending, setPending] = useState(center);
  const [pendingAddress, setPendingAddress] = useState<ReverseGeocodeResult | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeFailed, setGeocodeFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasPendingMove = pending.latitude !== center.latitude || pending.longitude !== center.longitude;

  // Best-effort preview of the pending pin's address, shown next to "Use
  // this location" before the admin commits to it — never applied to the
  // form on its own.
  function scheduleReverseGeocode(next: { latitude: number; longitude: number }) {
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    setGeocodeFailed(false);
    setPendingAddress(null);
    geocodeTimer.current = setTimeout(async () => {
      setGeocoding(true);
      const result = await reverseGeocode(next.latitude, next.longitude);
      setGeocoding(false);
      if (result) {
        setPendingAddress(result);
      } else {
        setGeocodeFailed(true);
      }
    }, 500);
  }

  const handleMapReady = useCallback((map: MapLibreMap) => {
    mapRef.current = map;
    map.on("moveend", () => {
      const c = map.getCenter();
      const next = { latitude: c.lat, longitude: c.lng };
      setPending(next);
      scheduleReverseGeocode(next);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function jumpTo(next: { latitude: number; longitude: number }) {
    mapRef.current?.flyTo({ center: [next.longitude, next.latitude], zoom: 16 });
    setPending(next);
  }

  function useThisLocation() {
    onChange(pending);
    if (pendingAddress) onAddressResolved?.(pendingAddress);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setOpen(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const found = await searchLocations(value, pending);
      setResults(found);
      setSearching(false);
    }, SEARCH_DEBOUNCE_MS);
  }

  function handleSelectResult(result: LocationSearchResult) {
    jumpTo({ latitude: result.latitude, longitude: result.longitude });
    setPendingAddress(result);
    setQuery(result.label);
    setOpen(false);
    setResults([]);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocateError("Location isn't available on this device.");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        jumpTo(next);
        scheduleReverseGeocode(next);
      },
      (err) => {
        setLocating(false);
        setLocateError(err.code === err.PERMISSION_DENIED ? "Location permission denied." : "Couldn't get your location.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  // Close the results dropdown on an outside click, same pattern as the
  // public location-search-box.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="flex flex-col gap-2">
      <div className="relative h-[280px] w-full overflow-hidden rounded-xl border border-border">
        <MapCanvas styleUrl={mapTilesUrl} center={center} zoom={zoom} onMapReady={handleMapReady} className="absolute inset-0" />

        <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-full flex-col items-center">
          <span
            className={`material-symbols-rounded text-[34px] ${hasPendingMove ? "text-ink-muted" : "text-accent"}`}
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            add_location
          </span>
        </div>

        {/* Search + "use my location" — connects the map to a typed address
            instead of relying only on drag-to-find-it. Either one only
            moves the pending pin, same as a drag. */}
        <div className="absolute inset-x-2 top-2 z-10 flex items-start gap-1.5">
          <div className="relative flex-1">
            <div className="flex h-9 items-center gap-1.5 rounded-lg bg-ink px-2.5 shadow-lg">
              <span className="material-symbols-rounded text-base text-ground/60">search</span>
              <input
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onFocus={() => setOpen(true)}
                placeholder="Search an address…"
                className="min-w-0 flex-1 bg-transparent font-body text-xs text-ground outline-none placeholder:text-ground/50"
              />
              {searching && <span className="material-symbols-rounded animate-spin text-sm text-ground/50">progress_activity</span>}
            </div>
            {open && results.length > 0 && (
              <div className="absolute inset-x-0 top-[calc(100%+4px)] flex max-h-[180px] flex-col gap-0.5 overflow-y-auto rounded-lg border border-border bg-panel p-1 shadow-2xl">
                {results.map((result, index) => (
                  <button
                    key={`${result.label}-${index}`}
                    type="button"
                    onClick={() => handleSelectResult(result)}
                    className="flex items-start gap-1.5 rounded-md p-1.5 text-left hover:bg-card"
                  >
                    <span className="material-symbols-rounded flex-none text-sm text-ink-muted">location_on</span>
                    <span className="truncate font-body text-xs">{result.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            title="Use my current location"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-ink shadow-lg disabled:opacity-70"
          >
            <span className="material-symbols-rounded text-lg text-ground/70">{locating ? "sync" : "my_location"}</span>
          </button>
        </div>

        <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-lg bg-ground/80 px-2 py-1 font-body text-xs text-ink-muted">
          {pending.latitude.toFixed(5)}, {pending.longitude.toFixed(5)}
          {geocoding && (
            <span className="flex items-center gap-1">
              <span className="material-symbols-rounded animate-spin text-sm">progress_activity</span>
              Locating…
            </span>
          )}
          {!geocoding && geocodeFailed && (
            <span className="flex items-center gap-1 text-accent">
              <span className="material-symbols-rounded text-sm">info</span>
              Address lookup failed
            </span>
          )}
          {!geocoding && locateError && (
            <span className="flex items-center gap-1 text-accent">
              <span className="material-symbols-rounded text-sm">info</span>
              {locateError}
            </span>
          )}
        </div>
      </div>

      {/* The one and only place a map move ever reaches the actual form —
          current vs pending are always shown side by side so it's never
          ambiguous which one is currently saved. */}
      {hasPendingMove && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-card px-3 py-2 font-body text-xs">
          <span className="flex min-w-0 items-start gap-1.5 text-accent">
            <span className="material-symbols-rounded flex-none text-sm">pin_drop</span>
            <span className="truncate">{pendingAddress ? pendingAddress.label : "Resolving address…"}</span>
          </span>
          <button
            type="button"
            onClick={useThisLocation}
            className="flex-none rounded-lg bg-brand px-3 py-1.5 font-bold text-brand-ink"
          >
            Use this location
          </button>
        </div>
      )}
    </div>
  );
}
