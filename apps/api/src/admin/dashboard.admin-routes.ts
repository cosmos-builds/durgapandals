import type { FastifyInstance } from "fastify";
import { PandalModel, PandalYearModel, SubmissionModel, CityModel } from "@durgapandals/database";

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
}
