import type { FastifyPluginAsync } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  AdminUserModel,
  ContributorModel,
  PandalModel,
  PandalYearModel,
  SubmissionModel,
  fromGeoPoint,
  type SubmissionDocument,
} from "@durgapandals/database";
import type { HydratedDocument } from "mongoose";
import { signAdminSession } from "@durgapandals/auth";
import { uniqueSlug } from "@durgapandals/utils";
import { requireAdmin } from "./require-admin";
import { registerDashboardRoutes } from "./dashboard.admin-routes";
import { registerCitiesAdminRoutes } from "./cities.admin-routes";
import { registerPandalsAdminRoutes } from "./pandals.admin-routes";
import { registerContributorsAdminRoutes } from "./contributors.admin-routes";

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
const reviewSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  reviewNotes: z.string().max(1000).optional(),
});
const bulkReviewSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  action: z.enum(["APPROVE", "REJECT"]),
  reviewNotes: z.string().max(1000).optional(),
});

// Shared by the single-submission review route and the bulk-review route —
// the only place a canonical Pandal gets created from contributor data
// (spec §17.4, §23). Returns null if the submission wasn't PENDING (caller
// decides how to report that).
async function reviewSubmission(
  submission: HydratedDocument<SubmissionDocument>,
  action: "APPROVE" | "REJECT",
  reviewerId: string,
  reviewNotes?: string
) {
  if (submission.status !== "PENDING") return null;

  if (action === "REJECT") {
    submission.status = "REJECTED";
    submission.reviewedBy = reviewerId as never;
    submission.reviewedAt = new Date();
    submission.reviewNotes = reviewNotes;
    await submission.save();
    return submission;
  }

  if (submission.type === "NEW_PANDAL") {
    const data = submission.submittedData as Record<string, any>;
    const slug = await uniqueSlug(
      data.canonicalName,
      async (candidate) => Boolean(await PandalModel.exists({ cityId: submission.cityId, slug: candidate }))
    );

    const pandal = await PandalModel.create({
      cityId: submission.cityId,
      slug,
      canonicalName: data.canonicalName,
      alternateNames: data.alternateNames ?? [],
      organizerName: data.organizerName,
      location: { type: "Point", coordinates: [data.longitude, data.latitude] },
      address: data.address,
      locality: data.locality,
      landmark: data.landmark,
      publicContact: data.publicContact,
      instagramUrl: data.instagramUrl,
      facebookUrl: data.facebookUrl,
      websiteUrl: data.websiteUrl,
      verificationStatus: "UNVERIFIED",
      publicationStatus: "PUBLISHED",
    });

    if (data.year) {
      const photos: { url: string }[] = Array.isArray(data.photos) ? data.photos : [];
      await PandalYearModel.create({
        pandalId: pandal._id,
        year: data.year,
        theme: data.theme,
        description: data.description,
        parkingInfo: data.parkingInfo,
        entryInfo: data.entryInfo,
        categories: data.categories ?? [],
        tags: data.tags ?? [],
        // First uploaded photo doubles as the cover image — contributors
        // never see a separate "pick a cover" step, keeping the form to
        // one upload action instead of two.
        coverImage: photos[0]?.url,
        photos,
        publicationStatus: "PUBLISHED",
        verificationStatus: "UNVERIFIED",
      });
    }

    submission.possiblePandalId = pandal._id as never;
  }

  submission.status = "APPROVED";
  submission.reviewedBy = reviewerId as never;
  submission.reviewedAt = new Date();
  submission.reviewNotes = reviewNotes;
  await submission.save();
  return submission;
}

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.post("/login", async (request, reply) => {
    const { email, password } = loginSchema.parse(request.body);
    const admin = await AdminUserModel.findOne({ email });
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }
    const token = await signAdminSession(
      { sub: String(admin._id), email: admin.email, role: admin.role },
      app.env.ADMIN_SESSION_SECRET
    );
    return { token };
  });

  app.register(async (protectedRoutes) => {
    protectedRoutes.addHook("preHandler", requireAdmin);

    registerDashboardRoutes(protectedRoutes);
    registerCitiesAdminRoutes(protectedRoutes);
    registerPandalsAdminRoutes(protectedRoutes);
    registerContributorsAdminRoutes(protectedRoutes);

    // Duplicate candidates only ever carried a pandalId — the submissions
    // list showed nothing but a bare score/distance line, no way to tell
    // *which* pandal that was without opening a second tab. Batch-fetch the
    // candidate pandals once per request and attach name + coordinates so
    // the admin UI can render them as map pins instead of raw text.
    protectedRoutes.get("/submissions", async (request) => {
      const status = (request.query as { status?: string }).status ?? "PENDING";
      const submissions = await SubmissionModel.find({ status }).sort({ createdAt: -1 }).limit(100);

      const candidateIds = [
        ...new Set(submissions.flatMap((s) => s.duplicateCandidates.map((c) => String(c.pandalId)))),
      ];
      const candidatePandals = await PandalModel.find({ _id: { $in: candidateIds } });
      const byId = new Map(candidatePandals.map((p) => [String(p._id), p]));

      // Surfaces who to block: identifier + blocked state, not just a
      // ContributorModel ObjectId the admin UI can't act on.
      const contributorIds = [...new Set(submissions.map((s) => String(s.contributorId)))];
      const contributors = await ContributorModel.find({ _id: { $in: contributorIds } });
      const contributorById = new Map(contributors.map((c) => [String(c._id), c]));

      return submissions.map((submission) => {
        const contributor = contributorById.get(String(submission.contributorId));
        return {
          ...submission.toObject(),
          contributor: contributor
            ? { id: String(contributor._id), identifier: contributor.identifier, blocked: contributor.blocked }
            : null,
          duplicateCandidates: submission.duplicateCandidates.map((candidate) => {
            const pandal = byId.get(String(candidate.pandalId));
            return {
              ...(candidate as unknown as Record<string, unknown>),
              canonicalName: pandal?.canonicalName,
              ...(pandal ? fromGeoPoint(pandal.location) : {}),
            };
          }),
        };
      });
    });

    protectedRoutes.post<{ Params: { id: string } }>(
      "/submissions/:id/review",
      async (request, reply) => {
        const body = reviewSchema.parse(request.body);
        const submission = await SubmissionModel.findById(request.params.id);
        if (!submission) return reply.code(404).send({ error: "Submission not found" });

        const result = await reviewSubmission(submission, body.action, request.admin!.sub, body.reviewNotes);
        if (!result) return reply.code(409).send({ error: "Submission already reviewed" });
        return result;
      }
    );

    // Lets an admin clear the review queue in one action instead of
    // one-at-a-time — skips (rather than fails) anything already reviewed,
    // since a bulk selection can go stale between load and click.
    protectedRoutes.post("/submissions/bulk-review", async (request) => {
      const body = bulkReviewSchema.parse(request.body);
      const submissions = await SubmissionModel.find({ _id: { $in: body.ids } });

      const results = await Promise.all(
        submissions.map(async (submission) => ({
          id: String(submission._id),
          reviewed: Boolean(await reviewSubmission(submission, body.action, request.admin!.sub, body.reviewNotes)),
        }))
      );
      return { results };
    });

    // Merge preserves associated records rather than deleting them (spec §24):
    // the losing pandal is archived and pointed at the surviving one, its
    // years are reassigned, nothing is destroyed.
    protectedRoutes.post<{ Params: { loserId: string; winnerId: string } }>(
      "/pandals/:loserId/merge-into/:winnerId",
      async (request, reply) => {
        const { loserId, winnerId } = request.params;
        const [loser, winner] = await Promise.all([
          PandalModel.findById(loserId),
          PandalModel.findById(winnerId),
        ]);
        if (!loser || !winner) return reply.code(404).send({ error: "Pandal not found" });

        await PandalYearModel.updateMany({ pandalId: loser._id }, { pandalId: winner._id });
        loser.publicationStatus = "ARCHIVED";
        loser.verificationStatus = "DUPLICATE";
        (loser as any).mergedIntoPandalId = winner._id;
        await loser.save();

        return { merged: true, winnerId: String(winner._id) };
      }
    );
  });
};
