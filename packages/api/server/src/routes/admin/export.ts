import {
  Category,
  Competition,
  InstantPrize,
  InstantPrizeWin,
  Order,
  Profile,
  PromoCode,
  Winner,
} from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { escapeRegex, substringRegex } from "@oc/api-infra/fuzzy-search";
import { parseSearch } from "@oc/api-infra/pagination";
import { error } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { requireAdmin } from "@oc/api-server/middleware/auth";
import { Hono } from "hono";
import type { PipelineStage } from "mongoose";

const app = new Hono();

app.use("*", requireAdmin);

function toCSV(rows: Record<string, unknown>[], columns: { key: string; label: string }[]): string {
  const header = columns.map((c) => `"${c.label}"`).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const val = row[c.key];
          if (val === null || val === undefined) return "";
          if (val instanceof Date) return `"${val.toISOString()}"`;
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(",")
    )
    .join("\n");
  return `${header}\n${body}`;
}

app.get("/users", async (c) => {
  try {
    await dbConnect();
    const filter: Record<string, unknown> = {};
    filter.isGuestCheckout = { $ne: true };
    filter.email = { $not: { $regex: /@guest\.onlinecompetitions\.local$/i } };
    const search = c.req.query("search")?.trim();
    if (search) {
      const safe = escapeRegex(search);
      filter.$or = [
        { email: { $regex: safe, $options: "i" } },
        { firstName: { $regex: safe, $options: "i" } },
        { lastName: { $regex: safe, $options: "i" } },
      ];
    }
    const isVerified = c.req.query("isVerified");
    if (isVerified === "true") filter.isVerified = true;
    else if (isVerified === "false") filter.isVerified = false;
    const isAdmin = c.req.query("isAdmin");
    if (isAdmin === "true") filter.isAdmin = true;
    else if (isAdmin === "false") filter.isAdmin = false;

    const data = await Profile.find(filter).sort({ createdAt: -1 }).lean();
    const csv = toCSV(data as unknown as Record<string, unknown>[], [
      { key: "email", label: "Email" },
      { key: "firstName", label: "First Name" },
      { key: "lastName", label: "Last Name" },
      { key: "isAdmin", label: "Is Admin" },
      { key: "isVerified", label: "Is Verified" },
      { key: "referralMultiplier", label: "Referral Multiplier" },
      { key: "referralCode", label: "Referral Code" },
      { key: "referralCount", label: "Referral Count" },
      { key: "referredByEmail", label: "Referred By Email" },
      { key: "createdAt", label: "Created At" },
    ]);
    return c.newResponse(csv, 200, {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="users.csv"',
    });
  } catch (err: unknown) {
    console.error("Error exporting users:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.export.users",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/orders", async (c) => {
  try {
    await dbConnect();
    const filter: Record<string, unknown> = {};
    filter.deletedAt = null;
    const status = c.req.query("status");
    const userId = c.req.query("userId");
    if (status) filter.status = status;
    if (userId) filter.userId = userId;

    const sortFieldRaw = c.req.query("sortField");
    const sortDirRaw = c.req.query("sortDir");
    const sortField =
      sortFieldRaw &&
      ["orderNumber", "status", "total", "createdAt", "paidAt", "userEmail"].includes(sortFieldRaw)
        ? sortFieldRaw
        : "createdAt";
    const sortDir: 1 | -1 = sortDirRaw === "asc" ? 1 : -1;

    const { columnSearch, globalSearch } = parseSearch(c);

    const pipeline: PipelineStage[] = [{ $match: filter }];

    if (globalSearch) {
      pipeline.push({
        $match: {
          $expr: {
            $regexMatch: {
              input: { $toString: "$orderNumber" },
              regex: escapeRegex(globalSearch),
              options: "i",
            },
          },
        },
      });
    }

    pipeline.push(
      {
        $lookup: {
          from: Profile.collection.name,
          localField: "userId",
          foreignField: "_id",
          as: "_profile",
        },
      },
      { $unwind: { path: "$_profile", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          userEmail: { $ifNull: ["$_profile.email", "N/A"] },
          userFullName: {
            $trim: {
              input: {
                $cond: {
                  if: { $gt: ["$_profile.firstName", ""] },
                  then: { $concat: ["$_profile.firstName", " ", "$_profile.lastName"] },
                  else: "$_profile.lastName",
                },
              },
            },
          },
        },
      },
      { $project: { _profile: 0 } }
    );

    const postConditions: Record<string, unknown>[] = [];
    if (globalSearch) {
      postConditions.push(
        { userEmail: { $regex: substringRegex(globalSearch), $options: "i" } },
        { userFullName: { $regex: substringRegex(globalSearch), $options: "i" } },
        { providerSessionId: { $regex: substringRegex(globalSearch), $options: "i" } }
      );
    }
    for (const entry of columnSearch) {
      postConditions.push({
        [entry.field]: { $regex: substringRegex(entry.value), $options: "i" },
      });
    }
    if (postConditions.length > 0) {
      pipeline.push({ $match: { $or: postConditions } });
    }

    pipeline.push({ $sort: { [sortField]: sortDir } });

    const data = (await Order.aggregate(pipeline).option({ maxTimeMS: 10000 }).exec()) as Record<
      string,
      unknown
    >[];

    const csv = toCSV(data, [
      { key: "orderNumber", label: "Order Number" },
      { key: "status", label: "Status" },
      { key: "userEmail", label: "Customer Email" },
      { key: "total", label: "Total" },
      { key: "provider", label: "Payment Method" },
      { key: "providerSessionId", label: "Session ID" },
      { key: "paidAt", label: "Paid At" },
      { key: "createdAt", label: "Created At" },
    ]);
    return c.newResponse(csv, 200, {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="orders.csv"',
    });
  } catch (err: unknown) {
    console.error("Error exporting orders:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.export.orders",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/winners", async (c) => {
  try {
    await dbConnect();
    const filter: Record<string, unknown> = {};
    const claimed = c.req.query("claimed");
    if (claimed === "true") filter.claimed = true;
    else if (claimed === "false") filter.claimed = false;
    const competitionId = c.req.query("competitionId");
    if (competitionId) filter.competitionId = competitionId;

    const data = (await Winner.find(filter).sort({ drawnAt: -1 }).lean()) as unknown as Record<
      string,
      unknown
    >[];
    const csv = toCSV(data, [
      { key: "ticketNumber", label: "Ticket Number" },
      { key: "prizeValue", label: "Prize Value" },
      { key: "claimed", label: "Claimed" },
      { key: "drawnAt", label: "Drawn At" },
    ]);
    return c.newResponse(csv, 200, {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="winners.csv"',
    });
  } catch (err: unknown) {
    console.error("Error exporting winners:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.export.winners",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/promo-codes", async (c) => {
  try {
    await dbConnect();
    const filter: Record<string, unknown> = {};
    const isActive = c.req.query("isActive");
    if (isActive === "true") filter.isActive = true;
    else if (isActive === "false") filter.isActive = false;

    const search = c.req.query("search")?.trim();
    if (search) {
      const safe = escapeRegex(search);
      filter.$or = [
        { code: { $regex: safe, $options: "i" } },
        { discountType: { $regex: safe, $options: "i" } },
      ];
    }

    const data = (await PromoCode.find(filter).sort({ createdAt: -1 }).lean()) as unknown as Record<
      string,
      unknown
    >[];
    const csv = toCSV(data, [
      { key: "code", label: "Code" },
      { key: "discountType", label: "Discount Type" },
      { key: "discountValue", label: "Discount Value" },
      { key: "isActive", label: "Is Active" },
      { key: "maxUses", label: "Max Uses" },
      { key: "currentUses", label: "Current Uses" },
      { key: "expiresAt", label: "Expires At" },
    ]);
    return c.newResponse(csv, 200, {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="promo-codes.csv"',
    });
  } catch (err: unknown) {
    console.error("Error exporting promo-codes:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.export.promoCodes",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/competitions", async (c) => {
  try {
    await dbConnect();
    const filter: Record<string, unknown> = {};
    const status = c.req.query("status");
    if (status) filter.status = status;

    const search = c.req.query("search")?.trim();
    if (search) {
      const safe = escapeRegex(search);
      filter.$or = [
        { title: { $regex: safe, $options: "i" } },
        { slug: { $regex: safe, $options: "i" } },
      ];
    }

    const data = (await Competition.find(filter)
      .sort({ createdAt: -1 })
      .lean()) as unknown as Record<string, unknown>[];
    const csv = toCSV(data, [
      { key: "title", label: "Title" },
      { key: "slug", label: "Slug" },
      { key: "status", label: "Status" },
      { key: "prizeValue", label: "Prize Value" },
      { key: "ticketPrice", label: "Ticket Price" },
      { key: "drawDate", label: "Draw Date" },
    ]);
    return c.newResponse(csv, 200, {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="competitions.csv"',
    });
  } catch (err: unknown) {
    console.error("Error exporting competitions:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.export.competitions",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/instant-prizes", async (c) => {
  try {
    await dbConnect();
    const filter: Record<string, unknown> = {};
    const isActive = c.req.query("isActive");
    if (isActive === "true") filter.isActive = true;
    else if (isActive === "false") filter.isActive = false;

    const search = c.req.query("search")?.trim();
    if (search) {
      const safe = escapeRegex(search);
      filter.$or = [
        { title: { $regex: safe, $options: "i" } },
        { type: { $regex: safe, $options: "i" } },
        { description: { $regex: safe, $options: "i" } },
      ];
    }

    const data = (await InstantPrize.find(filter)
      .sort({ createdAt: -1 })
      .lean()) as unknown as Record<string, unknown>[];
    const csv = toCSV(data, [
      { key: "title", label: "Title" },
      { key: "type", label: "Type" },
      { key: "value", label: "Value" },
      { key: "isActive", label: "Is Active" },
    ]);
    return c.newResponse(csv, 200, {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="instant-prizes.csv"',
    });
  } catch (err: unknown) {
    console.error("Error exporting instant-prizes:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.export.instantPrizes",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/categories", async (c) => {
  try {
    await dbConnect();
    const filter: Record<string, unknown> = {};
    const isActive = c.req.query("isActive");
    if (isActive === "true") filter.isActive = true;
    else if (isActive === "false") filter.isActive = false;

    const search = c.req.query("search")?.trim();
    if (search) {
      const safe = escapeRegex(search);
      filter.$or = [
        { name: { $regex: safe, $options: "i" } },
        { slug: { $regex: safe, $options: "i" } },
      ];
    }

    const data = (await Category.find(filter)
      .sort({ displayOrder: 1 })
      .lean()) as unknown as Record<string, unknown>[];
    const csv = toCSV(data, [
      { key: "name", label: "Name" },
      { key: "slug", label: "Slug" },
      { key: "isActive", label: "Is Active" },
    ]);
    return c.newResponse(csv, 200, {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="categories.csv"',
    });
  } catch (err: unknown) {
    console.error("Error exporting categories:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.export.categories",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/instant-prize-wins", async (c) => {
  try {
    await dbConnect();
    const filter: Record<string, unknown> = {};
    const claimed = c.req.query("claimed");
    if (claimed === "true") filter.claimed = true;
    else if (claimed === "false") filter.claimed = false;

    const data = (await InstantPrizeWin.find(filter)
      .sort({ wonAt: -1 })
      .lean()) as unknown as Record<string, unknown>[];
    const csv = toCSV(data, [
      { key: "ticketNumber", label: "Ticket Number" },
      { key: "prizeTitle", label: "Prize Title" },
      { key: "prizeValue", label: "Prize Value" },
      { key: "claimed", label: "Claimed" },
      { key: "wonAt", label: "Won At" },
    ]);
    return c.newResponse(csv, 200, {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="instant-prize-wins.csv"',
    });
  } catch (err: unknown) {
    console.error("Error exporting instant-prize-wins:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.export.instantPrizeWins",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
