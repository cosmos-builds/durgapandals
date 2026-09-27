import type { StyleSpecification } from "maplibre-gl";

// Domain code (web/admin) only ever calls buildMapStyle() — it never
// imports a MapLibre StyleSpecification from a vendor URL directly, so the
// tile source (OpenFreeMap today) can be swapped for MapTiler/Stadia/self
// hosted tiles later without touching product code (spec §6.2, §31.5).
export interface MapProviderConfig {
  styleUrl: string;
}

const PALETTE = {
  ground: "#EDEAE3",
  water: "#AAD3DF",
  road: "#FFFFFF",
  roadMinor: "#F7F5F1",
  label: "#5C5448",
  labelHalo: "#FFFFFF",
  poi: "#8A8272",
  border: "#E2DED4",
  placeLabel: "#3A342C",
};

// The base style's suburb/neighbourhood/locality label layer (source style's
// "label_other" — its filter explicitly catches every place class OTHER
// than city/town/village/state/country/continent) renders at only 9–10px,
// uppercase, italic — technically present but easy to miss entirely on a
// live map, which is what read as "no labels on sections of the city" when
// zoomed to a normal browsing level. City/town names don't have this
// problem (they scale up to 13–20px already).
const LOCALITY_LABEL_LAYER_ID = "label_other";

// The map canvas itself is deliberately light — unlike the rest of the
// app's dark-only UI (spec §28.2), a light basemap reads roads/labels more
// clearly and is what "map mode" means to most users coming from Google
// Maps. Everything else (chrome, cards, sheets) stays dark.
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
      const isLocalityLabel = layer.id === LOCALITY_LABEL_LAYER_ID;
      paint["text-color"] = isLocalityLabel ? PALETTE.placeLabel : PALETTE.label;
      paint["text-halo-color"] = PALETTE.labelHalo;
      paint["text-halo-width"] = isLocalityLabel ? 1.6 : 1.2;

      if (isLocalityLabel && "layout" in layer && layer.layout) {
        const layout = layer.layout as Record<string, unknown>;
        // Same zoom breakpoints as the source style, just legible sizes
        // instead of 9–10px — this is the actual fix, the color/halo bump
        // above only helps once the text is big enough to read at all.
        layout["text-size"] = ["interpolate", ["linear"], ["zoom"], 8, 12, 12, 14];
      }
    }
    if (layer.type === "fill" && layer.id.includes("building")) paint["fill-color"] = PALETTE.border;
    if (layer.type === "fill-extrusion" && layer.id.includes("building")) {
      paint["fill-extrusion-color"] = PALETTE.border;
    }
  }

  return style;
}
