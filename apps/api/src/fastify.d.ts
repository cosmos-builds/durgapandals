import type { ServerEnv } from "@durgapandals/config";
import type { AdminSessionPayload } from "@durgapandals/auth";

declare module "fastify" {
  interface FastifyInstance {
    env: ServerEnv;
  }
  interface FastifyRequest {
    admin?: AdminSessionPayload;
  }
}
