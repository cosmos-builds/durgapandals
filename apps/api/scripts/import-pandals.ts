// One-off importer for curated/researched pandal datasets (e.g.
// data/<city>_pandals_master_<year>.json) — strips the research-only /
// auto-generated fields the source JSON carries (ids, slug, cityId as a
// slug string, verification/publication status, addedBy) and re-derives
// them the same way the admin "create pandal" endpoint does, so imported
// records are indistinguishable from ones an admin typed in by hand.
//
// Runs the exact same duplicate scoring used by the live app
// (packages/deduplication, spec §17.4) against both the existing DB and
// the rest of the batch, purely to surface anything NOT already accounted
// for below — it never auto-skips on its own, since that score is unreliable
// here (existing draft rows have rough/guessed coordinates that zero out the
// distance signal even for genuine duplicates).
//
// Usage:
//   pnpm --filter @durgapandals/api exec tsx scripts/import-pandals.ts <file.json> [--commit]
// Without --commit this only prints a report (dry run).
//
// KNOWN_DUPLICATES below was compiled by hand (2026-09-29) after cross-
// checking this file's bhopal_pandals_master_2026.json against the 19
// existing Bhopal records already in the DB (an earlier, cruder research
// pass for the same season) — see conversation for the reasoning per pair.
// A fresh source file / city needs this reviewed again before --commit.

import "../src/load-env";
import { loadServerEnv } from "@durgapandals/config";
import { connectDatabase, CityModel, PandalModel, PandalYearModel, toGeoPoint } from "@durgapandals/database";
import { uniqueSlug } from "@durgapandals/utils";
import { findDuplicateCandidates, type CandidatePandal } from "@durgapandals/deduplication";

const DUPLICATE_SCORE_THRESHOLD = 0.55;

// Confirmed same real-world pandal as an existing DB record (matched by
// exact organizer-name + locality overlap despite the draft record's
// coordinates being 1-3km off) — update the existing record in place with
// this file's better data instead of creating a second row for it.
const KNOWN_DUPLICATES: Record<number, string> = {
  1001: "Shri Maa Durga Utsav Samiti",
  1002: "Nav Yuvak Durga Utsav Samiti",
};

// Ambiguous cluster: several source entries near "New Market" that may or
// may not correspond 1:1 to the single vague existing "Vyapari Durga Utsav
// Samiti" record. Imported as new (nothing lost) but called out after the
// run so an admin can merge/reconcile with full context.
const FLAG_FOR_MANUAL_REVIEW: Record<number, string> = {
  1004: 'possible overlap with existing "Vyapari Durga Utsav Samiti" (New Market)',
  1010: 'possible overlap with existing "Vyapari Durga Utsav Samiti" (New Market)',
  1022: 'possible overlap with existing "Vyapari Durga Utsav Samiti" (New Market)',
  1023: 'possible overlap with existing "Vyapari Durga Utsav Samiti" (New Market)',
  1024: 'possible overlap with existing "Vyapari Durga Utsav Samiti" (New Market)',
};

const VISIT_TYPE_MAP: Record<string, "WALKING_DARSHAN" | "PARK_AND_VISIT" | "DARSHAN_AND_GO"> = {
  WALKING_DARSHAN: "WALKING_DARSHAN",
  PARK_AND_VISIT: "PARK_AND_VISIT",
  DARSHAN_AND_GO: "DARSHAN_AND_GO",
  // Source JSON uses this label; schema calls the same idea WALKING_DARSHAN.
  WALK_THROUGH: "WALKING_DARSHAN",
};

interface SourcePandal {
  id: number;
  cityId: string;
  slug: string;
  canonicalName: string;
  alternateNames?: string[];
  organizerName?: string;
  latitude: number;
  longitude: number;
  address: string;
  locality: string;
  landmark?: string | null;
  publicContact?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  websiteUrl?: string | null;
  verificationStatus: string;
  publicationStatus: string;
  addedBy: string;
  parkingAvailable: boolean;
  twoWheelerAccessible: boolean;
  fourWheelerAccessible: boolean;
  foodStallsNearby: boolean;
  streetShopsNearby: boolean;
  visitType: string;
}

interface SourceScheduleEntry {
  event: string;
  time: string;
}

interface SourcePandalYear {
  id: number;
  pandalId: number;
  year: number;
  displayName?: string;
  theme?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  schedule?: SourceScheduleEntry[];
  coverImage?: string | null;
  photos?: unknown[];
  categories?: string[];
  tags?: string[];
  featured?: boolean;
  publicationStatus: string;
  verificationStatus: string;
}

interface SourceEntry {
  pandal: SourcePandal;
  pandalYear: SourcePandalYear;
  sources?: unknown[];
}

// scheduleEntrySchema.time is a free-text display string (max 20 chars),
// shown verbatim next to a label in the admin UI ("8:00 AM" / "Evening
// Aarti") — not a machine time. The source JSON gives full ISO timestamps,
// so this renders just the clock time in the pandal's local (IST) wall time.
function toDisplayTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function sanitizePandal(source: SourcePandal) {
  return {
    canonicalName: source.canonicalName,
    alternateNames: source.alternateNames ?? [],
    organizerName: source.organizerName ?? undefined,
    latitude: source.latitude,
    longitude: source.longitude,
    address: source.address,
    locality: source.locality,
    landmark: source.landmark ?? undefined,
    publicContact: source.publicContact ?? undefined,
    instagramUrl: source.instagramUrl ?? undefined,
    facebookUrl: source.facebookUrl ?? undefined,
    websiteUrl: source.websiteUrl ?? undefined,
    parkingAvailable: Boolean(source.parkingAvailable),
    twoWheelerAccessible: Boolean(source.twoWheelerAccessible),
    fourWheelerAccessible: Boolean(source.fourWheelerAccessible),
    foodStallsNearby: Boolean(source.foodStallsNearby),
    streetShopsNearby: Boolean(source.streetShopsNearby),
    visitType: VISIT_TYPE_MAP[source.visitType] ?? "WALKING_DARSHAN",
  };
}

function sanitizePandalYear(source: SourcePandalYear) {
  return {
    year: source.year,
    displayName: source.displayName ?? undefined,
    theme: source.theme ?? undefined,
    description: source.description ?? undefined,
    startDate: source.startDate ?? undefined,
    endDate: source.endDate ?? undefined,
    schedule: (source.schedule ?? []).map((entry) => ({
      time: toDisplayTime(entry.time),
      label: entry.event,
    })),
    coverImage: source.coverImage ?? undefined,
    photos: [] as { url: string }[], // source has no real uploaded photos, just an empty placeholder array
    categories: source.categories ?? [],
    tags: source.tags ?? [],
    featured: Boolean(source.featured),
  };
}

async function main() {
  const filePath = process.argv[2];
  const commit = process.argv.includes("--commit");
  if (!filePath) {
    console.error("Usage: tsx scripts/import-pandals.ts <file.json> [--commit]");
    process.exit(1);
  }

  const env = loadServerEnv();
  await connectDatabase({ uri: env.MONGODB_URI });

  const { readFile } = await import("node:fs/promises");
  const raw: SourceEntry[] = JSON.parse(await readFile(filePath, "utf-8"));

  const citySlug = raw[0]?.pandal.cityId;
  if (!citySlug) {
    console.error("Could not determine city slug from the file.");
    process.exit(1);
  }
  const city = await CityModel.findOne({ slug: citySlug });
  if (!city) {
    console.error(`City "${citySlug}" not found in DB — create it first.`);
    process.exit(1);
  }

  // Existing DB candidates for this city, for dedup scoring against what's
  // already live (not just against the rest of this file).
  const existing = await PandalModel.find({ cityId: city._id, publicationStatus: { $ne: "REJECTED" } });
  const existingCandidates: CandidatePandal[] = existing.map((p) => ({
    id: String(p._id),
    canonicalName: p.canonicalName,
    alternateNames: p.alternateNames,
    organizerName: p.organizerName ?? undefined,
    latitude: p.location.coordinates[1]!,
    longitude: p.location.coordinates[0]!,
    publicContact: p.publicContact ?? undefined,
  }));

  const batchCandidates: (CandidatePandal & { sourceId: number })[] = [];
  const unexpectedFlags = new Set<number>();

  console.log(`\n=== Duplicate scan: ${raw.length} entries vs ${existing.length} existing "${citySlug}" pandals ===\n`);

  for (const entry of raw) {
    const submitted = sanitizePandal(entry.pandal);
    const dupesInDb = findDuplicateCandidates(submitted, existingCandidates, { minScore: DUPLICATE_SCORE_THRESHOLD });
    const dupesInBatch = findDuplicateCandidates(
      submitted,
      batchCandidates.filter((c) => c.sourceId !== entry.pandal.id),
      { minScore: DUPLICATE_SCORE_THRESHOLD }
    );

    // Only surface scores we haven't already made an explicit call on above
    // — otherwise every run re-prints the 2 known duplicates as "new" noise.
    if ((dupesInDb.length > 0 || dupesInBatch.length > 0) && !(entry.pandal.id in KNOWN_DUPLICATES)) {
      unexpectedFlags.add(entry.pandal.id);
      console.log(`⚠ NEW, unreviewed match: [${entry.pandal.id}] "${entry.pandal.canonicalName}"`);
      for (const d of dupesInDb) {
        const match = existing.find((p) => String(p._id) === d.pandalId);
        console.log(`    vs DB "${match?.canonicalName}" (${match?._id}) — score ${d.score}, ${d.reasons.join(", ")}`);
      }
      for (const d of dupesInBatch) {
        const match = batchCandidates.find((c) => c.id === d.pandalId);
        console.log(`    vs batch entry [${match?.sourceId}] "${match?.canonicalName}" — score ${d.score}, ${d.reasons.join(", ")}`);
      }
    }

    batchCandidates.push({
      id: String(entry.pandal.id),
      sourceId: entry.pandal.id,
      canonicalName: submitted.canonicalName,
      alternateNames: submitted.alternateNames,
      organizerName: submitted.organizerName,
      latitude: submitted.latitude,
      longitude: submitted.longitude,
      publicContact: submitted.publicContact,
    });
  }

  if (unexpectedFlags.size > 0) {
    console.log(
      `\n${unexpectedFlags.size} entries scored as possible duplicates but aren't in KNOWN_DUPLICATES — ` +
        `review them by hand and add to that map before trusting --commit (source ids: ${[...unexpectedFlags].join(", ")}).\n`
    );
  }

  console.log(`${Object.keys(KNOWN_DUPLICATES).length} entries will UPDATE an existing record instead of inserting.`);
  console.log(`${Object.keys(FLAG_FOR_MANUAL_REVIEW).length} entries will import as new but are flagged for manual review.\n`);

  if (process.argv.includes("--print")) {
    console.log("\n=== Full sanitized shape per entry ===\n");
    for (const entry of raw) {
      const sanitized = sanitizePandal(entry.pandal);
      const year = sanitizePandalYear(entry.pandalYear);
      const action = KNOWN_DUPLICATES[entry.pandal.id]
        ? `UPDATE existing "${KNOWN_DUPLICATES[entry.pandal.id]}"`
        : FLAG_FOR_MANUAL_REVIEW[entry.pandal.id]
          ? `CREATE (flagged: ${FLAG_FOR_MANUAL_REVIEW[entry.pandal.id]})`
          : "CREATE";
      console.log(`--- [${entry.pandal.id}] ${action} ---`);
      console.log(JSON.stringify({ pandal: sanitized, pandalYear: year }, null, 2));
    }
  }

  if (!commit) {
    console.log("\nDry run only — pass --commit to write to the database.");
    process.exit(0);
  }

  if (unexpectedFlags.size > 0) {
    console.error("Refusing to --commit: unreviewed duplicate scores found (see above). Resolve them first.");
    process.exit(1);
  }

  let created = 0;
  let updated = 0;
  for (const entry of raw) {
    const sanitized = sanitizePandal(entry.pandal);
    const year = sanitizePandalYear(entry.pandalYear);
    const knownMatchName = KNOWN_DUPLICATES[entry.pandal.id];

    if (knownMatchName) {
      const existingPandal = await PandalModel.findOne({ cityId: city._id, canonicalName: knownMatchName.trim() });
      if (!existingPandal) {
        console.error(`Expected to find existing pandal "${knownMatchName}" for source id ${entry.pandal.id} — not found, skipping.`);
        continue;
      }

      // Keep the existing slug/canonicalName (don't reshuffle URLs an admin
      // may have already shared) but refresh everything else with this
      // file's more accurate research.
      await PandalModel.updateOne(
        { _id: existingPandal._id },
        {
          $set: {
            ...sanitized,
            canonicalName: existingPandal.canonicalName,
            location: toGeoPoint(sanitized.latitude, sanitized.longitude),
            verificationStatus: "VERIFIED",
            publicationStatus: "PUBLISHED",
          },
        }
      );

      await PandalYearModel.findOneAndUpdate(
        { pandalId: existingPandal._id, year: year.year },
        {
          $set: {
            ...year,
            pandalId: existingPandal._id,
            publicationStatus: "PUBLISHED",
            verificationStatus: "VERIFIED",
          },
        },
        { upsert: true }
      );

      updated += 1;
      console.log(`Updated: ${existingPandal.canonicalName} (${existingPandal._id}) — merged from source id ${entry.pandal.id}`);
      continue;
    }

    const slug = await uniqueSlug(sanitized.canonicalName, async (candidate) =>
      Boolean(await PandalModel.exists({ cityId: city._id, slug: candidate }))
    );

    const pandal = await PandalModel.create({
      ...sanitized,
      cityId: city._id,
      slug,
      location: toGeoPoint(sanitized.latitude, sanitized.longitude),
      verificationStatus: "VERIFIED",
      publicationStatus: "PUBLISHED",
      addedBy: "ADMIN",
    });

    await PandalYearModel.create({
      ...year,
      pandalId: pandal._id,
      publicationStatus: "PUBLISHED",
      verificationStatus: "VERIFIED",
    });

    created += 1;
    const reviewNote = FLAG_FOR_MANUAL_REVIEW[entry.pandal.id];
    console.log(`Created: ${sanitized.canonicalName} (${pandal._id})${reviewNote ? ` — REVIEW: ${reviewNote}` : ""}`);
  }

  console.log(`\nDone. Created ${created}, updated ${updated} pandals (+ their year records).`);
  if (Object.keys(FLAG_FOR_MANUAL_REVIEW).length > 0) {
    console.log(`Remember to manually reconcile the flagged New Market cluster in the admin UI.`);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
