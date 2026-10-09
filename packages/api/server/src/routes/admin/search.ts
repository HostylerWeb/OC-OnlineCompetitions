import {
  BalanceTransaction,
  Category,
  Competition,
  InstantPrize,
  InstantPrizeWin,
  Order,
  Profile,
  PromoCode,
  ReferralPurchase,
  Ticket,
  Winner,
} from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { escapeRegex, prefixRegex, substringRegex } from "@oc/api-infra/fuzzy-search";
import { defaultAggregateOptions } from "@oc/api-infra/mongo-query-options";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { requireManager } from "@oc/api-server/middleware/auth";
import { formatOrderNumber } from "@oc/utils";
import { Hono } from "hono";
import type { PipelineStage } from "mongoose";

const app = new Hono();

app.use("*", requireManager);

const VALID_TYPES = [
  "competitions",
  "orders",
  "users",
  "promo_codes",
  "categories",
  "winners",
  "instant_prize_wins",
  "instant_prizes",
  "referral_purchases",
  "tickets",
  "balance_transactions",
] as const;
type SearchType = (typeof VALID_TYPES)[number];

const LIMIT_PER_TYPE = 5;
const SEARCH_AGGREGATE_OPTIONS = defaultAggregateOptions(5000);

interface SearchResultItem {
  id: string;
  label: string;
  description: string;
  url: string;
  type: SearchType;
  detailUrl?: string;
  badge?: string;
}

interface SearchResultGroup {
  type: SearchType;
  label: string;
  searchUrl: string;
  items: SearchResultItem[];
}

app.get("/", async (c) => {
  try {
    const q = (c.req.query("q") ?? "").trim();
    const typeParam = c.req.query("type");
    const types: SearchType[] = typeParam
      ? ([typeParam] as SearchType[]).filter((t): t is SearchType =>
          VALID_TYPES.includes(t as SearchType)
        )
      : [...VALID_TYPES];
    const includeTypes = new Set(types);

    if (!q || q.length < 2 || q.length > 100) {
      return success(c, { results: [] });
    }

    await dbConnect();

    const safe = escapeRegex(q);
    const results: SearchResultGroup[] = [];

    const searchPromises: Promise<void>[] = [];

    if (includeTypes.has("competitions")) {
      searchPromises.push(
        (async () => {
          try {
            const compPrice = Number.parseFloat(q);
            const compMatch: Record<string, unknown>[] = [
              { title: { $regex: safe, $options: "i" } },
              { slug: { $regex: safe, $options: "i" } },
              { shortDescription: { $regex: safe, $options: "i" } },
            ];
            if (!Number.isNaN(compPrice)) {
              compMatch.push({ prizeValue: compPrice });
            }

            const competitions = await Competition.find({ $or: compMatch })
              .select("_id title slug status prizeValue")
              .sort({ createdAt: -1 })
              .limit(LIMIT_PER_TYPE)
              .lean();

            results.push({
              type: "competitions",
              label: "Competitions",
              searchUrl: `/competitions?search=${encodeURIComponent(q)}`,
              items: competitions.map((c) => ({
                id: c._id.toString(),
                label: c.title,
                description: `${c.status} — £${Number(c.prizeValue).toFixed(2)}`,
                url: `/competitions?search=${encodeURIComponent(c.title)}`,
                type: "competitions" as const,
                detailUrl: `/competitions/${c._id.toString()}`,
                badge: c.status,
              })),
            });
          } catch {
            // Individual collection failure shouldn't fail the whole search
          }
        })()
      );
    }

    if (includeTypes.has("users")) {
      searchPromises.push(
        (async () => {
          try {
            const users = await Profile.find({
              $or: [
                { email: { $regex: safe, $options: "i" } },
                { firstName: { $regex: safe, $options: "i" } },
                { lastName: { $regex: safe, $options: "i" } },
              ],
            })
              .select("_id email firstName lastName")
              .sort({ createdAt: -1 })
              .limit(LIMIT_PER_TYPE)
              .lean();

            results.push({
              type: "users",
              label: "Users",
              searchUrl: `/users?search=${encodeURIComponent(q)}`,
              items: users.map((u) => ({
                id: u._id.toString(),
                label: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email,
                description: u.email,
                url: `/users?search=${encodeURIComponent(u.email)}`,
                type: "users" as const,
                detailUrl: `/users/${u._id.toString()}`,
              })),
            });
          } catch {
            //
          }
        })()
      );
    }

    if (includeTypes.has("orders")) {
      searchPromises.push(
        (async () => {
          try {
            const numQuery = q.replace(/^#/, "").trim();
            const orderNum = Number.parseInt(numQuery, 10);

            const pipeline: PipelineStage[] = [
              { $match: { deletedAt: null } },
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
                  orderNumberStr: { $toString: "$orderNumber" },
                  totalValueStr: { $toString: "$total" },
                  userEmail: { $ifNull: ["$_profile.email", ""] },
                },
              },
              {
                $match: {
                  $or: [
                    ...(Number.isNaN(orderNum) ? [] : [{ orderNumber: orderNum }]),
                    { orderNumberStr: { $regex: substringRegex(q), $options: "i" } },
                    { totalValueStr: { $regex: substringRegex(q), $options: "i" } },
                    { userEmail: { $regex: substringRegex(q), $options: "i" } },
                  ],
                },
              },
              { $sort: { createdAt: -1 } },
              { $limit: LIMIT_PER_TYPE },
              {
                $project: {
                  _id: 1,
                  orderNumber: 1,
                  status: 1,
                  total: 1,
                  userEmail: 1,
                },
              },
            ];

            const orders = await Order.aggregate(pipeline).option(SEARCH_AGGREGATE_OPTIONS).exec();

            results.push({
              type: "orders",
              label: "Orders",
              searchUrl: `/orders?search=${encodeURIComponent(q)}`,
              items: orders.map((o) => ({
                id: o._id.toString(),
                label: formatOrderNumber(o.orderNumber),
                description: `${o.status} — ${o.userEmail || "N/A"} — £${Number.parseFloat(o.total).toFixed(2)}`,
                url: `/orders?search=${encodeURIComponent(String(o.orderNumber))}`,
                type: "orders" as const,
                detailUrl: `/orders/${o._id.toString()}`,
                badge: o.status,
              })),
            });
          } catch {
            //
          }
        })()
      );
    }

    if (includeTypes.has("promo_codes")) {
      searchPromises.push(
        (async () => {
          try {
            const promoVal = Number.parseFloat(q);
            const promoMatch: Record<string, unknown>[] = [
              { code: { $regex: safe, $options: "i" } },
            ];
            if (!Number.isNaN(promoVal)) {
              promoMatch.push({ discountValue: promoVal });
            }

            const codes = await PromoCode.find({ $or: promoMatch })
              .select("_id code discountType discountValue isActive")
              .sort({ createdAt: -1 })
              .limit(LIMIT_PER_TYPE)
              .lean();

            results.push({
              type: "promo_codes",
              label: "Promo Codes",
              searchUrl: `/promo-codes?search=${encodeURIComponent(q)}`,
              items: codes.map((p) => ({
                id: p._id.toString(),
                label: p.code,
                description: `${p.discountType} — ${Number(p.discountValue).toFixed(2)}${p.discountType === "percentage" ? "%" : "£"}${p.isActive ? "" : " (inactive)"}`,
                url: `/promo-codes?search=${encodeURIComponent(p.code)}`,
                type: "promo_codes" as const,
                detailUrl: `/promo-codes/${p._id.toString()}`,
                badge: p.isActive ? "active" : "inactive",
              })),
            });
          } catch {
            //
          }
        })()
      );
    }

    if (includeTypes.has("categories")) {
      searchPromises.push(
        (async () => {
          try {
            const cats = await Category.find({
              $or: [
                { name: { $regex: safe, $options: "i" } },
                { label: { $regex: safe, $options: "i" } },
              ],
            })
              .select("_id name label slug")
              .sort({ displayOrder: 1 })
              .limit(LIMIT_PER_TYPE)
              .lean();

            results.push({
              type: "categories",
              label: "Categories",
              searchUrl: `/categories?search=${encodeURIComponent(q)}`,
              items: cats.map((cat) => ({
                id: cat._id.toString(),
                label: cat.label,
                description: cat.slug,
                url: `/categories?search=${encodeURIComponent(cat.name)}`,
                type: "categories" as const,
                detailUrl: `/categories/${cat._id.toString()}`,
              })),
            });
          } catch {
            //
          }
        })()
      );
    }

    if (includeTypes.has("winners")) {
      searchPromises.push(
        (async () => {
          try {
            const ticketNum = Number.parseInt(q, 10);
            const pipeline: PipelineStage[] = [
              { $match: { deletedAt: null } },
              {
                $lookup: {
                  from: "competitions",
                  localField: "competitionId",
                  foreignField: "_id",
                  as: "_comp",
                },
              },
              { $unwind: { path: "$_comp", preserveNullAndEmptyArrays: true } },
              {
                $lookup: {
                  from: "profiles",
                  localField: "userId",
                  foreignField: "_id",
                  as: "_profile",
                },
              },
              { $unwind: { path: "$_profile", preserveNullAndEmptyArrays: true } },
              {
                $addFields: {
                  ticketNumberStr: { $toString: "$ticketNumber" },
                  competitionTitle: { $ifNull: ["$_comp.title", ""] },
                  email: { $ifNull: ["$_profile.email", ""] },
                  firstName: { $ifNull: ["$_profile.firstName", ""] },
                  lastName: { $ifNull: ["$_profile.lastName", ""] },
                },
              },
              {
                $match: {
                  $or: [
                    { displayName: { $regex: safe, $options: "i" } },
                    { prizeTitle: { $regex: safe, $options: "i" } },
                    { ticketNumberStr: { $regex: substringRegex(q), $options: "i" } },
                    ...(Number.isNaN(ticketNum) ? [] : [{ ticketNumber: ticketNum }]),
                  ],
                },
              },
              { $sort: { drawnAt: -1 } },
              { $limit: LIMIT_PER_TYPE },
              {
                $project: {
                  _id: 1,
                  displayName: 1,
                  prizeTitle: 1,
                  prizeValue: 1,
                  ticketNumber: 1,
                  claimed: 1,
                  drawnAt: 1,
                  competitionTitle: 1,
                  email: 1,
                  firstName: 1,
                  lastName: 1,
                },
              },
            ];

            const winners = await Winner.aggregate(pipeline).option(SEARCH_AGGREGATE_OPTIONS).exec();

            results.push({
              type: "winners",
              label: "Winners",
              searchUrl: `/winners?search=${encodeURIComponent(q)}`,
              items: winners.map((w) => ({
                id: w._id.toString(),
                label:
                  w.displayName ||
                  [w.firstName, w.lastName].filter(Boolean).join(" ") ||
                  w.email ||
                  "Winner",
                description: `${w.competitionTitle} — #${w.ticketNumber}${w.prizeValue ? ` — £${Number(w.prizeValue).toFixed(2)}` : ""}`,
                url: `/winners?search=${encodeURIComponent(String(w.ticketNumber))}`,
                type: "winners" as const,
                detailUrl: `/winners/${w._id.toString()}`,
                badge: w.claimed ? "Claimed" : "Unclaimed",
              })),
            });
          } catch {
            //
          }
        })()
      );
    }

    if (includeTypes.has("instant_prize_wins")) {
      searchPromises.push(
        (async () => {
          try {
            const ticketNum = Number.parseInt(q, 10);
            const pipeline: PipelineStage[] = [
              { $match: { deletedAt: null } },
              {
                $lookup: {
                  from: "competitioninstantprizes",
                  localField: "competitionInstantPrizeId",
                  foreignField: "_id",
                  as: "_cip",
                },
              },
              { $unwind: { path: "$_cip", preserveNullAndEmptyArrays: true } },
              {
                $lookup: {
                  from: "instantprizes",
                  localField: "_cip.instantPrizeId",
                  foreignField: "_id",
                  as: "_prize",
                },
              },
              { $unwind: { path: "$_prize", preserveNullAndEmptyArrays: true } },
              {
                $lookup: {
                  from: "profiles",
                  localField: "userId",
                  foreignField: "_id",
                  as: "_profile",
                },
              },
              { $unwind: { path: "$_profile", preserveNullAndEmptyArrays: true } },
              {
                $lookup: {
                  from: "competitions",
                  localField: "_cip.competitionId",
                  foreignField: "_id",
                  as: "_comp",
                },
              },
              { $unwind: { path: "$_comp", preserveNullAndEmptyArrays: true } },
              {
                $addFields: {
                  ticketNumberStr: { $toString: "$ticketNumber" },
                  prizeTitle: { $ifNull: ["$_prize.title", ""] },
                  prizeValue: { $ifNull: ["$_prize.value", 0] },
                  prizeType: { $ifNull: ["$_prize.type", "prize"] },
                  competitionTitle: { $ifNull: ["$_comp.title", ""] },
                  userEmail: { $ifNull: ["$_profile.email", ""] },
                },
              },
              {
                $match: {
                  $or: [
                    { userEmail: { $regex: safe, $options: "i" } },
                    { prizeTitle: { $regex: safe, $options: "i" } },
                    { ticketNumberStr: { $regex: substringRegex(q), $options: "i" } },
                    ...(Number.isNaN(ticketNum) ? [] : [{ ticketNumber: ticketNum }]),
                  ],
                },
              },
              { $sort: { wonAt: -1 } },
              { $limit: LIMIT_PER_TYPE },
              {
                $project: {
                  _id: 1,
                  ticketNumber: 1,
                  claimed: 1,
                  wonAt: 1,
                  prizeTitle: 1,
                  prizeValue: 1,
                  prizeType: 1,
                  competitionTitle: 1,
                  userEmail: 1,
                },
              },
            ];

            const wins = await InstantPrizeWin.aggregate(pipeline).option(SEARCH_AGGREGATE_OPTIONS).exec();

            results.push({
              type: "instant_prize_wins",
              label: "Instant Prize Wins",
              searchUrl: `/instant-prize-wins?search=${encodeURIComponent(q)}`,
              items: wins.map((w) => ({
                id: w._id.toString(),
                label: w.prizeTitle || w.userEmail,
                description: `${w.competitionTitle} — #${w.ticketNumber} — ${w.claimed ? "Claimed" : "Unclaimed"}`,
                url: `/instant-prize-wins?search=${encodeURIComponent(String(w.ticketNumber))}`,
                type: "instant_prize_wins" as const,
                detailUrl: `/instant-prize-wins/${w._id.toString()}`,
                badge: w.prizeType === "competition_ticket" ? "Free ticket" : "Prize",
              })),
            });
          } catch {
            //
          }
        })()
      );
    }

    if (includeTypes.has("instant_prizes")) {
      searchPromises.push(
        (async () => {
          try {
            const val = Number.parseFloat(q);
            const match: Record<string, unknown>[] = [{ title: { $regex: safe, $options: "i" } }];
            if (!Number.isNaN(val)) {
              match.push({ value: val });
            }

            const prizes = await InstantPrize.find({ $or: match })
              .select("_id title description value type isActive")
              .sort({ createdAt: -1 })
              .limit(LIMIT_PER_TYPE)
              .lean();

            results.push({
              type: "instant_prizes",
              label: "Instant Prizes",
              searchUrl: `/instant-prizes?search=${encodeURIComponent(q)}`,
              items: prizes.map((p) => ({
                id: p._id.toString(),
                label: p.title,
                description: `${p.type === "competition_ticket" ? "Free ticket" : "Prize"} — ${p.value != null ? `£${Number(p.value).toFixed(2)}` : "No value"}`,
                url: `/instant-prizes?search=${encodeURIComponent(p.title)}`,
                type: "instant_prizes" as const,
                detailUrl: `/instant-prizes/${p._id.toString()}`,
                badge: p.isActive ? "Active" : "Inactive",
              })),
            });
          } catch {
            //
          }
        })()
      );
    }

    if (includeTypes.has("referral_purchases")) {
      searchPromises.push(
        (async () => {
          try {
            const refPurchases = await ReferralPurchase.find({
              deletedAt: null,
              $or: [
                { referrerEmail: { $regex: prefixRegex(q), $options: "i" } },
                { referredEmail: { $regex: prefixRegex(q), $options: "i" } },
                { referrerEmail: { $regex: safe, $options: "i" } },
                { referredEmail: { $regex: safe, $options: "i" } },
              ],
            })
              .select("_id referrerEmail referredEmail commissionAmount ticketsAwarded purchasedAt")
              .sort({ purchasedAt: -1 })
              .limit(LIMIT_PER_TYPE)
              .lean();

            results.push({
              type: "referral_purchases",
              label: "Referral Purchases",
              searchUrl: `/referrals?search=${encodeURIComponent(q)}`,
              items: refPurchases.map((r) => ({
                id: r._id.toString(),
                label: `${r.referrerEmail} → ${r.referredEmail}`,
                description: `£${Number(r.commissionAmount).toFixed(2)} commission — ${r.ticketsAwarded} tickets awarded`,
                url: `/referrals?search=${encodeURIComponent(r.referrerEmail)}`,
                type: "referral_purchases" as const,
                detailUrl: `/referrals?search=${encodeURIComponent(r.referrerEmail)}`,
              })),
            });
          } catch {
            //
          }
        })()
      );
    }

    if (includeTypes.has("tickets")) {
      searchPromises.push(
        (async () => {
          try {
            const ticketNum = Number.parseInt(q, 10);
            if (Number.isNaN(ticketNum)) {
              return;
            }

            const pipeline: PipelineStage[] = [
              { $match: { number: ticketNum } },
              {
                $lookup: {
                  from: "competitions",
                  localField: "competitionId",
                  foreignField: "_id",
                  as: "_comp",
                },
              },
              { $unwind: { path: "$_comp", preserveNullAndEmptyArrays: true } },
              {
                $lookup: {
                  from: "profiles",
                  localField: "ownerId",
                  foreignField: "_id",
                  as: "_owner",
                },
              },
              { $unwind: { path: "$_owner", preserveNullAndEmptyArrays: true } },
              {
                $addFields: {
                  competitionTitle: { $ifNull: ["$_comp.title", ""] },
                  ownerEmail: { $ifNull: ["$_owner.email", ""] },
                },
              },
              { $sort: { soldAt: -1 } },
              { $limit: LIMIT_PER_TYPE },
              {
                $project: {
                  _id: 1,
                  number: 1,
                  status: 1,
                  competitionId: 1,
                  competitionTitle: 1,
                  ownerEmail: 1,
                },
              },
            ];

            const tickets = await Ticket.aggregate(pipeline).option(SEARCH_AGGREGATE_OPTIONS);

            results.push({
              type: "tickets",
              label: "Tickets",
              searchUrl: `/competitions?search=${encodeURIComponent(q)}`,
              items: tickets.map((t) => ({
                id: t._id.toString(),
                label: `#${t.number}`,
                description: `${t.competitionTitle} — ${t.ownerEmail || "Available"}`,
                url: `/competitions?search=${encodeURIComponent(t.competitionTitle)}`,
                type: "tickets" as const,
                detailUrl: `/competitions/${t.competitionId?.toString?.() ?? t.competitionId}`,
                badge: t.status,
              })),
            });
          } catch {
            //
          }
        })()
      );
    }

    if (includeTypes.has("balance_transactions")) {
      searchPromises.push(
        (async () => {
          try {
            const amount = Number.parseFloat(q);
            const pipeline: PipelineStage[] = [
              {
                $lookup: {
                  from: "profiles",
                  localField: "userId",
                  foreignField: "_id",
                  as: "_profile",
                },
              },
              { $unwind: { path: "$_profile", preserveNullAndEmptyArrays: true } },
              {
                $addFields: {
                  userEmail: { $ifNull: ["$_profile.email", ""] },
                  amountStr: { $toString: "$amount" },
                },
              },
              {
                $match: {
                  $or: [
                    { type: { $regex: safe, $options: "i" } },
                    ...(!Number.isNaN(amount) ? [{ amount }] : []),
                    { userEmail: { $regex: safe, $options: "i" } },
                    { amountStr: { $regex: substringRegex(q), $options: "i" } },
                  ],
                },
              },
              { $sort: { createdAt: -1 } },
              { $limit: LIMIT_PER_TYPE },
              {
                $project: {
                  _id: 1,
                  userId: 1,
                  type: 1,
                  amount: 1,
                  status: 1,
                  balanceBefore: 1,
                  balanceAfter: 1,
                  userEmail: 1,
                  createdAt: 1,
                },
              },
            ];

            const txns = await BalanceTransaction.aggregate(pipeline).option(
              SEARCH_AGGREGATE_OPTIONS
            );

            results.push({
              type: "balance_transactions",
              label: "Transactions",
              searchUrl: `/users?search=${encodeURIComponent(q)}`,
              items: txns.map((t) => ({
                id: t._id.toString(),
                label: `${t.type} — £${Number(t.amount).toFixed(2)}`,
                description: `${t.userEmail || "Unknown"} — £${Number(t.balanceBefore).toFixed(2)} → £${Number(t.balanceAfter).toFixed(2)}`,
                url: `/users?search=${encodeURIComponent(t.userEmail)}`,
                type: "balance_transactions" as const,
                detailUrl: `/users/${t.userId?.toString?.() ?? t.userId}`,
                badge: t.status,
              })),
            });
          } catch {
            //
          }
        })()
      );
    }

    await Promise.all(searchPromises);

    return success(c, { results: results.filter((g) => g.items.length > 0) });
  } catch (err: unknown) {
    console.error("Error in admin search:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.search",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
