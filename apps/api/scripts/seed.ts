// One-time bootstrap: creates the initial cities and admin account from
// env vars. This is data seeding, not business logic — city names/coords
// still live in the database afterwards, same as any admin-created city.
import "../src/load-env";
import bcrypt from "bcryptjs";
import { loadServerEnv } from "@durgapandals/config";
import { connectDatabase, CityModel, AdminUserModel } from "@durgapandals/database";

async function main() {
  const env = loadServerEnv();
  await connectDatabase({ uri: env.MONGODB_URI });

  const currentYear = new Date().getFullYear();

  await CityModel.findOneAndUpdate(
    { slug: "bhopal" },
    {
      name: "Bhopal",
      slug: "bhopal",
      state: "Madhya Pradesh",
      stateCode: "MP",
      countryCode: "IN",
      latitude: 23.2599,
      longitude: 77.4126,
      defaultMapZoom: 13,
      status: "ACTIVE",
      activeFestivalYear: currentYear,
    },
    { upsert: true }
  );

  await CityModel.findOneAndUpdate(
    { slug: "indore" },
    {
      name: "Indore",
      slug: "indore",
      state: "Madhya Pradesh",
      stateCode: "MP",
      countryCode: "IN",
      latitude: 22.7196,
      longitude: 75.8577,
      defaultMapZoom: 13,
      status: "ACTIVE",
      activeFestivalYear: currentYear,
    },
    { upsert: true }
  );

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

  console.log("Seeded cities: Bhopal, Indore");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
