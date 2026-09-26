import type { FastifyPluginAsync } from "fastify";
import { verificationRequestSchema, verificationConfirmSchema } from "@durgapandals/validation";
import { ResendEmailProvider } from "@durgapandals/auth";
import { requestOtp, confirmOtp, OtpRateLimitError, OtpInvalidError } from "./otp.service";

export const authRoutes: FastifyPluginAsync = async (app) => {
  // Contributor OTP is the highest-abuse-risk surface in V1 (spec §16) —
  // it gets the tightest rate limit in the app, on top of the per-identifier
  // cooldown enforced inside otp.service.
  await app.register(import("@fastify/rate-limit"), {
    max: 5,
    timeWindow: "10 minutes",
  });

  const env = app.env;
  const provider = new ResendEmailProvider({
    apiKey: env.RESEND_API_KEY ?? "",
    fromAddress: env.RESEND_FROM_ADDRESS ?? "verify@durgapandals.com",
  });

  app.post("/send-code", async (request, reply) => {
    const { identifier } = verificationRequestSchema.parse(request.body);
    try {
      await requestOtp(identifier, provider);
      return { sent: true };
    } catch (error) {
      if (error instanceof OtpRateLimitError) {
        return reply.code(429).send({ error: error.message });
      }
      // A misconfigured/unavailable email provider is an operational fact,
      // not something to hand the client our internal error text for (this
      // was previously leaking straight through as a raw 500).
      request.log.error(error);
      return reply.code(503).send({ error: "Verification email could not be sent. Please try again shortly." });
    }
  });

  app.post("/verify-code", async (request, reply) => {
    const { identifier, code } = verificationConfirmSchema.parse(request.body);
    try {
      const verified = await confirmOtp(identifier, code);
      if (!verified) return reply.code(400).send({ error: "Incorrect code" });
      return { verified: true };
    } catch (error) {
      if (error instanceof OtpRateLimitError) {
        return reply.code(429).send({ error: error.message });
      }
      if (error instanceof OtpInvalidError) {
        return reply.code(400).send({ error: error.message });
      }
      request.log.error(error);
      return reply.code(500).send({ error: "Something went wrong. Please try again." });
    }
  });
};
