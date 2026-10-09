import { Competition, Profile, Ticket, Winner } from "@oc/api-db/models";
import type { IWinner } from "@oc/api-db/models/Winner";
import { sendEmail } from "@oc/api-email/client";
import { getEmailConfig } from "@oc/api-email/config";
import { WinNotificationEmail } from "@oc/api-email/templates/win-notification";
import { CH, invalidateByChannelSafe } from "@oc/api-infra/cache";
import dbConnect from "@oc/api-infra/db";
import { getCurrentContext } from "@oc/api-infra/env";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { escapeRegex, substringRegex } from "@oc/api-infra/fuzzy-search";
import { applyGroupBy, type GroupByFieldConfig } from "@oc/api-infra/group-by";
import { parsePagination, parseSort } from "@oc/api-infra/pagination";
import { error, paginated, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { sendPushNotification } from "@oc/api-server/lib/push";
import { requireAdmin, requireStaff } from "@oc/api-server/middleware/auth";
import type { Context, Next } from "hono";
import type { TicketLike } from "@oc/api-tickets/ticket-mapper";
import { createWinnerSchema, validateBody } from "@oc/api-validation";
import { ADMIN_WINNER_TABLE } from "@oc/types";
import { getDisplayName } from "@oc/utils";
import { render } from "@react-email/render";
import { Hono } from "hono";
import { type PipelineStage, Types } from "mongoose";

const app = new Hono();

app.use("*", requireStaff);

// Fulfilment writes on an existing winner are admin-only. Managers may confirm a
// winner (POST /) and read winner data but must not edit/claim/delete/restore.
async function requireAdminForWinnerSubRoutes(c: Context, next: Next) {
  if (c.req.method === "GET" || c.req.method === "HEAD" || c.req.method === "OPTIONS") {
    return next();
  }
  return requireAdmin(c, next);
}

app.use("/:id", requireAdminForWinnerSubRoutes);
app.use("/:id/*", requireAdminForWinnerSubRoutes);

const COMP_COLLECTION = Competition.collection.name;
const PROFILE_COLLECTION = Profile.collection.name;

app.get("/entries/search", async (c) => {
  try {
    const competitionId = c.req.query("competitionId");
    const ticketNumber = c.req.query("ticketNumber");
    if (!competitionId) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "competitionId is required", 400);
    }

    if (!ticketNumber) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "ticketNumber is required", 400);
    }

    await dbConnect();

    const ticketNum = parseInt(ticketNumber!, 10);
    if (Number.isNaN(ticketNum)) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "ticketNumber must be a number", 400);
    }

    const entries = await Ticket.find({
      competitionId,
      number: ticketNum,
      status: "sold",
    }).lean();

    if (entries.length === 0) {
      return error(c, ErrorCodes.NOT_FOUND, "No entry found with that ticket number", 404);
    }

    const entry = entries[0] as TicketLike & { _id: Types.ObjectId };
    const profile = await Profile.findById(entry.ownerId).select("email firstName lastName").lean();
    const competition = await Competition.findById(competitionId).select("title prizeValue").lean();

    return success(c, {
      entry: {
        _id: entry._id,
        entryNumber: entry.number,
        userId: entry.ownerId,
      },
      profile: profile
        ? { email: profile.email, firstName: profile.firstName, lastName: profile.lastName }
        : { email: null, firstName: null, lastName: null },
      competition: competition
        ? {
            title: competition.title,
            prizeValue: competition.prizeValue,
          }
        : null,
    });
  } catch (err: unknown) {
    console.error("Error searching entry:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.winners.search",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/", async (c) => {
  try {
    const { limit, page } = parsePagination(c);
    const groupBy = c.req.query("groupBy");
    const { sortObj, sortableFields, sortDir } = parseSort(c, {
      fields: [...ADMIN_WINNER_TABLE.sortableFields],
      defaultSort: { drawnAt: -1 },
    });
    await dbConnect();

    const showDeleted = c.req.query("showDeleted") === "true";
    const query: Record<string, unknown> = {};
    if (!showDeleted) {
      query.deletedAt = null;
    }
    const claimed = c.req.query("claimed");
    const competitionId = c.req.query("competitionId");
    const userId = c.req.query("userId");
    const search = c.req.query("search");

    if (claimed !== undefined) query.claimed = claimed === "true";
    if (competitionId) query.competitionId = competitionId;
    if (userId) query.userId = userId;

    if (search) {
      const safe = escapeRegex(search);
      query.$or = [
        {
          $expr: {
            $regexMatch: { input: { $toString: "$ticketNumber" }, regex: safe, options: "i" },
          },
        },
        { displayName: { $regex: substringRegex(search), $options: "i" } },
      ];
    }

    // Base pipeline without sort/skip/limit — shared between flat and grouped
    const basePipeline: PipelineStage[] = [
      { $match: query },

      // Lookup Competition
      {
        $lookup: {
          from: COMP_COLLECTION,
          localField: "competitionId",
          foreignField: "_id",
          as: "comp",
        },
      },
      { $unwind: { path: "$comp", preserveNullAndEmptyArrays: true } },

      // Lookup Profile
      {
        $lookup: {
          from: PROFILE_COLLECTION,
          localField: "userId",
          foreignField: "_id",
          as: "profile",
        },
      },
      { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },

      // Project final shape
      {
        $project: {
          _id: 1,
          competitionId: 1,
          userId: 1,
          entryId: 1,
          ticketNumber: 1,
          prizeTitle: 1,
          prizeValue: 1,
          prizeImageUrl: 1,
          winnerPhotoUrl: 1,
          displayName: 1,
          location: 1,
          testimonial: 1,
          showFullName: 1,
          claimed: 1,
          claimedAt: 1,
          drawnAt: 1,
          notifiedAt: 1,
          deletedAt: 1,
          deletedBy: 1,
          createdAt: 1,
          updatedAt: 1,
          competitionTitle: { $ifNull: ["$comp.title", ""] },
          competitionSlug: { $ifNull: ["$comp.slug", ""] },
          email: { $ifNull: ["$profile.email", ""] },
        },
      },
      ...(() => {
        if (!search) return [];
        return [
          {
            $match: {
              $or: [
                {
                  $expr: {
                    $regexMatch: {
                      input: { $toString: "$ticketNumber" },
                      regex: escapeRegex(search),
                      options: "i",
                    },
                  },
                },
                { displayName: { $regex: substringRegex(search), $options: "i" } },
                { email: { $regex: substringRegex(search), $options: "i" } },
                { competitionTitle: { $regex: substringRegex(search), $options: "i" } },
              ],
            },
          },
        ];
      })(),
    ];

    const searchPostMatch: PipelineStage[] = search
      ? [
          {
            $match: {
              $or: [
                {
                  $expr: {
                    $regexMatch: {
                      input: { $toString: "$ticketNumber" },
                      regex: escapeRegex(search),
                      options: "i",
                    },
                  },
                },
                { displayName: { $regex: substringRegex(search), $options: "i" } },
                { email: { $regex: substringRegex(search), $options: "i" } },
                { competitionTitle: { $regex: substringRegex(search), $options: "i" } },
              ],
            },
          },
        ]
      : [];

    const baseCountPipeline: PipelineStage[] = [{ $match: query }, ...searchPostMatch];

    const GROUPING_CONFIG: Record<string, GroupByFieldConfig> = {
      user: { groupKey: "$userId", groupLabel: "$email" },
      prize: { groupKey: "$prizeTitle", groupLabel: "$prizeTitle" },
      competition: { groupKey: "$competitionId", groupLabel: "$competitionTitle" },
    };

    const { dataPipeline, countPipeline } = applyGroupBy(
      basePipeline,
      baseCountPipeline,
      groupBy,
      GROUPING_CONFIG,
      page,
      limit,
      sortObj,
      sortDir
    );

    const [winners, totalResult] = await Promise.all([
      Winner.aggregate(dataPipeline).option({ maxTimeMS: 5000 }).exec(),
      Winner.aggregate(countPipeline).option({ maxTimeMS: 5000 }).exec(),
    ]);

    const total = totalResult.length > 0 ? (totalResult[0] as { total: number }).total : 0;

    return paginated(c, winners, total, page, limit, { sortableFields });
  } catch (err: unknown) {
    console.error("Error listing winners:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.winners.list",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/deleted", async (c) => {
  try {
    await dbConnect();
    const items = await Winner.findDeleted().sort({ deletedAt: -1 }).limit(50).lean();
    return success(c, items);
  } catch (err: unknown) {
    console.error("Error listing deleted winners:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.winners.listDeleted",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();

    const winner = await Winner.findById(id).lean();
    if (!winner) {
      return error(c, ErrorCodes.NOT_FOUND, "Winner not found", 404);
    }

    const [competition, profile] = await Promise.all([
      Competition.findById(winner.competitionId).select("title slug").lean(),
      Profile.findById(winner.userId).select("email").lean(),
    ]);

    return success(c, {
      ...winner,
      competitionTitle: competition?.title ?? "",
      competitionSlug: competition?.slug ?? "",
      email: profile?.email ?? "",
    });
  } catch (err: unknown) {
    console.error("Error fetching winner:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.winners.getOne",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post(
  "/",
  async (c, next) => validateBody(c, next, createWinnerSchema),
  async (c) => {
    try {
      const body = c.get("body") as Record<string, unknown>;
      const competitionId = body.competitionId as string;
      const ticketNumber = body.ticketNumber as number;
      const prizeTitle = body.prizeTitle as string | undefined;
      const prizeValue = body.prizeValue as number | undefined;
      const displayName = body.displayName as string | undefined;
      const location = body.location as string | undefined;
      const testimonial = body.testimonial as string | undefined;
      const showFullName = body.showFullName as boolean | undefined;

      await dbConnect();

      const competition = await Competition.findById(competitionId as string).lean();
      if (!competition) {
        return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);
      }

      if (competition.status === "drawn") {
        return error(c, ErrorCodes.VALIDATION_ERROR, "Competition already has a winner", 400);
      }

      const ticketNum = ticketNumber;

      const tickets = await Ticket.find({
        competitionId,
        number: ticketNum,
        status: "sold",
      }).lean();

      if (tickets.length === 0) {
        return error(
          c,
          ErrorCodes.NOT_FOUND,
          "No entry found with that ticket number for this competition",
          404
        );
      }

      const winningTicket = tickets[0] as TicketLike & { _id: Types.ObjectId };

      const winner = await Winner.create({
        competitionId,
        userId: winningTicket.ownerId!,
        entryId: winningTicket._id,
        ticketNumber: ticketNum,
        prizeTitle: prizeTitle ?? competition.title,
        prizeValue: prizeValue ?? competition.prizeValue,
        displayName: displayName ?? "",
        location: location ?? "",
        testimonial: testimonial ?? "",
        showFullName: showFullName ?? false,
        drawnAt: new Date(),
      });

      await Competition.findByIdAndUpdate(competitionId, {
        status: "drawn",
        winnerTicketNumber: ticketNum,
      });

      await invalidateByChannelSafe(
        CH.winners,
        CH.winnersByCompetition,
        CH.competitions,
        CH.competitionDetail,
        CH.competitionFeatured,
        CH.entries,
        CH.stats,
        CH.landingPage,
        CH.competitionAvailability,
        CH.competitionsAvailabilityBatch
      );

      // Auto-claim for guest users
      const winnerProfile = await Profile.findById(winningTicket.ownerId).lean();
      const isGuestWinner = winnerProfile?.isGuestCheckout === true;
      if (isGuestWinner) {
        await Winner.findByIdAndUpdate(winner._id, { claimed: true, claimedAt: new Date() });
      }

      (async () => {
        try {
          const [settings] = await Promise.all([getEmailConfig()]);
          if (!winnerProfile?.email) return;
          const userName = getDisplayName(winnerProfile, winnerProfile.email);
          const { frontendUrl } = getCurrentContext();
          const claimUrl = winnerProfile?.isGuestCheckout
            ? `${frontendUrl}/auth/login?returnTo=/dashboard/wins`
            : `${frontendUrl}/dashboard/wins`;
          const emailHtml = await render(
            WinNotificationEmail({
              userName,
              competitionName: competition.title,
              prizeTitle: prizeTitle ?? competition.title,
              prizeValue: (prizeValue ?? competition.prizeValue) || 0,
              claimUrl,
              settings,
              isGuest: isGuestWinner,
            })
          );
          await sendEmail({
            to: winnerProfile.email,
            subject: `Congratulations! You've won ${prizeTitle ?? competition.title}!`,
            html: emailHtml,
          });

          try {
            await Winner.findByIdAndUpdate(winner._id, { notifiedAt: new Date() });
          } catch (updateErr) {
            console.error("Failed to update notifiedAt for winner:", updateErr);
          }

          // Push notification to winner
          void sendPushNotification(
            {
              title: `You won ${prizeTitle ?? competition.title}!`,
              body: `Congratulations! You have won ${prizeTitle ?? competition.title} valued at £${(prizeValue ?? competition.prizeValue)?.toLocaleString() || "0"}!`,
              type: "draw_result",
              url: "/dashboard/wins",
              tag: `winner-${winner._id.toString()}`,
            },
            { userId: winningTicket.ownerId!.toString() }
          ).catch(() => {});
        } catch (emailErr) {
          console.error("Failed to send win notification email:", emailErr);
        }
      })();

      return success(c, winner);
    } catch (err: unknown) {
      console.error("Error creating winner:", err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "admin.winners.create",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.put("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    await dbConnect();

    const winner = await Winner.findByIdAndUpdate(id, body as Partial<IWinner>, {
      returnDocument: "after",
    }).lean();
    if (!winner) {
      return error(c, ErrorCodes.NOT_FOUND, "Winner not found", 404);
    }

    await invalidateByChannelSafe(CH.winners, CH.winnersByCompetition);
    return success(c, winner);
  } catch (err: unknown) {
    console.error("Error updating winner:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.winners.update",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.patch("/:id/claim", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();

    const winner = await Winner.findByIdAndUpdate(
      id,
      { claimed: true, claimedAt: new Date() },
      { returnDocument: "after" }
    ).lean();

    if (!winner) {
      return error(c, ErrorCodes.NOT_FOUND, "Winner not found", 404);
    }

    await invalidateByChannelSafe(CH.winners, CH.winnersByCompetition);
    return success(c, winner);
  } catch (err: unknown) {
    console.error("Error claiming winner:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.winners.claim",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();

    const winner = await Winner.findById(id).lean();
    if (!winner) {
      return error(c, ErrorCodes.NOT_FOUND, "Winner not found", 404);
    }
    if (winner.claimed === true) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Cannot delete a claimed winner record", 400);
    }

    await Winner.softDelete(id, c.get("userId") ?? undefined);

    await invalidateByChannelSafe(CH.winners, CH.winnersByCompetition);
    return success(c, { success: true });
  } catch (err: unknown) {
    console.error("Error deleting winner:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.winners.delete",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/:id/restore", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();
    const restored = await Winner.restore(id);
    if (!restored) {
      return error(c, ErrorCodes.NOT_FOUND, "Winner not found", 404);
    }
    await invalidateByChannelSafe(CH.winners, CH.winnersByCompetition);
    return success(c, { restored: true });
  } catch (err: unknown) {
    console.error("Error restoring winner:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.winners.restore",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
