"use client";

import { useCallback } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import maplibregl from "maplibre-gl";
import { MapCanvas } from "@durgapandals/maps/react";

export interface Candidate {
  pandalId: string;
  score: number;
  latitude?: number;
  longitude?: number;
}

export interface CandidatesMapProps {
  mapTilesUrl: string;
  /** The submission's own dropped pin, if the submitted data included one. */
  origin?: { latitude: number; longitude: number };
  candidates: Candidate[];
}

// Read-only overview map for a submission's duplicate candidates — replaces
// a plain "73% match · 40m away" text line with pins an admin can actually
// look at, numbered by match rank. No drag/edit here, unlike LocationPicker.
export function CandidatesMap({ mapTilesUrl, origin, candidates }: CandidatesMapProps) {
  const withCoords = candidates.filter((c): c is Candidate & { latitude: number; longitude: number } =>
    c.latitude != null && c.longitude != null
  );

  const center = origin ?? withCoords[0] ?? { latitude: 0, longitude: 0 };

  const handleMapReady = useCallback(
    (map: MapLibreMap) => {
      if (origin) {
        const el = document.createElement("div");
        el.style.width = "16px";
        el.style.height = "16px";
        el.style.borderRadius = "50%";
        el.style.background = "#4DA3FF";
        el.style.border = "3px solid #F4EFF6";
        el.style.boxShadow = "0 2px 8px rgba(0,0,0,.5)";
        new maplibregl.Marker({ element: el }).setLngLat([origin.longitude, origin.latitude]).addTo(map);
      }

      withCoords.forEach((candidate, index) => {
        const el = document.createElement("a");
        el.href = `/pandals/${candidate.pandalId}`;
        el.target = "_blank";
        el.rel = "noopener noreferrer";
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "center";
        el.style.width = "26px";
        el.style.height = "26px";
        el.style.borderRadius = "50%";
        el.style.background = "#FF4433";
        el.style.border = "2px solid #0F0C15";
        el.style.color = "#1A0710";
        el.style.fontWeight = "700";
        el.style.fontSize = "12px";
        el.style.fontFamily = "sans-serif";
        el.style.cursor = "pointer";
        el.textContent = String(index + 1);
        new maplibregl.Marker({ element: el }).setLngLat([candidate.longitude, candidate.latitude]).addTo(map);
      });

      // Fit to show both the origin pin and every candidate, instead of
      // just centering on one point and hoping the rest are in frame.
      const points = [origin, ...withCoords].filter(Boolean) as { latitude: number; longitude: number }[];
      const [first, ...rest] = points;
      if (first && rest.length > 0) {
        const bounds = rest.reduce(
          (b, p) => b.extend([p.longitude, p.latitude]),
          new maplibregl.LngLatBounds([first.longitude, first.latitude], [first.longitude, first.latitude])
        );
        map.fitBounds(bounds, { padding: 40, maxZoom: 17 });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  if (withCoords.length === 0 && !origin) return null;

  return (
    <div className="relative h-[220px] w-full overflow-hidden rounded-xl border border-border">
      <MapCanvas styleUrl={mapTilesUrl} center={center} zoom={15} onMapReady={handleMapReady} className="absolute inset-0" />
    </div>
  );
}
