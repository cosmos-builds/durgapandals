"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { MapCanvas } from "@durgapandals/maps/react";
import { buildClusterIndex, getClusters } from "@durgapandals/maps";
import { fetchPandalsForCity, type LocationSearchResult, type PandalSummary } from "@/lib/api";
import { hasSeenIntro, markIntroSeen } from "@/lib/visitor";
import { PandalPreviewSheet } from "./pandal-preview-sheet";
import { LocationSearchBox } from "./location-search-box";
import { CityYearPill } from "./city-year-pill";
import { IntroHero } from "./intro-hero";
import { FestiveBunting } from "./festive-bunting";
export interface MapHomeProps {
  citySlug: string;
  cityName: string;
  year: number;
  activeFestivalYear: number;
  availableYears: number[];
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
export function MapHome({
  citySlug,
  cityName,
  year,
  activeFestivalYear,
  availableYears,
  center,
  zoom,
  mapTilesUrl,
  pandals: initialPandals,
}: MapHomeProps) {
  const searchParams = useSearchParams();
  const focusSlug = searchParams.get("pandal");
  const [isDesktop, setIsDesktop] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locationOn, setLocationOn] = useState(false);
  const [locating, setLocating] = useState(false);
  const [pandals, setPandals] = useState(initialPandals);
  const [showSearchArea, setShowSearchArea] = useState(false);
  const [searchingArea, setSearchingArea] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [pandalQuery, setPandalQuery] = useState("");

  useEffect(() => {
    if (!hasSeenIntro()) setShowIntro(true);
  }, []);

  function dismissIntro() {
    markIntroSeen();
    setShowIntro(false);
  }

  const mapRef = useRef<maplibregl.Map | null>(null);
  const meMarkerRef = useRef<maplibregl.Marker | null>(null);
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null);
  const clusterMarkersRef = useRef<maplibregl.Marker[]>([]);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const byId = useRef<Record<string, PandalSummary>>({});
  byId.current = Object.fromEntries(pandals.map((p) => [p.id, p]));

  const clusterIndex = useMemo(
    () => buildClusterIndex(pandals.map((p) => ({ id: p.id, latitude: p.latitude, longitude: p.longitude }))),
    [pandals]
  );

  // Mobile's floating "Search pandals…" bar (spec: matches the mockup's Home
  // header) — a lightweight client-side filter over the already-loaded list,
  // not a new endpoint. Selecting a result flies the map to it, same as
  // tapping its marker or its desktop sidebar row.
  const pandalMatches = useMemo(() => {
    const q = pandalQuery.trim().toLowerCase();
    if (!q) return [];
    return pandals.filter((p) => p.canonicalName.toLowerCase().includes(q) || p.locality.toLowerCase().includes(q)).slice(0, 6);
  }, [pandals, pandalQuery]);

  function selectPandalFromSearch(id: string) {
    setPandalQuery("");
    setSelectedId(id);
    const target = byId.current[id];
    if (target) mapRef.current?.flyTo({ center: [target.longitude, target.latitude], zoom: Math.max(zoom, 15) });
  }

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  function selectPandal(id: string, { fly = false }: { fly?: boolean } = {}) {
    setSelectedId(id);
    const pandal = byId.current[id];
    if (!pandal) return;

    if (isDesktop) {
      rowRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (fly) mapRef.current?.flyTo({ center: [pandal.longitude, pandal.latitude], zoom: Math.max(zoom, 15) });
    }
  }

  // Google-Maps-style clustering instead of one raw pin per pandal — the
  // clustering index (@durgapandals/maps) already existed but had no
  // caller anywhere in the app. Clusters collapse nearby pins at low zoom
  // (tap -> zoom in); individual pins keep the existing tap-to-preview
  // behavior once zoomed in far enough to separate.
  const renderMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    clusterMarkersRef.current.forEach((m) => m.remove());
    clusterMarkersRef.current = [];

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
      el.style.cursor = "pointer";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";

      if (cluster.isCluster) {
        const size = 34 + Math.min(26, Math.log2(cluster.count) * 6);
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.border = "2px solid #0F0C15";
        el.style.borderRadius = "50%";
        el.style.background = "linear-gradient(135deg, #FFB547, #FF4433)";
        el.style.color = "#1A0710";
        el.style.fontWeight = "800";
        el.style.fontFamily = "'DM Sans', sans-serif";
        el.style.fontSize = "13px";
        el.textContent = String(cluster.count);
        el.onclick = () => {
          const expansionZoom = Math.min(clusterIndex.getClusterExpansionZoom(cluster.id as number), 18);
          map.flyTo({ center: [cluster.longitude, cluster.latitude], zoom: expansionZoom });
        };
      } else {
        const pandal = cluster.markerId ? byId.current[cluster.markerId] : undefined;
        el.setAttribute("aria-label", pandal?.canonicalName ?? "Pandal");
        el.style.width = "30px";
        el.style.height = "30px";
        el.innerHTML = '<img src="/images/marker-icon.svg" alt="" style="width:30px;height:30px" />';
        el.onclick = () => {
          if (pandal) selectPandal(pandal.id);
        };
      }

      clusterMarkersRef.current.push(
        new maplibregl.Marker({ element: el }).setLngLat([cluster.longitude, cluster.latitude]).addTo(map)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusterIndex]);

  // MapCanvas only calls onMapReady once (on mount), so a listener attached
  // there would otherwise close over the very first render's clusterIndex
  // forever — this ref lets it always dispatch to the latest renderMarkers
  // (e.g. after "Search this area" swaps the pandal list mid-session).
  const renderMarkersRef = useRef(renderMarkers);
  renderMarkersRef.current = renderMarkers;

  function handleMapReady(map: maplibregl.Map) {
    mapRef.current = map;
    map.on("moveend", () => renderMarkersRef.current());
    map.on("dragend", () => setShowSearchArea(true));
    renderMarkers();

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

  // Re-cluster whenever the underlying pandal list changes (e.g. after
  // "Search this area" swaps it out) — moveend won't fire on its own here.
  useEffect(() => {
    renderMarkers();
  }, [renderMarkers]);

  async function searchThisArea() {
    const map = mapRef.current;
    if (!map) return;
    setSearchingArea(true);
    try {
      const bounds = map.getBounds();
      const results = await fetchPandalsForCity(
        citySlug,
        {
          minLat: bounds.getSouth(),
          minLng: bounds.getWest(),
          maxLat: bounds.getNorth(),
          maxLng: bounds.getEast(),
        },
        year
      );
      setPandals(results);
      setShowSearchArea(false);
    } finally {
      setSearchingArea(false);
    }
  }

  // Location permission is optional (spec §6.1) — denial/failure falls back
  // to the city's configured center silently, it never blocks the map.
  function locateMe() {
    if (!navigator.geolocation) return;
    setLocating(true);
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
      () => setLocating(false),
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
    <div className="relative h-dvh w-full bg-ground md:flex md:h-[calc(100dvh-60px)]">
      {/* Mobile-only floating header (spec §4/§5) — logo + city/year pill +
          notification icon, then a pandal search bar, overlaid on the map
          instead of pushing it down. Desktop uses the persistent TopHeader
          instead (rendered one level up), so this is hidden there. */}
      <div className="absolute inset-x-3 top-3 z-20 flex flex-col gap-2 md:hidden">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="" className="h-[30px] w-[30px] flex-none object-contain" />
          <CityYearPill
            citySlug={citySlug}
            cityName={cityName}
            activeFestivalYear={activeFestivalYear}
            availableYears={availableYears}
            className="flex h-9 flex-1 items-center justify-between gap-1.5 rounded-xl bg-card px-2.5 font-body text-xs font-bold"
          />
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-card">
            <span className="material-symbols-rounded text-lg">notifications</span>
          </span>
        </div>
        <div className="relative">
          <div className="flex h-[42px] items-center gap-2 rounded-2xl bg-card px-3">
            <span className="material-symbols-rounded text-lg text-ink-muted">search</span>
            <input
              value={pandalQuery}
              onChange={(e) => setPandalQuery(e.target.value)}
              placeholder="Search pandals…"
              className="flex-1 bg-transparent font-body text-[13px] outline-none placeholder:text-ink-muted"
            />
          </div>
          {pandalMatches.length > 0 && (
            <div className="absolute inset-x-0 top-[calc(100%+6px)] flex flex-col gap-0.5 rounded-2xl border border-border bg-panel p-1.5 shadow-2xl">
              {pandalMatches.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectPandalFromSearch(p.id)}
                  className="rounded-xl px-3 py-2 text-left font-body text-sm font-semibold hover:bg-card"
                >
                  {p.canonicalName}
                  <span className="ml-1.5 font-normal text-ink-muted">{p.locality}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desktop sidebar — scrollable list, map lives beside it, not under it */}
      <aside className="hidden md:flex md:w-[420px] md:flex-none md:flex-col md:overflow-y-auto md:border-r md:border-border">
        <div className="flex flex-col gap-3 px-4 pb-3 pt-4">
          <LocationSearchBox citySlug={citySlug} onSelect={handleLocationSelect} biasCenter={center} />
          <span className="font-body text-sm font-semibold text-ink-muted">
            {pandals.length} pandals in {cityName} · {year}
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
                      <span
                        className="material-symbols-rounded festive-shimmer flex-none text-sm text-accent"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
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
                  <span className="mt-0.5 flex items-center gap-1 font-body text-xs font-semibold text-brand">
                    <span className="material-symbols-rounded text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                      favorite
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

        {/* Positioned below the mobile floating header (~104px tall); desktop
            has no overlaid header on the map itself, so it starts at top:0. */}
        <FestiveBunting
          className="pointer-events-none absolute inset-x-0 top-[104px] z-10 h-16 w-full px-4 md:top-0"
          flagCount={17}
        />

        {/* Matches the design: sits just under the header, not at the bottom
            of the screen (Google-Maps-style "search this area" placement). */}
        {showSearchArea && (
          <button
            onClick={searchThisArea}
            disabled={searchingArea}
            className="absolute left-1/2 top-[132px] z-10 flex h-8 -translate-x-1/2 items-center gap-1 rounded-pill bg-ink pl-2.5 pr-3 font-body text-xs font-bold text-ground shadow-lg disabled:opacity-70 md:top-4"
          >
            <span className="material-symbols-rounded text-base">{searchingArea ? "sync" : "search"}</span>
            {searchingArea ? "Searching…" : "Search this area"}
          </button>
        )}

        <button
          onClick={locateMe}
          disabled={locating}
          className="absolute bottom-[70px] right-4 z-10 flex h-[50px] w-[50px] items-center justify-center rounded-full border border-border bg-card shadow-lg disabled:opacity-60 md:bottom-4"
        >
          <span className={`material-symbols-rounded ${locationOn ? "text-info" : ""}`}>my_location</span>
        </button>
      </div>

      {!isDesktop && selectedPandal && (
        <PandalPreviewSheet citySlug={citySlug} pandal={selectedPandal} onClose={() => setSelectedId(null)} />
      )}

      {showIntro && <IntroHero citySlug={citySlug} onExplore={dismissIntro} />}
    </div>
  );
}
