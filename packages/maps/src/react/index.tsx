"use client";

import { useEffect, useRef } from "react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import { buildMapStyle } from "../tile-provider";

export interface MapCanvasProps {
  styleUrl: string;
  center: { latitude: number; longitude: number };
  zoom: number;
  onMapReady?: (map: MapLibreMap) => void;
  className?: string;
}

// The only component in the app that touches maplibre-gl directly — web/admin
// screens render this and talk to the map through onMapReady, keeping the
// vendor swap contained here (spec §6.2, §31.5).
export function MapCanvas({ styleUrl, center, zoom, onMapReady, className }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;

    buildMapStyle({ styleUrl }).then((style) => {
      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: [center.longitude, center.latitude],
        zoom,
        attributionControl: false,
      });

      // A style-validation failure (e.g. an invalid paint property) makes
      // MapLibre silently reject the whole style — the canvas still mounts,
      // but no basemap layers render, which otherwise looks indistinguishable
      // from a network/tile problem. Surface it instead of failing silently.
      map.on("error", (e) => console.error("MapLibre error:", e.error));

      mapRef.current = map;
      onMapReady?.(map);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl]);

  return <div ref={containerRef} className={className} style={{ width: "100%", height: "100%" }} />;
}
