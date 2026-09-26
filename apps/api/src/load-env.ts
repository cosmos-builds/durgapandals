// Must be the first thing imported by any entrypoint (server.ts, seed.ts) —
// tsx does not read .env files on its own, unlike Next.js.
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });
