import { distanceMeters, normalizeName, stringSimilarity } from "./normalize";

export interface CandidatePandal {
  id: string;
  canonicalName: string;
  alternateNames: string[];
  organizerName?: string;
  latitude: number;
  longitude: number;
  publicContact?: string;
}

export interface SubmittedPandal {
  canonicalName: string;
  organizerName?: string;
  latitude: number;
  longitude: number;
  publicContact?: string;
}

export interface DuplicateScore {
  pandalId: string;
  score: number; // 0..1, higher = more likely the same pandal
  reasons: string[];
  distanceMeters: number;
}

// Distance alone never decides a match (spec §17.2) — proximity is one
// signal among several, weighted and combined with name/organizer/contact
// similarity so two genuinely distinct pandals a few meters apart don't
// get flagged as duplicates of each other.
const WEIGHTS = {
  name: 0.45,
  proximity: 0.3,
  organizer: 0.15,
  contact: 0.1,
};

const PROXIMITY_CUTOFF_METERS = 400;

function proximityScore(distance: number): number {
  if (distance >= PROXIMITY_CUTOFF_METERS) return 0;
  return 1 - distance / PROXIMITY_CUTOFF_METERS;
}

export function scoreCandidate(
  submitted: SubmittedPandal,
  candidate: CandidatePandal
): DuplicateScore {
  const reasons: string[] = [];

  const submittedName = normalizeName(submitted.canonicalName);
  const nameScore = Math.max(
    stringSimilarity(submittedName, normalizeName(candidate.canonicalName)),
    ...candidate.alternateNames.map((alt) =>
      stringSimilarity(submittedName, normalizeName(alt))
    ),
    0
  );
  if (nameScore > 0.6) reasons.push("Similar name");

  const distance = distanceMeters(submitted, candidate);
  const proximity = proximityScore(distance);
  if (proximity > 0.5) reasons.push(`${Math.round(distance)}m away`);

  const organizerScore =
    submitted.organizerName && candidate.organizerName
      ? stringSimilarity(
          normalizeName(submitted.organizerName),
          normalizeName(candidate.organizerName)
        )
      : 0;
  if (organizerScore > 0.7) reasons.push("Same organizer/committee");

  const contactScore =
    submitted.publicContact &&
    candidate.publicContact &&
    submitted.publicContact.trim() === candidate.publicContact.trim()
      ? 1
      : 0;
  if (contactScore === 1) reasons.push("Same contact details");

  const score =
    nameScore * WEIGHTS.name +
    proximity * WEIGHTS.proximity +
    organizerScore * WEIGHTS.organizer +
    contactScore * WEIGHTS.contact;

  return {
    pandalId: candidate.id,
    score: Math.round(score * 1000) / 1000,
    reasons,
    distanceMeters: Math.round(distance),
  };
}

export interface FindDuplicatesOptions {
  minScore?: number; // below this, don't surface as a candidate at all
  maxResults?: number;
}

// candidates should already be pre-filtered to the same city and a wide
// geographic radius (e.g. via a $near query in packages/database) before
// being passed here — this function only ranks, it does not fetch.
export function findDuplicateCandidates(
  submitted: SubmittedPandal,
  candidates: CandidatePandal[],
  options: FindDuplicatesOptions = {}
): DuplicateScore[] {
  const { minScore = 0.35, maxResults = 5 } = options;

  return candidates
    .map((candidate) => scoreCandidate(submitted, candidate))
    .filter((result) => result.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}
