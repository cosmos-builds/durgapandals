import Supercluster from "supercluster";

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
}

export interface ClusterResult {
  id: string | number;
  latitude: number;
  longitude: number;
  isCluster: boolean;
  count: number;
  markerId?: string;
}

interface MarkerProperties {
  markerId: string;
}

export function buildClusterIndex(markers: MapMarker[]) {
  const index = new Supercluster<MarkerProperties>({ radius: 60, maxZoom: 18 });
  index.load(
    markers.map((marker) => ({
      type: "Feature",
      properties: { markerId: marker.id },
      geometry: { type: "Point", coordinates: [marker.longitude, marker.latitude] },
    }))
  );
  return index;
}

export function getClusters(
  index: ReturnType<typeof buildClusterIndex>,
  bbox: [number, number, number, number],
  zoom: number
): ClusterResult[] {
  return index.getClusters(bbox, Math.round(zoom)).map((feature) => {
    const [longitude, latitude] = feature.geometry.coordinates as [number, number];
    const properties = feature.properties as MarkerProperties & Partial<Supercluster.ClusterProperties>;
    const isCluster = Boolean(properties.cluster);
    return {
      id: feature.id ?? properties.markerId,
      latitude,
      longitude,
      isCluster,
      count: isCluster ? (properties.point_count ?? 1) : 1,
      markerId: isCluster ? undefined : properties.markerId,
    };
  });
}
