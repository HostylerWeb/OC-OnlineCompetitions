import {
  BalanceTransaction,
  ComplianceAuditLog,
  Order,
  Profile,
  ReferralPurchase,
} from "@oc/api-db/models";
import mongoose from "mongoose";

export type TimelineEventType =
  | "signup"
  | "referral_link_clicked"
  | "email_verified"
  | "age_verified"
  | "order_placed"
  | "order_paid"
  | "order_refunded"
  | "referral_purchase_qualified"
  | "tickets_awarded"
  | "tier_reached"
  | "wallet_credit"
  | "wallet_debit"
  | "compliance_override";

export interface TimelineEventMeta {
  orderId?: string;
  orderNumber?: number;
  orderEmail?: string;
  orderProvider?: string;
  orderStatus?: string;
  orderSubtotal?: number;
  orderDiscount?: number;
  orderTotal?: number;
  orderPromoCode?: string;
  orderReferralCode?: string;
  orderIsGuest?: boolean;
  orderProviderSessionId?: string;
  orderPaymentProviderCode?: string;
  referrerId?: string;
  referrerEmail?: string;
  referredId?: string;
  referredEmail?: string;
  referralCode?: string;
  referralPurchaseId?: string;
  tier?: number;
  ticketsAwarded?: number;
  isQualifying?: boolean;
  actorId?: string;
  actorEmail?: string;
  source?: string;
  action?: string;
  walletType?: string;
  walletStatus?: string;
  balanceAfter?: number;
  balanceBefore?: number;
  paymentProviderTransactionId?: string;
  walletNote?: string;
  verificationMethod?: string;
}

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  timestamp: string;
  title: string;
  description?: string;
  meta: TimelineEventMeta;
  amount?: number;
  ticketCount?: number;
  iconKey: string;
  tone: "neutral" | "success" | "warning" | "destructive" | "info";
}

export interface UserActivityTimelineOptions {
  limit?: number;
  includeDeleted?: boolean;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function eventId(type: TimelineEventType, key: string): string {
  return `${type}:${key}`;
}

function toGbp(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}

export async function getUserActivityTimeline(
  userId: string,
  options: UserActivityTimelineOptions = {}
): Promise<TimelineEvent[]> {
  const oid = new mongoose.Types.ObjectId(userId);
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const includeDeleted = options.includeDeleted === true;

  const events: TimelineEvent[] = [];

  const profile = await Profile.findById(oid).lean();
  if (profile) {
    const email = (profile.email as string) ?? "unknown";
    events.push({
      id: eventId("signup", userId),
      type: "signup",
      timestamp: new Date(profile.createdAt as Date).toISOString(),
      title: "Account created",
      description: `Signed up with ${email}`,
      meta: {
        orderEmail: email,
        referredId: (profile.referredBySignup as mongoose.Types.ObjectId | undefined)?.toString(),
        referralCode:
          (profile.referredByCode as string | undefined) ??
          (profile.referredBySignupCode as string | undefined),
      },
      iconKey: "UserPlus",
      tone: "info",
    });
    const code =
      (profile.referredByCode as string | undefined) ??
      (profile.referredBySignupCode as string | undefined);
    if (code) {
      const signupReferrerId = (
        profile.referredBySignup as mongoose.Types.ObjectId | undefined
      )?.toString();
      let signupReferrerEmail: string | undefined;
      if (signupReferrerId) {
        const referrerProfile = await Profile.findById(signupReferrerId)
          .select({ email: 1 })
          .lean();
        signupReferrerEmail = referrerProfile?.email as string | undefined;
      }
      events.push({
        id: eventId("referral_link_clicked", userId),
        type: "referral_link_clicked",
        timestamp: new Date(profile.createdAt as Date).toISOString(),
        title: "Referred by signup",
        description: `Used referral code ${code}`,
        meta: {
          referralCode: code,
          referrerId: signupReferrerId,
          referrerEmail: signupReferrerEmail,
        },
        iconKey: "Link",
        tone: "neutral",
      });
    }
    if (profile.isVerified) {
      events.push({
        id: eventId("email_verified", userId),
        type: "email_verified",
        timestamp: new Date(profile.updatedAt as Date).toISOString(),
        title: "Email verified",
        description: email,
        meta: { orderEmail: email },
        iconKey: "MailCheck",
        tone: "success",
      });
    }
    if (profile.isAgeVerified && profile.ageVerifiedAt) {
      events.push({
        id: eventId("age_verified", userId),
        type: "age_verified",
        timestamp: new Date(profile.ageVerifiedAt as Date).toISOString(),
        title: "Age verified",
        description: profile.ageVerificationMethod
          ? `Method: ${String(profile.ageVerificationMethod)}`
          : undefined,
        meta: {
          verificationMethod: profile.ageVerificationMethod
            ? String(profile.ageVerificationMethod)
            : undefined,
          orderEmail: email,
        },
        iconKey: "BadgeCheck",
        tone: "success",
      });
    }
  }

  const orderQuery: Record<string, unknown> = { userId: oid };
  if (!includeDeleted) orderQuery.deletedAt = null;
  const orders = await Order.find(orderQuery).sort({ createdAt: -1 }).limit(limit).lean();
  for (const order of orders) {
    const orderId = order._id.toString();
    const total = Number(order.total);
    const subtotal = Number(order.subtotal);
    const discount = Number(order.discountAmount);
    const meta: TimelineEventMeta = {
      orderId,
      orderNumber: order.orderNumber,
      orderEmail:
        (order.orderEmail as string | undefined) ?? (profile?.email as string | undefined),
      orderProvider: order.provider as string | undefined,
      orderStatus: order.status as string,
      orderSubtotal: subtotal,
      orderDiscount: discount,
      orderTotal: total,
      orderIsGuest: !!order.isGuestCheckout,
      orderProviderSessionId: order.providerSessionId as string | undefined,
      orderPaymentProviderCode: (order.metadata as Record<string, unknown> | undefined)?.orderId as
        | string
        | undefined,
      orderReferralCode: order.referralCode as string | undefined,
    };
    if (order.promoCodeId) {
      meta.orderPromoCode = order.promoCodeId.toString();
    }
    events.push({
      id: eventId("order_placed", orderId),
      type: "order_placed",
      timestamp: new Date(order.createdAt as Date).toISOString(),
      title: `Order #${order.orderNumber} placed`,
      description: `${toGbp(total)} via ${order.provider ?? "unknown"}`,
      meta,
      amount: total,
      iconKey: "ShoppingCart",
      tone: "neutral",
    });
    if (order.paidAt) {
      const status = order.status as string;
      events.push({
        id: eventId("order_paid", orderId),
        type: status === "refunded" ? "order_refunded" : "order_paid",
        timestamp: new Date(order.paidAt as Date).toISOString(),
        title:
          status === "refunded"
            ? `Order #${order.orderNumber} refunded`
            : `Order #${order.orderNumber} paid`,
        description: toGbp(total),
        meta: { ...meta },
        amount: total,
        iconKey: status === "refunded" ? "RotateCcw" : "CreditCard",
        tone: status === "refunded" ? "warning" : "success",
      });
    }
  }

  const refPurchasesAsReferee = await ReferralPurchase.find({
    $or: [{ referrerId: oid }, { referredUserId: oid }],
    ...(includeDeleted ? {} : { deletedAt: null }),
  })
    .sort({ purchasedAt: -1 })
    .limit(limit)
    .lean();
  for (const rp of refPurchasesAsReferee) {
    const isReferee = rp.referredUserId.toString() === userId;
    const isReferrer = rp.referrerId.toString() === userId;
    const purchasedAt = new Date(rp.purchasedAt).toISOString();
    const amount = Number(rp.purchaseAmount) || 0;
    const orderMeta: TimelineEventMeta = {
      orderId: rp.orderId.toString(),
      orderTotal: amount,
      referrerId: rp.referrerId.toString(),
      referrerEmail: rp.referrerEmail,
      referredId: rp.referredUserId.toString(),
      referredEmail: rp.referredEmail,
      referralPurchaseId: rp._id.toString(),
      ticketsAwarded: rp.ticketsAwarded ?? 0,
      tier: rp.tierAtAward ?? undefined,
      isQualifying: !rp.deletedAt,
    };
    if (isReferee) {
      events.push({
        id: eventId("referral_purchase_qualified", rp._id.toString()),
        type: "referral_purchase_qualified",
        timestamp: purchasedAt,
        title: "Qualifying order placed",
        description: `${toGbp(amount)} — assigned to ${rp.referrerEmail}`,
        meta: orderMeta,
        amount,
        iconKey: "ShoppingBag",
        tone: "info",
      });
    }
    if (isReferrer) {
      if (rp.ticketsAwardedAt && (rp.ticketsAwarded ?? 0) > 0) {
        events.push({
          id: eventId("tickets_awarded", `${rp._id.toString()}-${rp.ticketsAwardedAt!.toString()}`),
          type: "tickets_awarded",
          timestamp: new Date(rp.ticketsAwardedAt).toISOString(),
          title: `+${rp.ticketsAwarded ?? 0} tickets awarded`,
          description: `Reward for referring ${rp.referredEmail}`,
          ticketCount: rp.ticketsAwarded ?? 0,
          meta: orderMeta,
          iconKey: "Ticket",
          tone: "success",
        });
      }
      if (rp.tierReachedAt && !rp.deferredUntilNextWindow) {
        events.push({
          id: eventId("tier_reached", `${rp._id.toString()}-tier`),
          type: "tier_reached",
          timestamp: new Date(rp.tierReachedAt).toISOString(),
          title: `Tier ${rp.tierAtAward ?? "?"} reached`,
          description: `${rp.referredEmail} qualified`,
          meta: { ...orderMeta, tier: rp.tierAtAward ?? undefined },
          iconKey: "Trophy",
          tone: "success",
        });
      }
      events.push({
        id: eventId("referral_purchase_qualified", `${rp._id.toString()}-ref`),
        type: "referral_purchase_qualified",
        timestamp: purchasedAt,
        title: "Referee placed order",
        description: `${rp.referredEmail} — ${toGbp(amount)}`,
        meta: orderMeta,
        amount,
        iconKey: "UserPlus",
        tone: "neutral",
      });
    }
  }

  const balanceTransactions = await BalanceTransaction.find({ userId: oid })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  for (const bt of balanceTransactions) {
    const amount = Number(bt.amount) || 0;
    const isCredit = amount > 0;
    events.push({
      id: eventId(isCredit ? "wallet_credit" : "wallet_debit", bt._id.toString()),
      type: isCredit ? "wallet_credit" : "wallet_debit",
      timestamp: new Date(bt.createdAt as Date).toISOString(),
      title: `Wallet ${isCredit ? "credit" : "debit"} · ${bt.type}`,
      description: `${toGbp(amount)} · balance ${toGbp(Number(bt.balanceAfter) || 0)}`,
      meta: {
        walletType: bt.type as string,
        walletStatus: bt.status as string,
        balanceAfter: Number(bt.balanceAfter) || undefined,
        balanceBefore: Number(bt.balanceBefore) || undefined,
        orderId: bt.orderId?.toString(),
        paymentProviderTransactionId: bt.paymentProviderTransactionId as string | undefined,
        walletNote: bt.note as string | undefined,
        orderEmail: profile?.email as string | undefined,
      },
      amount,
      iconKey: isCredit ? "ArrowDownToLine" : "ArrowUpFromLine",
      tone: isCredit ? "success" : "neutral",
    });
  }

  const auditLogs = await ComplianceAuditLog.find({
    targetUserId: userId,
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  if (auditLogs.length > 0) {
    const actorIds = Array.from(
      new Set(
        auditLogs
          .map((l) => l.actorId)
          .filter((id): id is string => !!id && mongoose.Types.ObjectId.isValid(id))
      )
    );
    const actorProfiles = actorIds.length
      ? await Profile.find({ _id: { $in: actorIds } })
          .select({ email: 1, firstName: 1, lastName: 1 })
          .lean()
      : [];
    const actorMap = new Map<string, { email?: string; firstName?: string; lastName?: string }>();
    for (const a of actorProfiles) {
      actorMap.set(a._id.toString(), {
        email: a.email as string | undefined,
        firstName: a.firstName as string | undefined,
        lastName: a.lastName as string | undefined,
      });
    }
    for (const log of auditLogs) {
      const actor = log.actorId ? actorMap.get(log.actorId) : undefined;
      const actorLabel = actor
        ? `${actor.firstName ?? ""} ${actor.lastName ?? ""}`.trim() || actor.email || log.actorId
        : (log.actorId ?? "system");
      events.push({
        id: eventId("compliance_override", log._id.toString()),
        type: "compliance_override",
        timestamp: new Date(log.createdAt as Date).toISOString(),
        title: `Compliance · ${log.action}`,
        description: `${actorLabel} · ${log.reason}`,
        meta: {
          actorId: log.actorId ?? undefined,
          actorEmail: actor?.email,
          source: log.source,
          action: log.action,
          orderEmail: profile?.email as string | undefined,
        },
        iconKey: "Shield",
        tone: "warning",
      });
    }
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events.slice(0, limit);
}
