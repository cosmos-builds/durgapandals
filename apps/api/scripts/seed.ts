// One-time bootstrap: creates the initial cities and admin account from
// env vars. This is data seeding, not business logic — city names/coords
// still live in the database afterwards, same as any admin-created city.
import "../src/load-env";
import bcrypt from "bcryptjs";
import { loadServerEnv } from "@durgapandals/config";
import { connectDatabase, CityModel, AdminUserModel } from "@durgapandals/database";

interface SeedCity {
  name: string;
  slug: string;
  state: string;
  stateCode: string;
  latitude: number;
  longitude: number;
  defaultMapZoom: number;
  status: "ACTIVE" | "COMING_SOON";
  tier: "MAJOR" | "MINOR";
}

// Coordinates are each city's well-known public geographic centre (state
// capital / metro-area reference point), not anything looked up per-pandal.
// The two cities the product actually has pandal listings for stay ACTIVE;
// the rest are MAJOR-tier (pinned in the city picker, spec §4) but
// COMING_SOON — pinning them without real listings would be false
// advertising, but leaving them out of the picker entirely made it look
// like DurgaPandals only covers two mid-sized cities. Kolkata is the
// festival's home city and should be the most obvious "not live yet, but
// we know about it" entry once the product expands past its MP launch pair.
const CITIES: SeedCity[] = [
  { name: "Bhopal", slug: "bhopal", state: "Madhya Pradesh", stateCode: "MP", latitude: 23.2599, longitude: 77.4126, defaultMapZoom: 10, status: "ACTIVE", tier: "MAJOR" },
  { name: "Indore", slug: "indore", state: "Madhya Pradesh", stateCode: "MP", latitude: 22.7196, longitude: 75.8577, defaultMapZoom: 10, status: "ACTIVE", tier: "MAJOR" },
  { name: "Kolkata", slug: "kolkata", state: "West Bengal", stateCode: "WB", latitude: 22.5726, longitude: 88.3639, defaultMapZoom: 10, status: "COMING_SOON", tier: "MAJOR" },
  { name: "Delhi", slug: "delhi", state: "Delhi", stateCode: "DL", latitude: 28.6139, longitude: 77.2090, defaultMapZoom: 10, status: "COMING_SOON", tier: "MAJOR" },
  { name: "Mumbai", slug: "mumbai", state: "Maharashtra", stateCode: "MH", latitude: 19.0760, longitude: 72.8777, defaultMapZoom: 10, status: "COMING_SOON", tier: "MAJOR" },
  { name: "Pune", slug: "pune", state: "Maharashtra", stateCode: "MH", latitude: 18.5204, longitude: 73.8567, defaultMapZoom: 10, status: "COMING_SOON", tier: "MAJOR" },
  { name: "Bengaluru", slug: "bengaluru", state: "Karnataka", stateCode: "KA", latitude: 12.9716, longitude: 77.5946, defaultMapZoom: 10, status: "COMING_SOON", tier: "MAJOR" },
];

async function main() {
  const env = loadServerEnv();
  await connectDatabase({ uri: env.MONGODB_URI });

  const currentYear = new Date().getFullYear();

  for (const city of CITIES) {
    await CityModel.findOneAndUpdate(
      { slug: city.slug },
      {
        name: city.name,
        slug: city.slug,
        state: city.state,
        stateCode: city.stateCode,
        countryCode: "IN",
        latitude: city.latitude,
        longitude: city.longitude,
        defaultMapZoom: city.defaultMapZoom,
        status: city.status,
        activeFestivalYear: currentYear,
        tier: city.tier,
      },
      { upsert: true }
    );
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await AdminUserModel.findOneAndUpdate(
      { email: adminEmail },
      { email: adminEmail, passwordHash, role: "ADMIN" },
      { upsert: true }
    );
    console.log(`Admin account ready: ${adminEmail}`);
  } else {
    console.log("Skipped admin creation — set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create one.");
  }

  console.log(`Seeded cities: ${CITIES.map((c) => c.name).join(", ")}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
