// Demo data only — realistic-looking pandals with photos so the map/explore/
// detail screens and admin dashboard have something to actually render.
// Photos are placeholder images (picsum.photos), not real pandal photography.
import "../src/load-env";
import { loadServerEnv } from "@durgapandals/config";
import { connectDatabase, CityModel, PandalModel, PandalYearModel, toGeoPoint } from "@durgapandals/database";
import { slugify } from "@durgapandals/utils";

function photo(seed: string, index: number) {
  return {
    url: `https://picsum.photos/seed/${seed}-${index}/900/700`,
    width: 900,
    height: 700,
    altText: `${seed.replace(/-/g, " ")} photo ${index}`,
  };
}

const BHOPAL_PANDALS = [
  {
    canonicalName: "Bittan Market Durga Puja",
    organizerName: "Bittan Market Sarbojanin Durga Puja Samiti",
    locality: "Bittan Market",
    address: "Bittan Market Road, near TT Nagar Stadium, Bhopal",
    landmark: "TT Nagar Stadium",
    lat: 23.2359,
    lng: 77.4076,
    theme: "Nadi Matrika — the river as mother",
    description:
      "A 40-foot pandal of jute, clay and river reeds, built by artisans from Krishnanagar. The idol is set on a floating stage lit only by diyas after 8 PM.",
    categories: ["Traditional", "Theme / Creative"],
    tags: ["Photography"],
    featured: true,
  },
  {
    canonicalName: "Bengali Association Durga Puja",
    organizerName: "Bhopal Bengali Association",
    locality: "Shahpura",
    address: "Bengali Association Ground, Shahpura, Bhopal",
    landmark: "Shahpura Lake",
    lat: 23.2007,
    lng: 77.4324,
    theme: "Ekta — unity in bamboo and cloth",
    description:
      "The city's oldest community puja, running since 1958. Traditional Ekchala idol, classical dhak performances every evening, and a community feast on Ashtami.",
    categories: ["Traditional"],
    tags: ["Historic", "Cultural Programs"],
    featured: true,
  },
  {
    canonicalName: "New Market Durga Utsav",
    organizerName: "New Market Vyapari Sangh",
    locality: "New Market",
    address: "New Market Chowk, Bhopal",
    landmark: "New Market Clock Tower",
    lat: 23.2372,
    lng: 77.4013,
    theme: "Modern minimalist — light and mirror work",
    description: "A striking mirror-and-LED installation pandal in the heart of the old market district.",
    categories: ["Theme / Creative"],
    tags: ["Photography", "Night Lighting"],
    featured: false,
  },
  {
    canonicalName: "Arera Colony Puja Samiti",
    organizerName: "Arera Colony Cultural Association",
    locality: "Arera Colony",
    address: "E-7 Community Ground, Arera Colony, Bhopal",
    lat: 23.2156,
    lng: 77.4423,
    theme: "Village hearth — terracotta and thatch",
    description: "A rustic Bengal-village themed pandal with terracotta panels handmade by local art students.",
    categories: ["Traditional", "Community Pandal"],
    tags: ["Kids Activities", "Food Stalls"],
    featured: false,
  },
];

const INDORE_PANDALS = [
  {
    canonicalName: "Sarafa Bazaar Durga Puja",
    organizerName: "Sarafa Sarbojanin Puja Committee",
    locality: "Sarafa Bazaar",
    address: "Sarafa Bazaar Main Road, Indore",
    landmark: "Rajwada Palace",
    lat: 22.7177,
    lng: 75.8556,
    theme: "Rajwada Reimagined",
    description: "A pandal styled after Indore's own Rajwada palace facade, blending local heritage with Bengali ritual.",
    categories: ["Theme / Creative"],
    tags: ["Historic", "Photography"],
    featured: true,
  },
  {
    canonicalName: "Vijay Nagar Cultural Puja",
    organizerName: "Vijay Nagar Bengali Samaj",
    locality: "Vijay Nagar",
    address: "Scheme 54, Vijay Nagar, Indore",
    lat: 22.7532,
    lng: 75.8937,
    theme: "Shola art and white lace",
    description: "Delicate shola (pith) craft work covers this pandal, handcrafted by a family of artisans from Nadia.",
    categories: ["Traditional"],
    tags: [],
    featured: false,
  },
  {
    canonicalName: "Palasia Durga Utsav Samiti",
    organizerName: "Palasia Puja Committee",
    locality: "Palasia",
    address: "Palasia Square, Indore",
    landmark: "Palasia Square",
    lat: 22.7245,
    lng: 75.8825,
    theme: "Eco-friendly clay and cloth",
    description: "An entirely biodegradable pandal built from clay, cloth and bamboo, with a zero-plastic pledge this year.",
    categories: ["Theme / Creative", "Eco-Friendly"],
    tags: ["Kids Activities"],
    featured: true,
  },
];

async function seedCityPandals(citySlug: string, entries: typeof BHOPAL_PANDALS, year: number) {
  const city = await CityModel.findOne({ slug: citySlug });
  if (!city) {
    console.warn(`City "${citySlug}" not found — run the city seed first.`);
    return;
  }

  for (const entry of entries) {
    const slug = slugify(entry.canonicalName);
    const pandal = await PandalModel.findOneAndUpdate(
      { cityId: city._id, slug },
      {
        cityId: city._id,
        slug,
        canonicalName: entry.canonicalName,
        alternateNames: [],
        organizerName: entry.organizerName,
        location: toGeoPoint(entry.lat, entry.lng),
        address: entry.address,
        locality: entry.locality,
        landmark: entry.landmark,
        verificationStatus: "VERIFIED",
        publicationStatus: "PUBLISHED",
      },
      { upsert: true, new: true }
    );

    await PandalYearModel.findOneAndUpdate(
      { pandalId: pandal._id, year },
      {
        pandalId: pandal._id,
        year,
        theme: entry.theme,
        description: entry.description,
        coverImage: photo(slug, 0).url,
        photos: [photo(slug, 0), photo(slug, 1), photo(slug, 2)],
        categories: entry.categories,
        tags: entry.tags,
        featured: entry.featured,
        openingHours: "6:00 PM – 11:00 PM",
        parkingInfo: "Street parking nearby; arrive before 7 PM on weekends",
        entryInfo: "Free entry, no tickets required",
        publicationStatus: "PUBLISHED",
        verificationStatus: "VERIFIED",
      },
      { upsert: true }
    );

    console.log(`Seeded: ${entry.canonicalName} (${citySlug})`);
  }
}

async function main() {
  const env = loadServerEnv();
  await connectDatabase({ uri: env.MONGODB_URI });

  const year = new Date().getFullYear();
  await seedCityPandals("bhopal", BHOPAL_PANDALS, year);
  await seedCityPandals("indore", INDORE_PANDALS, year);

  console.log("Done.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
