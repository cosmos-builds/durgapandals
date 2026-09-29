"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import { MapCanvas } from "@durgapandals/maps/react";
import { buildClusterIndex, getClusters, type ClusterResult } from "@durgapandals/maps";

export interface DashboardPandal {
  id: string;
  canonicalName: string;
  locality?: string;
  cityId?: string;
  publicationStatus: string;
  latitude: number;
  longitude: number;
}

export interface PandalsClusterMapProps {
  mapTilesUrl: string;
  center: { latitude: number; longitude: number };
  zoom: number;
  pandals: DashboardPandal[];
  /** When given, a pin click calls this instead of navigating straight to
   *  the pandal's edit page — the Pandals list page uses this to show a
   *  details panel/drawer alongside the map instead of leaving it. Omit to
   *  keep the original "click -> open the pandal" behavior (the dashboard's
   *  overview map). */
  onSelectPandal?: (pandal: DashboardPandal) => void;
  /** Overrides the default h-[420px] w-full sizing — the Pandals list
   *  page's split map/detail layout needs a taller, flex-sized map. */
  className?: string;
}

// Google-Maps-style overview: clusters at low zoom (click -> zoom in),
// individual pins at high zoom (click -> select, or jump to that pandal's
// edit page if no onSelectPandal is given). The clustering index itself
// (@durgapandals/maps' buildClusterIndex/getClusters) already existed but
// had zero callers anywhere in the app.
export function PandalsClusterMap({
  mapTilesUrl,
  center,
  zoom,
  pandals,
  onSelectPandal,
  className = "h-[420px] w-full",
}: PandalsClusterMapProps) {
  const router = useRouter();
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  // Rebuilt whenever `pandals` changes (not just on first mount) — this map
  // is reused on the Pandals list page where the underlying set changes
  // every time a filter is touched, unlike the dashboard's one-shot load.
  const clusterIndex = useMemo(
    () => buildClusterIndex(pandals.map((p) => ({ id: p.id, latitude: p.latitude, longitude: p.longitude }))),
    [pandals]
  );
  const byId = useMemo(() => new Map(pandals.map((p) => [p.id, p])), [pandals]);

  const render = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const bounds = map.getBounds();
    const bbox: [number, number, number, number] = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ];
    const clusters = getClusters(clusterIndex, bbox, map.getZoom());

    for (const cluster of clusters) {
      const el = document.createElement("button");
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.border = "2px solid #0F0C15";
      el.style.cursor = "pointer";
      el.style.fontFamily = "sans-serif";
      el.style.fontWeight = "700";
      el.style.color = "#1A0710";

      if (cluster.isCluster) {
        const size = 30 + Math.min(24, Math.log2(cluster.count) * 6);
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.borderRadius = "50%";
        el.style.background = "#FFB547";
        el.style.fontSize = "13px";
        el.textContent = String(cluster.count);
        el.onclick = () => {
          const expansionZoom = Math.min(clusterIndex.getClusterExpansionZoom(cluster.id as number), 18);
          map.flyTo({ center: [cluster.longitude, cluster.latitude], zoom: expansionZoom });
        };
      } else {
        const pandal = cluster.markerId ? byId.get(cluster.markerId) : undefined;
        el.style.width = "20px";
        el.style.height = "20px";
        el.style.borderRadius = "50%";
        el.style.background = pandal?.publicationStatus === "PUBLISHED" ? "#FF4433" : "#A79FB0";
        el.setAttribute("aria-label", pandal?.canonicalName ?? "Pandal");
        el.onclick = () => {
          if (!pandal) return;
          if (onSelectPandal) onSelectPandal(pandal);
          else router.push(`/pandals/${pandal.id}`);
        };
      }

      markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([cluster.longitude, cluster.latitude]).addTo(map));
    }
  }, [clusterIndex, router, onSelectPandal]);

  // `render` gets a new identity whenever `clusterIndex` changes (filters
  // touched on the Pandals list page) — routed through a ref so the
  // `moveend` listener (attached once, on map-ready) always calls the
  // current version instead of the stale closure it was registered with.
  const renderRef = useRef(render);
  useEffect(() => {
    renderRef.current = render;
    render();
  }, [render]);

  const handleMapReady = useCallback((map: MapLibreMap) => {
    mapRef.current = map;
    map.on("moveend", () => renderRef.current());
    renderRef.current();
  }, []);

  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => m.remove());
    };
  }, []);

  return (
    <div className={`relative overflow-hidden rounded-xl border border-border ${className}`}>
      <MapCanvas styleUrl={mapTilesUrl} center={center} zoom={zoom} onMapReady={handleMapReady} className="absolute inset-0" />
    </div>
  );
}
