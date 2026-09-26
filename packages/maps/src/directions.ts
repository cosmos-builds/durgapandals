// V1 hands off to external navigation instead of building turn-by-turn
// routing (spec §11) — this is the one place that constructs the deep link.
export function externalDirectionsUrl(destination: { latitude: number; longitude: number }): string {
  const { latitude, longitude } = destination;
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}
