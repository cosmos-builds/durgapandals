"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { AnimatePresence } from "motion/react";
import { MapCanvas } from "@durgapandals/maps/react";
import { buildClusterIndex, getClusters } from "@durgapandals/maps";
import { fetchPandalsForCity, pandalDetailHref, type LocationSearchResult, type PandalSummary } from "@/lib/api";
import { hasSeenIntro, markIntroSeen, hasDismissedAddPandalBanner, dismissAddPandalBanner } from "@/lib/visitor";
import { getTrail, TRAIL_CHANGED_EVENT } from "@/lib/trail";
import { PandalPreviewSheet } from "./pandal-preview-sheet";
import { LocationSearchBox } from "./location-search-box";
import { CityYearPill } from "./city-year-pill";
import { MobileHeader } from "./mobile-header";
import { IntroHero } from "./intro-hero";
import { FestiveBunting } from "./festive-bunting";
import { PandalPhotoPlaceholder } from "./pandal-photo-placeholder";
import { TrailButton } from "./trail-button";
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
  const [addBannerDismissed, setAddBannerDismissed] = useState(false);

  useEffect(() => {
    if (!hasSeenIntro()) setShowIntro(true);
  }, []);

  useEffect(() => {
    setAddBannerDismissed(hasDismissedAddPandalBanner(citySlug, year));
  }, [citySlug, year]);

  // `useState(initialPandals)` only reads its argument on the very first
  // mount — switching the year (or city) via the picker changes the
  // `?year=` query param and the server re-renders this page with fresh
  // `pandals` for that year, but React reuses this same MapHome instance
  // (same route) rather than remounting it, so the old `pandals` state was
  // silently staying put and the map kept showing the previous year's
  // listings. Re-sync whenever the city or year actually changes.
  useEffect(() => {
    setPandals(initialPandals);
    setSelectedId(null);
    setShowSearchArea(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citySlug, year]);

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

  // The trail-planner's in-app preview (see TrailSheet/TrailButton) — a
  // straight-line "here's the shape of your day" connecting whatever
  // pandals are in the visitor's trail, drawn right on this map rather than
  // only ever being visible after leaving the app for Google Maps.
  const [trailSlugs, setTrailSlugs] = useState<string[]>([]);
  useEffect(() => {
    function sync() {
      setTrailSlugs(getTrail(citySlug));
    }
    sync();
    window.addEventListener(TRAIL_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(TRAIL_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [citySlug]);

  const trailStops = useMemo(() => {
    const bySlug = new Map(pandals.map((p) => [p.slug, p]));
    return trailSlugs.map((slug) => bySlug.get(slug)).filter((p): p is PandalSummary => Boolean(p));
  }, [pandals, trailSlugs]);

  const TRAIL_LINE_SOURCE = "trail-route-line";
  const TRAIL_POINTS_SOURCE = "trail-route-points";

  // A GeoJSON LineString needs >=2 positions to be valid, and there's no
  // "update to empty" for a layer — shrinking below the threshold has to
  // remove the layer/source outright, not just setData an invalid shape.
  function removeLayerAndSource(map: maplibregl.Map, sourceId: string, layerIds: string[]) {
    for (const layerId of layerIds) {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    }
    if (map.getSource(sourceId)) map.removeSource(sourceId);
  }

  const renderTrailRoute = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (trailStops.length >= 2) {
      const lineData: GeoJSON.Feature<GeoJSON.LineString> = {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: trailStops.map((s) => [s.longitude, s.latitude]) },
      };
      const lineSource = map.getSource(TRAIL_LINE_SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (lineSource) {
        lineSource.setData(lineData);
      } else {
        map.addSource(TRAIL_LINE_SOURCE, { type: "geojson", data: lineData });
        map.addLayer({
          id: TRAIL_LINE_SOURCE,
          type: "line",
          source: TRAIL_LINE_SOURCE,
          paint: { "line-color": "#FFB547", "line-width": 3, "line-dasharray": [0.2, 1.6] },
        });
      }
    } else {
      removeLayerAndSource(map, TRAIL_LINE_SOURCE, [TRAIL_LINE_SOURCE]);
    }

    if (trailStops.length > 0) {
      const pointsData: GeoJSON.FeatureCollection<GeoJSON.Point, { order: number }> = {
        type: "FeatureCollection",
        features: trailStops.map((s, index) => ({
          type: "Feature",
          properties: { order: index + 1 },
          geometry: { type: "Point", coordinates: [s.longitude, s.latitude] },
        })),
      };
      const pointsSource = map.getSource(TRAIL_POINTS_SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (pointsSource) {
        pointsSource.setData(pointsData);
      } else {
        map.addSource(TRAIL_POINTS_SOURCE, { type: "geojson", data: pointsData });
        map.addLayer({
          id: `${TRAIL_POINTS_SOURCE}-circle`,
          type: "circle",
          source: TRAIL_POINTS_SOURCE,
          paint: { "circle-radius": 11, "circle-color": "#FF4433", "circle-stroke-width": 2, "circle-stroke-color": "#0F0C15" },
        });
        map.addLayer({
          id: `${TRAIL_POINTS_SOURCE}-label`,
          type: "symbol",
          source: TRAIL_POINTS_SOURCE,
          layout: { "text-field": ["to-string", ["get", "order"]], "text-size": 12, "text-allow-overlap": true },
          paint: { "text-color": "#FFFFFF" },
        });
      }
    } else {
      removeLayerAndSource(map, TRAIL_POINTS_SOURCE, [`${TRAIL_POINTS_SOURCE}-circle`, `${TRAIL_POINTS_SOURCE}-label`]);
    }
  }, [trailStops]);

  useEffect(() => {
    renderTrailRoute();
  }, [renderTrailRoute]);

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
        el.style.position = "relative";
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.border = "2px solid #0F0C15";
        el.style.borderRadius = "50%";
        el.style.background = "linear-gradient(135deg, #FFB547, #FF4433)";
        el.innerHTML = `
          <img src="/images/marker-icon.svg" alt="" style="width:${size * 0.6}px;height:${size * 0.6}px" />
          <span style="position:absolute;top:-4px;right:-4px;display:flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 4px;border-radius:9px;border:2px solid #0F0C15;background:#1A0710;color:#F4EFF6;font-weight:800;font-family:'DM Sans',sans-serif;font-size:11px;line-height:1;">${cluster.count}</span>
        `;
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
  const renderTrailRouteRef = useRef(renderTrailRoute);
  renderTrailRouteRef.current = renderTrailRoute;

  function handleMapReady(map: maplibregl.Map) {
    mapRef.current = map;
    map.on("moveend", () => renderMarkersRef.current());
    map.on("dragend", () => setShowSearchArea(true));
    // Sources/layers (the trail route) can only be added once the style has
    // actually finished loading — renderTrailRoute() below no-ops until
    // then, so this catches whichever trail state exists the moment it does.
    map.on("load", () => renderTrailRouteRef.current());
    renderMarkers();
    renderTrailRoute();

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
      {/* Mobile-only floating header (spec §4/§5) — brand row (with the
          current city/year now shown as a subtitle there, see
          mobile-header.tsx), then a pandal search bar with a small icon
          button to change city/year, overlaid on the map instead of
          pushing it down. Desktop uses the persistent TopHeader instead
          (rendered one level up), so this is hidden there. */}
      <div className="absolute inset-x-3 top-3 z-20 flex flex-col gap-2 md:hidden">
        <MobileHeader
          citySlug={citySlug}
          cityName={cityName}
          year={year}
          className="rounded-xl bg-card/90 px-2.5 py-1.5 backdrop-blur"
        />
        <div className="relative flex min-w-0 items-center gap-2">
          <div className="flex h-[42px] min-w-0 flex-1 items-center gap-2 rounded-2xl bg-card px-3">
            <span className="material-symbols-rounded text-lg text-ink-muted">search</span>
            <input
              value={pandalQuery}
              onChange={(e) => setPandalQuery(e.target.value)}
              placeholder="Search pandals…"
              className="min-w-0 flex-1 bg-transparent font-body text-[13px] outline-none placeholder:text-ink-muted"
            />
          </div>
          <CityYearPill
            citySlug={citySlug}
            cityName={cityName}
            activeFestivalYear={activeFestivalYear}
            availableYears={availableYears}
            variant="icon"
            className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-2xl bg-card"
          />
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
                  {pandal.year?.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pandal.year.coverImage} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <PandalPhotoPlaceholder className="h-full w-full" />
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
                      href={pandalDetailHref(citySlug, pandal)}
                      className="mt-1 flex w-fit items-center gap-1 font-body text-xs font-bold text-brand"
                    >
                      View details
                      <span className="material-symbols-rounded text-sm">arrow_forward</span>
                    </Link>
                  )}
                </div>
                <TrailButton citySlug={citySlug} slug={pandal.slug} className="self-center" />
              </div>
            );
          })}
          {pandals.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-2 py-8 text-center">
              <p className="font-body text-sm text-ink-muted">
                No pandals added yet for {cityName} in {year}. Know one? Be the first to add it.
              </p>
              <Link
                href={`/${citySlug}/add`}
                className="rounded-pill bg-brand px-4 py-2 font-body text-sm font-bold text-brand-ink"
              >
                Add a pandal
              </Link>
            </div>
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
          className="pointer-events-none absolute inset-x-0 top-[112px] z-10 h-16 w-full px-4 md:top-0"
          flagCount={17}
        />

        {/* Mobile-only empty-state banner — desktop already shows the same
            message in the sidebar list (see the `pandals.length === 0` block
            above), so this exists purely because mobile has no sidebar to
            show it in. Sits above the "search this area"/"locate me" row so
            the two never overlap. */}
        {pandals.length === 0 && !addBannerDismissed && (
          <div className="absolute inset-x-4 bottom-[130px] z-10 flex flex-col items-center gap-2 rounded-2xl bg-panel/95 p-4 text-center shadow-2xl md:hidden">
            <button
              onClick={() => {
                dismissAddPandalBanner(citySlug, year);
                setAddBannerDismissed(true);
              }}
              aria-label="Dismiss"
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-ink-muted"
            >
              <span className="material-symbols-rounded text-lg">close</span>
            </button>
            <p className="font-body text-sm text-ink-muted">
              No pandals added yet for {cityName} in {year}. Know one? Be the first to add it.
            </p>
            <Link
              href={`/${citySlug}/add`}
              className="rounded-pill bg-brand px-4 py-2 font-body text-sm font-bold text-brand-ink"
            >
              Add a pandal
            </Link>
          </div>
        )}

        {/* Bottom of the screen on mobile (thumb-reachable, matches the
            "locate me" button's row) — desktop keeps it near the top,
            beside the persistent nav bar. */}
        {showSearchArea && (
          <button
            onClick={searchThisArea}
            disabled={searchingArea}
            className="absolute bottom-[70px] left-1/2 z-10 flex h-8 -translate-x-1/2 items-center gap-1 rounded-pill bg-ground/80 pl-2.5 pr-3 font-body text-xs font-bold text-ink shadow-lg disabled:opacity-70 md:top-4 md:bottom-auto"
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

      <AnimatePresence>
        {!isDesktop && selectedPandal && (
          <PandalPreviewSheet citySlug={citySlug} pandal={selectedPandal} onClose={() => setSelectedId(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>{showIntro && <IntroHero citySlug={citySlug} onExplore={dismissIntro} />}</AnimatePresence>
    </div>
  );
}
