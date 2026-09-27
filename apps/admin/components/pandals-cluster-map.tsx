"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import { MapCanvas } from "@durgapandals/maps/react";
import { buildClusterIndex, getClusters, type ClusterResult } from "@durgapandals/maps";

export interface DashboardPandal {
  id: string;
  canonicalName: string;
  publicationStatus: string;
  latitude: number;
  longitude: number;
}

export interface PandalsClusterMapProps {
  mapTilesUrl: string;
  center: { latitude: number; longitude: number };
  zoom: number;
  pandals: DashboardPandal[];
}

// Google-Maps-style overview: clusters at low zoom (click -> zoom in),
// individual pins at high zoom (click -> jump to that pandal's edit page).
// The clustering index itself (@durgapandals/maps' buildClusterIndex/
// getClusters) already existed but had zero callers anywhere in the app.
export function PandalsClusterMap({ mapTilesUrl, center, zoom, pandals }: PandalsClusterMapProps) {
  const router = useRouter();
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [clusterIndex] = useState(() =>
    buildClusterIndex(pandals.map((p) => ({ id: p.id, latitude: p.latitude, longitude: p.longitude })))
  );
  const byId = useRef(new Map(pandals.map((p) => [p.id, p])));

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
        const pandal = cluster.markerId ? byId.current.get(cluster.markerId) : undefined;
        el.style.width = "20px";
        el.style.height = "20px";
        el.style.borderRadius = "50%";
        el.style.background = pandal?.publicationStatus === "PUBLISHED" ? "#FF4433" : "#A79FB0";
        el.setAttribute("aria-label", pandal?.canonicalName ?? "Pandal");
        el.onclick = () => {
          if (pandal) router.push(`/pandals/${pandal.id}`);
        };
      }

      markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([cluster.longitude, cluster.latitude]).addTo(map));
    }
  }, [clusterIndex, router]);

  const handleMapReady = useCallback(
    (map: MapLibreMap) => {
      mapRef.current = map;
      map.on("moveend", render);
      render();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => m.remove());
    };
  }, []);

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-xl border border-border">
      <MapCanvas styleUrl={mapTilesUrl} center={center} zoom={zoom} onMapReady={handleMapReady} className="absolute inset-0" />
    </div>
  );
}
