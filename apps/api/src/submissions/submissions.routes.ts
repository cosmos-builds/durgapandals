import type { FastifyPluginAsync } from "fastify";
import { createSubmissionSchema } from "@durgapandals/validation";
import { ContributorModel, SubmissionModel } from "@durgapandals/database";
import { findNearbyDuplicates } from "../pandals/pandals.service";

export const submissionsRoutes: FastifyPluginAsync = async (app) => {
  await app.register(import("@fastify/rate-limit"), {
    max: 10,
    timeWindow: "10 minutes",
  });

  // A submission never writes the canonical Pandal/PandalYear directly
  // (spec §14.1) — it only ever creates a PandalSubmission for admin review.
  app.post("/", async (request, reply) => {
    const body = createSubmissionSchema.parse(request.body);

    const contributor = await ContributorModel.findOne({
      identifier: body.contributorContact,
    });
    if (!contributor?.verifiedAt) {
      return reply.code(403).send({ error: "Contributor not verified" });
    }

    const submittedData = body.submittedData as {
      canonicalName?: string;
      organizerName?: string;
      publicContact?: string;
      latitude?: number;
      longitude?: number;
    };

    let duplicateCandidates: Awaited<ReturnType<typeof findNearbyDuplicates>> = [];
    if (
      body.type === "NEW_PANDAL" &&
      submittedData.canonicalName &&
      submittedData.latitude != null &&
      submittedData.longitude != null
    ) {
      duplicateCandidates = await findNearbyDuplicates({
        cityId: body.cityId,
        canonicalName: submittedData.canonicalName,
        organizerName: submittedData.organizerName,
        publicContact: submittedData.publicContact,
        latitude: submittedData.latitude,
        longitude: submittedData.longitude,
      });
    }

    const submission = await SubmissionModel.create({
      cityId: body.cityId,
      type: body.type,
      possiblePandalId: body.possiblePandalId,
      contributorId: contributor._id,
      submittedData: body.submittedData,
      duplicateCandidates,
      status: "PENDING",
    });

    return reply.code(201).send(submission);
  });
};
