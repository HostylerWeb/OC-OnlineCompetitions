import { ConversionPostbackLog } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { parsePagination } from "@oc/api-infra/pagination";
import { error, paginated, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { requireAdmin } from "@oc/api-server/middleware/auth";
import { type Context, Hono } from "hono";
import mongoose from "mongoose";

const app = new Hono();

app.use("*", requireAdmin);

const SORTABLE_FIELDS = ["createdAt", "eventType", "source", "trackerName", "status"] as const;

function buildFilter(c: Context): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  const eventType = c.req.query("eventType");
  if (eventType === "signup" || eventType === "purchase") filter.eventType = eventType;

  const source = c.req.query("source");
  if (source) filter.source = source;

  const trackerId = c.req.query("trackerId");
  if (trackerId) filter.trackerId = trackerId;

  const status = c.req.query("status");
  if (status === "ok") filter.ok = true;
  else if (status === "fail") filter.ok = false;

  const clickId = c.req.query("clickId");
  if (clickId) filter.clickId = { $regex: clickId, $options: "i" };

  const userId = c.req.query("userId");
  if (userId && mongoose.isValidObjectId(userId)) filter.userId = userId;

  const days = parseInt(c.req.query("days") || "0", 10);
  if (days > 0) {
    filter.createdAt = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
  }

  return filter;
}

app.get("/", async (c) => {
  try {
    await dbConnect();
    const { limit, page, skip, sortDirection } = parsePagination(c);
    const filter = buildFilter(c);

    const [items, total] = await Promise.all([
      ConversionPostbackLog.find(filter)
        .sort({ createdAt: sortDirection === -1 ? "desc" : "asc" })
        .skip(skip)
        .limit(limit)
        .lean(),
      ConversionPostbackLog.countDocuments(filter),
    ]);

    return paginated(c, items, total, page, limit, { sortableFields: [...SORTABLE_FIELDS] });
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.conversionPostbacks.list",
    });
    console.error("Error fetching conversion postbacks:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Failed to fetch conversion postbacks", 500);
  }
});

app.get("/summary", async (c) => {
  try {
    await dbConnect();

    const days = parseInt(c.req.query("days") || "0", 10);
    const match: Record<string, unknown> = {};
    if (days > 0) {
      match.createdAt = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
    }

    const rows = await ConversionPostbackLog.aggregate<{
      _id: { source: string | null; eventType: string };
      count: number;
      totalAmount: number;
    }>([
      { $match: match },
      {
        $group: {
          _id: {
            source: { $ifNull: ["$source", null] },
            eventType: "$eventType",
          },
          count: { $sum: 1 },
          totalAmount: { $sum: { $ifNull: ["$amount", 0] } },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    return success(c, {
      rows: rows.map((r) => ({
        source: r._id.source,
        eventType: r._id.eventType,
        count: r.count,
        totalAmount: r.totalAmount,
      })),
    });
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.conversionPostbacks.summary",
    });
    console.error("Error fetching conversion postback summary:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Failed to fetch conversion postback summary", 500);
  }
});

export default app;
