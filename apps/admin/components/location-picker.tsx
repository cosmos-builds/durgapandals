"use client";

import { useCallback, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { MapCanvas } from "@durgapandals/maps/react";
import { reverseGeocode, type ReverseGeocodeResult } from "@/lib/admin-api";

export interface LocationPickerProps {
  center: { latitude: number; longitude: number };
  zoom?: number;
  mapTilesUrl: string;
  onChange: (coords: { latitude: number; longitude: number }) => void;
  onAddressResolved?: (result: ReverseGeocodeResult) => void;
}

// Pin-drop picker for admin's pandal forms — same "pin stays fixed at
// screen centre, map moves under it" pattern as the public Add Pandal flow
// (apps/web/components/add-pandal-flow.tsx), just without that flow's
// nearby-duplicate check/OTP steps, which don't apply to a direct admin
// create/edit.
export function LocationPicker({ center, zoom = 14, mapTilesUrl, onChange, onAddressResolved }: LocationPickerProps) {
  const [coords, setCoords] = useState(center);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeFailed, setGeocodeFailed] = useState(false);
  const mapRef = useRef<MapLibreMap | null>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lat/lng always lands via onChange the instant the pin moves (below) —
  // that's the one thing every pandal actually needs and it never fails.
  // Reverse geocoding (the address text) is best-effort on top of that, so
  // this surfaces its status instead of failing silently — a stuck-looking
  // form with no explanation was the actual complaint, not the geocoding
  // itself.
  function scheduleReverseGeocode(next: { latitude: number; longitude: number }) {
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    setGeocodeFailed(false);
    geocodeTimer.current = setTimeout(async () => {
      setGeocoding(true);
      const result = await reverseGeocode(next.latitude, next.longitude);
      setGeocoding(false);
      if (result) {
        onAddressResolved?.(result);
      } else {
        setGeocodeFailed(true);
      }
    }, 500);
  }

  const handleMapReady = useCallback(
    (map: MapLibreMap) => {
      mapRef.current = map;
      map.on("moveend", () => {
        const c = map.getCenter();
        const next = { latitude: c.lat, longitude: c.lng };
        setCoords(next);
        onChange(next);
        scheduleReverseGeocode(next);
      });
      // Fire once immediately for the initial center — otherwise a form
      // that submits without the admin ever dragging the map (e.g. the
      // city's default center is already correct) would carry no
      // latitude/longitude at all.
      onChange(center);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div className="relative h-[280px] w-full overflow-hidden rounded-xl border border-border">
      <MapCanvas styleUrl={mapTilesUrl} center={center} zoom={zoom} onMapReady={handleMapReady} className="absolute inset-0" />

      <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-full flex-col items-center">
        <span className="material-symbols-rounded text-[34px] text-accent" style={{ fontVariationSettings: "'FILL' 1" }}>
          add_location
        </span>
      </div>

      <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 rounded-lg bg-ground/80 px-2 py-1 font-body text-xs">
        <span className="text-ink-muted">
          {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
        </span>
        {geocoding && (
          <span className="flex items-center gap-1 text-ink-muted">
            <span className="material-symbols-rounded animate-spin text-sm">progress_activity</span>
            Locating…
          </span>
        )}
        {!geocoding && geocodeFailed && (
          <span className="flex items-center gap-1 text-accent">
            <span className="material-symbols-rounded text-sm">info</span>
            Address lookup failed — edit manually
          </span>
        )}
      </div>
    </div>
  );
}
