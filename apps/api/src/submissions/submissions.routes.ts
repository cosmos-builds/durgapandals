import type { FastifyPluginAsync } from "fastify";
import { createSubmissionSchema } from "@durgapandals/validation";
import { ContributorModel, SubmissionModel } from "@durgapandals/database";
import { findNearbyDuplicates } from "../pandals/pandals.service";

// Independent of REQUIRE_CONTRIBUTOR_VERIFICATION — this caps how many
// submissions one contact can create in a rolling day, so an unverified
// contributor can't script hundreds of submissions just because OTP is off.
const MAX_SUBMISSIONS_PER_DAY = 5;

export const submissionsRoutes: FastifyPluginAsync = async (app) => {
  await app.register(import("@fastify/rate-limit"), {
    max: 10,
    timeWindow: "10 minutes",
  });

  // A submission never writes the canonical Pandal/PandalYear directly
  // (spec §14.1) — it only ever creates a PandalSubmission for admin review.
  app.post("/", async (request, reply) => {
    const body = createSubmissionSchema.parse(request.body);

    // Honeypot — a real visitor never sees or fills this field; any value
    // here means a script filled every input it could find. Reply 201 with
    // a fake id instead of 400, so a bot has no signal to adapt against.
    if (body.website) {
      return reply.code(201).send({ _id: "ok", status: "PENDING" });
    }

    // Always track the contributor (even when verification isn't required)
    // so a repeat spammer can be blocked by contact info later.
    const contributor = await ContributorModel.findOneAndUpdate(
      { identifier: body.contributorContact },
      { $setOnInsert: { identifier: body.contributorContact } },
      { upsert: true, new: true }
    );

    if (contributor.blocked) {
      return reply.code(403).send({ error: "This contact has been blocked from submitting." });
    }

    if (app.env.REQUIRE_CONTRIBUTOR_VERIFICATION && !contributor.verifiedAt) {
      return reply.code(403).send({ error: "Contributor not verified" });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await SubmissionModel.countDocuments({
      contributorId: contributor._id,
      createdAt: { $gte: since },
    });
    if (recentCount >= MAX_SUBMISSIONS_PER_DAY) {
      return reply.code(429).send({ error: "Too many submissions from this contact today. Try again tomorrow." });
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
      submitterIp: request.ip,
      duplicateCandidates,
      status: "PENDING",
    });

    return reply.code(201).send(submission);
  });
};
