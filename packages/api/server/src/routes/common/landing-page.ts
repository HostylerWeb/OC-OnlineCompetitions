import { Competition } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { parsePagination } from "@oc/api-infra/pagination";
import { error, paginated } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { enrichCompetitionsWithTicketStats } from "@oc/api-tickets/competition-stats";
import { Hono } from "hono";

const app = new Hono();

app.get("/competitions", async (c) => {
  try {
    const { limit, page, skip } = parsePagination(c);
    await dbConnect();

    const query: Record<string, unknown> = { status: "active", drawDate: { $gte: new Date() } };

    const category = c.req.query("category");
    if (category) query.category = category;

    const [competitions, total] = await Promise.all([
      Competition.find(query)
        .sort({ displayOrder: 1, drawDate: 1 })
        .skip(skip)
        .limit(limit)
        .select(
          "_id slug title ticketPrice prizeValue prizeImageUrl imageUrl status category drawDate displayOrder isFeatured heroImageUrl heroDisplayOrder isHeroFeatured maxTickets maxTicketsPerUser ticketsSold ticketsHeld question questionOptions startDate endDate originalPrice currency"
        )
        .lean(),
      Competition.countDocuments(query).maxTimeMS(5000),
    ]);

    const enriched = await enrichCompetitionsWithTicketStats(competitions);

    return paginated(c, enriched, total, page, limit);
  } catch (err: unknown) {
    console.error("Error fetching landing-page competitions:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
