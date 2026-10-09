import { Competition, Order, Profile, ReferralPurchase } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { createLogger } from "@oc/api-logger";
import { grantInstantPrizeWinsForAssignedNumbers } from "@oc/api-payment-core";
import { sendReferralTicketsRedeemedEmail } from "@oc/api-referrals/referral-emails";
import { validateReferralTicketSpend } from "@oc/api-referrals/referral-ticket-validation";
import { buildFulfillmentDeps } from "@oc/api-server/lib/payment/build-fulfillment-deps";
import { rollbackOrderFulfillment } from "@oc/api-server/lib/payment/rollback-order-fulfillment";
import { auth } from "@oc/api-server/middleware/auth";
import { generateOrderNumber } from "@oc/api-tickets/create-session";
import { claimTicketsForOrder, TicketAvailabilityError } from "@oc/api-tickets/ticket-service";
import { Hono } from "hono";
import { Types } from "mongoose";

const app = new Hono();

app.use("*", auth);

app.get("/", async (c) => {
  try {
    const userId = c.get("userId")!;
    log.debug(`[me.tickets.list] ENTER: userId=${userId}`);
    await dbConnect();

    const profile = await Profile.findById(userId).lean();
    if (!profile) {
      log.debug(`[me.tickets.list] userId=${userId} PROFILE NOT FOUND`);
      return error(c, ErrorCodes.NOT_FOUND, "Profile not found", 404);
    }

    const walletBalance = profile.referralTierAwardedTickets ?? 0;
    log.debug(`[me.tickets.list] userId=${userId} walletBalance=${walletBalance}`);

    const lifetimeAgg = await ReferralPurchase.aggregate([
      { $match: { referrerId: profile._id, deletedAt: null } },
      { $group: { _id: null, total: { $sum: "$ticketsAwarded" } } },
    ]);
    const lifetimeEarned = lifetimeAgg[0]?.total ?? walletBalance;
    log.debug(
      `[me.tickets.list] EXIT: userId=${userId} walletBalance=${walletBalance} lifetimeEarned=${lifetimeEarned}`
    );

    return success(c, {
      walletBalance,
      lifetimeEarned,
      awardedTickets: walletBalance,
      totalTickets: walletBalance,
    });
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "me.tickets.list",
    });
    console.error("Error fetching tickets:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/redeem", async (c) => {
  try {
    const userId = c.get("userId")!;
    await dbConnect();

    const body = await c.req.json<{ competitionId: string; quantity: number }>();
    const { competitionId, quantity } = body;

    if (!competitionId || !quantity || quantity <= 0) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid competitionId or quantity", 400);
    }

    const profile = await Profile.findById(userId).lean();
    if (!profile) {
      return error(c, ErrorCodes.NOT_FOUND, "Profile not found", 404);
    }

    const validation = await validateReferralTicketSpend({
      userId,
      competitionId,
      quantity,
      walletBalance: profile.referralTierAwardedTickets ?? 0,
    });
    if (!validation.ok) {
      const status = validation.code === "COMPETITION_NOT_FOUND" ? 404 : 400;
      return error(c, ErrorCodes.VALIDATION_ERROR, validation.message, status);
    }

    const awardedTickets = profile.referralTierAwardedTickets ?? 0;

    const updated = await Profile.findOneAndUpdate(
      {
        _id: userId,
        referralTierAwardedTickets: { $gte: quantity },
      },
      { $inc: { referralTierAwardedTickets: -quantity, totalEntries: quantity } },
      { returnDocument: "after" }
    ).lean();

    if (!updated) {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        `Insufficient tickets. You have ${awardedTickets} but need ${quantity}`,
        400
      );
    }

    const competition = await Competition.findById(competitionId).lean();
    const orderNumber = await generateOrderNumber();
    const order = await Order.create({
      orderNumber,
      userId: new Types.ObjectId(userId),
      subtotal: 0,
      total: 0,
      status: "completed",
      fulfillmentStatus: "completed",
      competitionIds: [competitionId],
    });
    const referralOrderId = order._id.toString();
    const fulfillmentDeps = buildFulfillmentDeps();

    try {
      const allocation = await claimTicketsForOrder({
        userId,
        competitionId,
        orderId: referralOrderId,
        qty: quantity,
        answerIndex: 0,
      });

      const instantWinEmailItems = await grantInstantPrizeWinsForAssignedNumbers({
        userId,
        assignedNumbers: [
          {
            competitionId,
            ticketNumbers: allocation.numbers,
            entryIds: allocation.ticketIds,
          },
        ],
        deps: fulfillmentDeps,
        logPrefix: "Referral",
        competitionTitles: new Map([[competitionId, competition?.title ?? "Competition"]]),
      });
      if (instantWinEmailItems.length > 0) {
        void fulfillmentDeps
          .sendInstantWinEmail({ userId, wins: instantWinEmailItems })
          .catch((emailErr) => {
            console.error(
              `[Referral] sendInstantWinEmail failed for order ${referralOrderId}:`,
              emailErr
            );
          });
      }

      void sendReferralTicketsRedeemedEmail({
        userId,
        competitionTitle: competition?.title ?? "Competition",
        quantityRedeemed: quantity,
        ticketNumbers: allocation.numbers,
        walletBalance: updated.referralTierAwardedTickets ?? 0,
      }).catch((emailErr) => {
        console.error(
          `[Referral] sendReferralTicketsRedeemedEmail failed for order ${referralOrderId}:`,
          emailErr
        );
      });

      return success(c, {
        redeemed: quantity,
        awardedTickets: updated.referralTierAwardedTickets,
        totalEntries: updated.totalEntries,
        competitionId,
        ticketNumbers: allocation.numbers,
        entriesCreated: allocation.numbers,
      });
    } catch (allocErr) {
      try {
        await rollbackOrderFulfillment({
          orderId: referralOrderId,
          userId,
          profileStatsDelta: { entries: quantity, spent: 0 },
        });
      } catch (rollbackErr) {
        console.error(
          `[Referral] rollbackOrderFulfillment failed for order ${referralOrderId}:`,
          rollbackErr
        );
      }

      await Profile.findByIdAndUpdate(userId, {
        $inc: { referralTierAwardedTickets: quantity, totalEntries: -quantity },
      });
      console.error("Referral ticket allocation failed, rolled back awarded tickets:", allocErr);
      const message =
        allocErr instanceof TicketAvailabilityError && allocErr.code === "TICKETS_SOLD_OUT"
          ? "Not enough tickets available in this competition"
          : "Failed to allocate tickets";
      return error(c, ErrorCodes.VALIDATION_ERROR, message, 400);
    }
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "me.tickets.redeem",
    });
    console.error("Error redeeming tickets:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;

const log = createLogger("tickets");
