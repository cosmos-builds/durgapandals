import type { FastifyPluginAsync } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { AdminUserModel, PandalModel, PandalYearModel, SubmissionModel } from "@durgapandals/database";
import { signAdminSession } from "@durgapandals/auth";
import { uniqueSlug } from "@durgapandals/utils";
import { requireAdmin } from "./require-admin";
import { registerDashboardRoutes } from "./dashboard.admin-routes";
import { registerCitiesAdminRoutes } from "./cities.admin-routes";
import { registerPandalsAdminRoutes } from "./pandals.admin-routes";

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
const reviewSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  reviewNotes: z.string().max(1000).optional(),
});

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

    protectedRoutes.get("/submissions", async (request) => {
      const status = (request.query as { status?: string }).status ?? "PENDING";
      return SubmissionModel.find({ status }).sort({ createdAt: -1 }).limit(100);
    });

    // Approving a NEW_PANDAL submission is the one place a canonical Pandal
    // gets created from contributor data — it still runs through the same
    // slug/geo setup as a direct admin create (spec §17.4, §23).
    protectedRoutes.post<{ Params: { id: string } }>(
      "/submissions/:id/review",
      async (request, reply) => {
        const body = reviewSchema.parse(request.body);
        const submission = await SubmissionModel.findById(request.params.id);
        if (!submission) return reply.code(404).send({ error: "Submission not found" });
        if (submission.status !== "PENDING") {
          return reply.code(409).send({ error: "Submission already reviewed" });
        }

        if (body.action === "REJECT") {
          submission.status = "REJECTED";
          submission.reviewedBy = request.admin!.sub as never;
          submission.reviewedAt = new Date();
          submission.reviewNotes = body.reviewNotes;
          await submission.save();
          return submission;
        }

        if (submission.type === "NEW_PANDAL") {
          const data = submission.submittedData as Record<string, any>;
          const slug = await uniqueSlug(
            data.canonicalName,
            async (candidate) =>
              Boolean(await PandalModel.exists({ cityId: submission.cityId, slug: candidate }))
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
            await PandalYearModel.create({
              pandalId: pandal._id,
              year: data.year,
              theme: data.theme,
              description: data.description,
              parkingInfo: data.parkingInfo,
              entryInfo: data.entryInfo,
              categories: data.categories ?? [],
              tags: data.tags ?? [],
              publicationStatus: "PUBLISHED",
              verificationStatus: "UNVERIFIED",
            });
          }

          submission.possiblePandalId = pandal._id as never;
        }

        submission.status = "APPROVED";
        submission.reviewedBy = request.admin!.sub as never;
        submission.reviewedAt = new Date();
        submission.reviewNotes = body.reviewNotes;
        await submission.save();
        return submission;
      }
    );

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
