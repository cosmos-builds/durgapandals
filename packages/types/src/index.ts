// Shared domain types — the single contract between api/web/admin.
// No product-specific values (city names, years, categories) live here;
// those are data, loaded from the database/config packages.

export type CityStatus = "ACTIVE" | "COMING_SOON" | "DISABLED";

export interface City {
  id: string;
  name: string;
  slug: string;
  state: string;
  stateCode: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  defaultMapZoom: number;
  status: CityStatus;
  activeFestivalYear: number;
  createdAt: string;
  updatedAt: string;
}

export type PublicationStatus =
  | "DRAFT"
  | "PENDING"
  | "PUBLISHED"
  | "ARCHIVED"
  | "REJECTED";

export type VerificationStatus = "UNVERIFIED" | "VERIFIED" | "DUPLICATE";

export interface Pandal {
  id: string;
  cityId: string;
  slug: string;

  canonicalName: string;
  alternateNames: string[];
  organizerName?: string;

  latitude: number;
  longitude: number;
  address: string;
  locality: string;
  landmark?: string;

  publicContact?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  websiteUrl?: string;

  verificationStatus: VerificationStatus;
  publicationStatus: PublicationStatus;

  createdAt: string;
  updatedAt: string;
}

export interface PandalYear {
  id: string;
  pandalId: string;
  year: number;

  displayName?: string;
  theme?: string;
  description?: string;

  startDate?: string;
  endDate?: string;
  openingHours?: string;

  parkingInfo?: string;
  entryInfo?: string;
  accessibilityInfo?: string;

  coverImage?: string;
  photos: MediaAsset[];

  categories: string[];
  tags: string[];

  featured: boolean;

  publicationStatus: PublicationStatus;
  verificationStatus: VerificationStatus;

  createdAt: string;
  updatedAt: string;
}

export interface MediaAsset {
  id: string;
  url: string;
  width?: number;
  height?: number;
  altText?: string;
  caption?: string;
}

export type SubmissionType =
  | "NEW_PANDAL"
  | "UPDATE_PANDAL"
  | "NEW_YEAR"
  | "CORRECTION";

export type SubmissionStatus = "PENDING" | "APPROVED" | "MERGED" | "REJECTED";

export interface DuplicateCandidate {
  pandalId: string;
  score: number;
  reasons: string[];
  distanceMeters?: number;
}

export interface PandalSubmission {
  id: string;
  cityId: string;
  type: SubmissionType;
  possiblePandalId?: string;
  contributorId?: string;
  submittedData: Record<string, unknown>;
  status: SubmissionStatus;
  duplicateCandidates?: DuplicateCandidate[];
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Reaction {
  id: string;
  pandalYearId: string;
  anonymousVisitorId: string;
  type: "LIKE";
  createdAt: string;
}

export type AdminRole = "ADMIN";

export interface AdminUser {
  id: string;
  email: string;
  role: AdminRole;
  createdAt: string;
}
