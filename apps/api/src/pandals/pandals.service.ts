import { PandalModel, PandalYearModel, toGeoPoint, fromGeoPoint } from "@durgapandals/database";
import { findDuplicateCandidates, type CandidatePandal } from "@durgapandals/deduplication";

// Shared so admin create, public submission review, and CSV import all run
// the exact same duplicate scoring against the exact same candidate pool
// (spec §17.4) — nobody re-implements this query elsewhere.
export async function findNearbyDuplicates(input: {
  cityId: string;
  canonicalName: string;
  organizerName?: string;
  publicContact?: string;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
}) {
  const radius = input.radiusMeters ?? 600;

  const nearby = await PandalModel.find({
    cityId: input.cityId,
    publicationStatus: { $ne: "REJECTED" },
    location: {
      $near: {
        $geometry: toGeoPoint(input.latitude, input.longitude),
        $maxDistance: radius,
      },
    },
  }).limit(25);

  const candidates: CandidatePandal[] = nearby.map((pandal) => ({
    id: String(pandal._id),
    canonicalName: pandal.canonicalName,
    alternateNames: pandal.alternateNames,
    organizerName: pandal.organizerName ?? undefined,
    ...fromGeoPoint(pandal.location),
    publicContact: pandal.publicContact ?? undefined,
  }));

  return findDuplicateCandidates(input, candidates);
}

// Powers the live "we found pandals near your pin" sheet in the Add Pandal
// flow (spec §17.1) — shown as soon as a location is dropped, before the
// contributor has typed a name, so this is purely proximity-based.
export async function findNearbyPandals(input: {
  cityId: string;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
}) {
  const radius = input.radiusMeters ?? 400;

  const nearby = await PandalModel.find({
    cityId: input.cityId,
    publicationStatus: { $ne: "REJECTED" },
    location: {
      $near: {
        $geometry: toGeoPoint(input.latitude, input.longitude),
        $maxDistance: radius,
      },
    },
  }).limit(5);

  return nearby.map((pandal) => ({
    id: String(pandal._id),
    canonicalName: pandal.canonicalName,
    locality: pandal.locality,
    ...fromGeoPoint(pandal.location),
  }));
}

export async function listPublishedPandalsForCity(cityId: string, year: number) {
  const publishedYears = await PandalYearModel.find({
    year,
    publicationStatus: "PUBLISHED",
  }).populate({
    path: "pandalId",
    match: { cityId, publicationStatus: "PUBLISHED" },
  });

  return publishedYears.filter((py) => py.pandalId != null);
}
