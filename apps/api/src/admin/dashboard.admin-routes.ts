import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PandalModel, PandalYearModel, SubmissionModel, ReactionModel, CityModel } from "@durgapandals/database";

// Powers the admin landing screen (spec §22) — the numbers an admin needs
// to know what to do next, computed live rather than cached/denormalized.
export function registerDashboardRoutes(app: FastifyInstance) {
  app.get("/dashboard", async () => {
    const [
      cities,
      publishedPandals,
      draftPandals,
      pendingSubmissions,
      possibleDuplicates,
      corrections,
    ] = await Promise.all([
      CityModel.find().sort({ name: 1 }),
      PandalModel.countDocuments({ publicationStatus: "PUBLISHED" }),
      PandalModel.countDocuments({ publicationStatus: "DRAFT" }),
      SubmissionModel.countDocuments({ status: "PENDING" }),
      SubmissionModel.countDocuments({
        status: "PENDING",
        "duplicateCandidates.0": { $exists: true },
      }),
      SubmissionModel.countDocuments({ status: "PENDING", type: "CORRECTION" }),
    ]);

    const perCity = await Promise.all(
      cities.map(async (city) => ({
        cityId: String(city._id),
        cityName: city.name,
        activeFestivalYear: city.activeFestivalYear,
        publishedPandalYears: await PandalYearModel.countDocuments({
          year: city.activeFestivalYear,
          publicationStatus: "PUBLISHED",
          pandalId: { $in: await PandalModel.find({ cityId: city._id }).distinct("_id") },
        }),
      }))
    );

    return {
      publishedPandals,
      draftPandals,
      pendingSubmissions,
      possibleDuplicates,
      corrections,
      cities: perCity,
    };
  });

  // Daily submission volume for the last N days, zero-filled — the
  // dashboard previously had no time dimension at all, just point-in-time
  // counts.
  app.get("/dashboard/submissions-timeseries", async (request) => {
    const { days } = z.object({ days: z.coerce.number().min(1).max(180).default(30) }).parse(request.query);
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (days - 1));

    const rows = await SubmissionModel.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
    ]);
    const byDate = new Map(rows.map((r) => [r._id, r.count]));

    const series: { date: string; count: number }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setUTCDate(d.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      series.push({ date: key, count: byDate.get(key) ?? 0 });
    }
    return series;
  });

  app.get("/dashboard/submissions-by-status", async () => {
    const rows = await SubmissionModel.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    return rows.map((r) => ({ status: r._id, count: r.count }));
  });

  // Top pandal-years by like count, joined with the pandal's name so the
  // dashboard can show "Kali Bari — 214 likes" instead of a bare ObjectId.
  app.get("/dashboard/likes-leaderboard", async (request) => {
    const { limit } = z.object({ limit: z.coerce.number().min(1).max(50).default(10) }).parse(request.query);

    return ReactionModel.aggregate([
      { $group: { _id: "$pandalYearId", likes: { $sum: 1 } } },
      { $sort: { likes: -1 } },
      { $limit: limit },
      { $lookup: { from: "pandalyears", localField: "_id", foreignField: "_id", as: "year" } },
      { $unwind: "$year" },
      { $lookup: { from: "pandals", localField: "year.pandalId", foreignField: "_id", as: "pandal" } },
      { $unwind: "$pandal" },
      {
        $project: {
          _id: 0,
          pandalId: "$pandal._id",
          canonicalName: "$pandal.canonicalName",
          year: "$year.year",
          likes: 1,
        },
      },
    ]);
  });

  // "Which localities generate the most submissions" (unstructured
  // submittedData.locality, best-effort — submissions are the thing being
  // counted, not the canonical Pandal record).
  app.get("/dashboard/top-localities", async (request) => {
    const { limit } = z.object({ limit: z.coerce.number().min(1).max(50).default(10) }).parse(request.query);

    const rows = await SubmissionModel.aggregate<{ _id: string; count: number }>([
      { $group: { _id: { $ifNull: ["$submittedData.locality", "Unknown"] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);
    return rows.map((r) => ({ locality: r._id, count: r.count }));
  });
}
