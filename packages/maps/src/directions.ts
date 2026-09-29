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

export function externalTrailDirectionsUrl(
  stops: { latitude: number; longitude: number }[],
): string {
  const origin = stops[0];
  if (!origin) return "";
  if (stops.length === 1) return externalDirectionsUrl(origin);

  const rest = stops.slice(1);
  const destination = rest[rest.length - 1] as {
    latitude: number;
    longitude: number;
  };
  const waypoints = rest.slice(0, -1);

  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.latitude},${origin.longitude}`,
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
