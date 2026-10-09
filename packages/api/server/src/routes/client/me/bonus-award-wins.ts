import { BonusAwardWin, Competition } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { isPaginationRequested, parsePagination } from "@oc/api-infra/pagination";
import { error, paginated, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { auth } from "@oc/api-server/middleware/auth";
import { Hono } from "hono";
import mongoose from "mongoose";

const app = new Hono();

app.use("*", auth);

app.get("/", async (c) => {
  try {
    const userId = c.get("userId")!;
    await dbConnect();

    const userOid = new mongoose.Types.ObjectId(userId);
    const baseFilter = { userId: userOid, deletedAt: null };

    if (!isPaginationRequested(c)) {
      const wins = await BonusAwardWin.find(baseFilter).sort({ wonAt: -1 }).limit(50).lean();
      return success(c, wins);
    }

    const { limit, page, skip } = parsePagination(c);

    const [wins, total] = await Promise.all([
      BonusAwardWin.aggregate([
        { $match: baseFilter },
        { $sort: { wonAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: Competition.collection.name,
            localField: "competitionId",
            foreignField: "_id",
            as: "competition",
          },
        },
        { $unwind: { path: "$competition", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            ticketNumber: 1,
            claimed: 1,
            claimedAt: 1,
            wonAt: 1,
            prize: {
              title: "$prizeTitle",
              description: { $ifNull: ["$prizeImage", ""] },
              image: { $ifNull: ["$prizeImage", ""] },
              value: { $ifNull: ["$prizeValue", 0] },
            },
            competition: {
              _id: { $toString: "$competition._id" },
              title: "$competition.title",
              slug: "$competition.slug",
              drawDate: "$competition.drawDate",
            },
          },
        },
      ]).option({ maxTimeMS: 5000 }),
      BonusAwardWin.countDocuments(baseFilter).maxTimeMS(5000) as Promise<number>,
    ]);

    return paginated(c, wins, total, page, limit);
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "me.bonusAwardWins.list",
    });
    console.error("Error fetching bonus award wins:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
