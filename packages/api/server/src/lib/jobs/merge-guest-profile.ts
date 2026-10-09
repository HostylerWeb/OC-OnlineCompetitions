#!/usr/bin/env bun
/**
 * Reconcile a duplicate guest-checkout profile into an existing verified
 * account, then backfill related data-integrity gaps.
 *
 * Problem it fixes: `createGuestCheckoutProfile` canonicalizes Gmail emails
 * (strips dots) before the existing-verified lookup, while `createOnlineCompetitionsProfile`
 * stored the raw dotted email. A guest entering alexandru.chiriacc@gmail.com
 * therefore got a NEW guest profile (alexandruchiriacc@gmail.com) instead of
 * attaching to the existing verified account.
 *
 * Usage:
 *   bun run packages/api/server/src/lib/jobs/merge-guest-profile.ts --dry-run
 *   bun run packages/api/server/src/lib/jobs/merge-guest-profile.ts --apply
 *   bun run packages/api/server/src/lib/jobs/merge-guest-profile.ts --apply --guestId=<oid> --verifiedId=<oid>
 *
 * Also backfills:
 *   - fulfillmentStatus=completed on local (free/zero-total) completed orders
 *   - promoCodeId on orders that carry metadata.promoCode but no promoCodeId
 *   - net totalSpent for the merged verified profile
 */

import {
  Balance,
  Cart,
  Order,
  PaymentAttempt,
  Profile,
  PromoCode,
  Ticket,
} from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { canonicalizeEmail } from "@oc/auth-admin/auth-hooks";
import { getMongoDb } from "@oc/auth-admin/auth-mongo";
import mongoose from "mongoose";

interface Args {
  dryRun: boolean;
  guestId: string | null;
  verifiedId: string | null;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const result: Args = { dryRun: true, guestId: null, verifiedId: null };
  for (const arg of args) {
    if (arg === "--apply") result.dryRun = false;
    if (arg === "--dry-run") result.dryRun = true;
    if (arg.startsWith("--guestId=")) result.guestId = arg.slice("--guestId=".length);
    if (arg.startsWith("--verifiedId=")) result.verifiedId = arg.slice("--verifiedId=".length);
  }
  return result;
}

function isValidOid(value: string | null): boolean {
  return value != null && mongoose.Types.ObjectId.isValid(value);
}

async function backfillLocalFulfillmentStatus(dryRun: boolean): Promise<void> {
  const filter = {
    provider: "local",
    status: "completed",
    fulfillmentStatus: { $ne: "completed" },
  } as const;
  const count = await Order.countDocuments(filter as Record<string, unknown>);
  console.log(`[backfill.localFulfillment] found ${count} local orders to mark completed`);
  if (!dryRun && count > 0) {
    const res = await Order.updateMany(filter as Record<string, unknown>, {
      $set: { fulfillmentStatus: "completed" },
    });
    console.log(
      `[backfill.localFulfillment] updated ${res.modifiedCount ?? 0} orders (apply mode)`
    );
  }
}

async function backfillPromoCodeIds(dryRun: boolean): Promise<void> {
  const orders = await Order.find({
    promoCodeId: { $exists: false },
    "metadata.promoCode": { $exists: true },
  }).lean();
  console.log(`[backfill.promoCodeId] found ${orders.length} orders with metadata.promoCode`);

  const codes = [
    ...new Set(orders.map((o) => String((o.metadata as Record<string, unknown>).promoCode ?? ""))),
  ].filter(Boolean);
  const promos = await PromoCode.find({ code: { $in: codes } }).lean();
  const promoByCode = new Map(promos.map((p) => [p.code.toUpperCase(), p._id]));

  for (const order of orders) {
    const code = String((order.metadata as Record<string, unknown>).promoCode ?? "").toUpperCase();
    const promoId = promoByCode.get(code);
    if (!promoId) {
      console.warn(
        `  ⚠ order ${order.orderNumber} promoCode=${code} — no PromoCode doc found, skipping`
      );
      continue;
    }
    if (dryRun) {
      console.log(`  ✓ order ${order.orderNumber} → promoCodeId=${promoId}`);
    } else {
      await Order.updateOne(
        { _id: order._id, promoCodeId: { $exists: false } },
        { $set: { promoCodeId: promoId } }
      );
    }
  }
}

async function reconcileGuestProfile(
  args: Args,
  guestId: string,
  verifiedId: string
): Promise<void> {
  const guestOid = new mongoose.Types.ObjectId(guestId);
  const verifiedOid = new mongoose.Types.ObjectId(verifiedId);

  const guest = await Profile.findById(guestOid).lean();
  const verified = await Profile.findById(verifiedOid).lean();
  if (!guest) throw new Error(`Guest profile ${guestId} not found`);
  if (!verified) throw new Error(`Verified profile ${verifiedId} not found`);

  console.log(`[merge] guest=${guest.email} (${guestId})`);
  console.log(`[merge] verified=${verified.email} (${verifiedId})`);

  if (
    guest.email === verified.email ||
    canonicalizeEmail(guest.email) !== canonicalizeEmail(verified.email)
  ) {
    console.warn("[merge] WARNING: guest and verified emails are not canonical matches");
  }

  const preOrders = await Order.countDocuments({ userId: guestOid });
  const preTickets = await Ticket.countDocuments({ ownerId: guestOid });
  const prePaymentAttempts = await PaymentAttempt.countDocuments({ userId: guestOid });
  const preCarts = await Cart.countDocuments({ userId: guestOid });
  const preBalances = await Balance.countDocuments({ userId: guestOid });
  const preSessions = await getMongoDb()
    .collection("session")
    .countDocuments({ userId: new mongoose.Types.ObjectId(guestId) });

  console.log(
    `[merge] guest ownership: orders=${preOrders} tickets=${preTickets} paymentAttempts=${prePaymentAttempts} carts=${preCarts} balances=${preBalances} sessions=${preSessions}`
  );

  const guestPhone = guest.phone ?? null;

  if (args.dryRun) {
    console.log("[merge] dry-run — no changes applied");
    return;
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Reassign ownership to verified user
      await Order.updateMany({ userId: guestOid }, { $set: { userId: verifiedOid } });
      await Ticket.updateMany({ ownerId: guestOid }, { $set: { ownerId: verifiedOid } });
      await PaymentAttempt.updateMany({ userId: guestOid }, { $set: { userId: verifiedOid } });

      // Cart + Balance carry a unique userId index — delete the guest's empty
      // rows rather than reassigning (merge into existing if the guest has items).
      const guestCart = await Cart.findOne({ userId: guestOid }).lean();
      if (guestCart) {
        const verifiedCart = await Cart.findOne({ userId: verifiedOid }).lean();
        if (!verifiedCart) {
          await Cart.updateOne({ _id: guestCart._id }, { $set: { userId: verifiedOid } });
        } else {
          const items = [...(verifiedCart.items ?? []), ...(guestCart.items ?? [])];
          await Cart.updateOne(
            { _id: verifiedCart._id },
            { $set: { items, cartVersion: (verifiedCart.cartVersion ?? 0) + 1 } }
          );
          await Cart.deleteOne({ _id: guestCart._id });
        }
      }
      const guestBalance = await Balance.findOne({ userId: guestOid }).lean();
      if (guestBalance) {
        const verifiedBalance = await Balance.findOne({ userId: verifiedOid }).lean();
        if (!verifiedBalance) {
          await Balance.updateOne({ _id: guestBalance._id }, { $set: { userId: verifiedOid } });
        } else {
          await Balance.updateOne(
            { _id: verifiedBalance._id },
            { $inc: { available: guestBalance.available ?? 0, pending: guestBalance.pending ?? 0 } }
          );
          await Balance.deleteOne({ _id: guestBalance._id });
        }
      }

      // Revoke guest sessions only (per decision: leave the BetterAuth user doc).
      // Sessions store userId as ObjectId.
      await getMongoDb()
        .collection("session")
        .deleteMany({ userId: new mongoose.Types.ObjectId(guestId) });

      // Recompute counters from ground truth (net spend semantics).
      const totalEntries = await Ticket.countDocuments({
        ownerId: verifiedOid,
        orderId: { $exists: true, $ne: null },
      });
      const totalSpentAgg = await Order.aggregate<{ total: number }>([
        { $match: { userId: verifiedOid, deletedAt: null, status: "completed" } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]).exec();
      const totalSpent = totalSpentAgg[0]?.total ?? 0;

      // Preserve the verified phone; only adopt guest phone if verified lacks one
      // and the guest value is not the doubled-length anomaly.
      const phoneUpdate: Record<string, unknown> = {};
      if (
        !verified.phone &&
        guestPhone &&
        typeof guestPhone === "string" &&
        guestPhone.length <= 15
      ) {
        phoneUpdate.phone = guestPhone;
      }

      await Profile.updateOne(
        { _id: verifiedOid },
        {
          $set: {
            totalEntries,
            totalSpent,
            ...phoneUpdate,
          },
        }
      );

      // Delete the guest profile.
      await Profile.deleteOne({ _id: guestOid });

      console.log(
        `[merge] recomputed verified counters: entries=${totalEntries} spent=${totalSpent}`
      );
      if (Object.keys(phoneUpdate).length > 0) {
        console.log(`[merge] adopted guest phone ${phoneUpdate.phone}`);
      }
    });
  } finally {
    await session.endSession();
  }

  // Post-merge verification
  const postOrders = await Order.countDocuments({ userId: verifiedOid });
  const postTickets = await Ticket.countDocuments({ ownerId: verifiedOid });
  const guestGone = (await Profile.findById(guestOid).lean()) === null;
  console.log(
    `[merge] post verified: orders=${postOrders} tickets=${postTickets} guestDeleted=${guestGone}`
  );
  console.log(
    `[merge] expected orders += ${preOrders} (now ${postOrders}), tickets += ${preTickets} (now ${postTickets})`
  );
}

async function main(): Promise<void> {
  const args = parseArgs();
  console.log(`[merge-guest-profile] starting (dryRun=${args.dryRun})`);
  await dbConnect();

  if (args.guestId && args.verifiedId) {
    if (!isValidOid(args.guestId) || !isValidOid(args.verifiedId)) {
      console.error("[merge-guest-profile] invalid --guestId / --verifiedId");
      process.exit(1);
    }
    await reconcileGuestProfile(args, args.guestId, args.verifiedId);
  } else {
    // Find duplicate profiles by canonical email (verified + guest sharing one).
    const profiles = await Profile.find({ isGuestCheckout: true }).lean();
    for (const guest of profiles) {
      if (guest.email.endsWith("@guest.onlinecompetitions.local")) continue;
      const canonical = canonicalizeEmail(guest.email);
      const verified = await Profile.findOne({
        email: canonical,
        isGuestCheckout: false,
        _id: { $ne: guest._id },
      }).lean();
      if (verified) {
        console.log(
          `[merge] candidate: guest=${guest.email} (${guest._id}) → verified=${verified.email} (${verified._id})`
        );
        if (!args.dryRun) {
          await reconcileGuestProfile(args, guest._id.toString(), verified._id.toString());
        }
      }
    }
  }

  await backfillLocalFulfillmentStatus(args.dryRun);
  await backfillPromoCodeIds(args.dryRun);

  console.log("[merge-guest-profile] done");
  process.exit(0);
}

main().catch((err) => {
  console.error("[merge-guest-profile] failed:", err);
  process.exit(1);
});
