// V1 hands off to external navigation instead of building turn-by-turn
// routing (spec §11) — this is the one place that constructs the deep link.
export function externalDirectionsUrl(destination: {
  latitude: number;
  longitude: number;
}): string {
  const { latitude, longitude } = destination;
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

// Google's directions URL API caps at 9 intermediate waypoints (10 stops
// total including origin/destination) — anything beyond that is silently
// dropped by Google rather than erroring, so callers building a trail-picker
// UI should cap selection at this instead of finding out after the fact.
export const MAX_TRAIL_STOPS = 10;

// `origin`, when given (the visitor's live geolocation — see trail-sheet.tsx),
// is the route's true starting point, with every stop as a waypoint/
// destination. Omitted, this falls back to the original behavior — the
// first-added stop doubles as the origin — which is also what a shared
// WhatsApp link keeps using unconditionally, since it can't meaningfully
// encode "the sender's location" for whoever opens it.
export function externalTrailDirectionsUrl(
  stops: { latitude: number; longitude: number }[],
  origin?: { latitude: number; longitude: number },
): string {
  const allStops = origin ? stops : stops.slice(1);
  const routeOrigin = origin ?? stops[0];
  if (!routeOrigin) return "";
  if (allStops.length === 0) return externalDirectionsUrl(routeOrigin);

  const destination = allStops[allStops.length - 1] as {
    latitude: number;
    longitude: number;
  };
  const waypoints = allStops.slice(0, -1);

  const params = new URLSearchParams({
    api: "1",
    origin: `${routeOrigin.latitude},${routeOrigin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
  });
  if (waypoints.length > 0) {
    params.set(
      "waypoints",
      waypoints.map((w) => `${w.latitude},${w.longitude}`).join("|"),
    );
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
