import type { StyleSpecification } from "maplibre-gl";

// Domain code (web/admin) only ever calls buildMapStyle() — it never
// imports a MapLibre StyleSpecification from a vendor URL directly, so the
// tile source (OpenFreeMap today) can be swapped for MapTiler/Stadia/self
// hosted tiles later without touching product code (spec §6.2, §31.5).
export interface MapProviderConfig {
  styleUrl: string;
}

const PALETTE = {
  ground: "#15121A",
  water: "#1B1622",
  road: "#3A3342",
  roadMinor: "#2A2432",
  label: "#A79FB0",
  labelHalo: "#0F0C15",
  poi: "#5C5468",
  border: "#221C2B",
};

// Applies the product's dark visual identity on top of the base OSM-derived
// style (spec §6.3) — keeps roads/labels readable while matching the app's
// violet-black ground + alta-pink accent palette used throughout the UI.
export async function buildMapStyle(config: MapProviderConfig): Promise<StyleSpecification> {
  const response = await fetch(config.styleUrl);
  const style = (await response.json()) as StyleSpecification;

  for (const layer of style.layers) {
    if (!("paint" in layer) || !layer.paint) continue;
    const paint = layer.paint as Record<string, unknown>;

    // Every branch below is gated on the layer's actual type first — setting
    // e.g. `fill-color` on a `line` or `fill-extrusion` layer isn't just a
    // no-op, it fails MapLibre's style validation, and a failed validation
    // rejects the ENTIRE style (not just that layer). That previously left
    // the map canvas rendering (background only) with no roads, water,
    // labels or buildings — everything except our own marker overlays,
    // which don't depend on style validity at all.
    if (layer.type === "background") paint["background-color"] = PALETTE.ground;
    if (layer.type === "fill" && layer.id.includes("water")) paint["fill-color"] = PALETTE.water;
    if (layer.type === "line" && layer.id.includes("road")) {
      paint["line-color"] = layer.id.includes("minor") ? PALETTE.roadMinor : PALETTE.road;
    }
    if (layer.type === "symbol") {
      paint["text-color"] = PALETTE.label;
      paint["text-halo-color"] = PALETTE.labelHalo;
      paint["text-halo-width"] = 1.2;
    }
    if (layer.type === "fill" && layer.id.includes("building")) paint["fill-color"] = PALETTE.border;
    if (layer.type === "fill-extrusion" && layer.id.includes("building")) {
      paint["fill-extrusion-color"] = PALETTE.border;
    }
  }

  return style;
}
