import "./load-env";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { loadServerEnv } from "@durgapandals/config";
import { connectDatabase } from "@durgapandals/database";

import { citiesRoutes } from "./cities/cities.routes";
import { pandalsRoutes } from "./pandals/pandals.routes";
import { pandalYearsRoutes } from "./pandal-years/pandal-years.routes";
import { submissionsRoutes } from "./submissions/submissions.routes";
import { reactionsRoutes } from "./reactions/reactions.routes";
import { authRoutes } from "./auth/auth.routes";
import { adminRoutes } from "./admin/admin.routes";
import { geocodingRoutes } from "./geocoding/geocoding.routes";

async function main() {
  const env = loadServerEnv();
  await connectDatabase({ uri: env.MONGODB_URI });

  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  // Global floor; sensitive endpoints (OTP, submissions) set tighter limits
  // of their own inside each domain module (spec §16).
  await app.register(rateLimit, { max: 200, timeWindow: "1 minute" });

  app.decorate("env", env);

  await app.register(citiesRoutes, { prefix: "/cities" });
  await app.register(pandalsRoutes, { prefix: "/pandals" });
  await app.register(pandalYearsRoutes, { prefix: "/pandal-years" });
  await app.register(submissionsRoutes, { prefix: "/submissions" });
  await app.register(reactionsRoutes, { prefix: "/reactions" });
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(adminRoutes, { prefix: "/admin" });
  await app.register(geocodingRoutes, { prefix: "/geocode" });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen({ port, host: "0.0.0.0" });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
