import { InstantPrizeWin, Order, OrderItem, Ticket } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { parsePagination } from "@oc/api-infra/pagination";
import { error, paginated, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { createLogger } from "@oc/api-logger";
import { auth } from "@oc/api-server/middleware/auth";
import {
  flattenCompetitionInstantPrize,
  normalizeGrantedEntryIds,
} from "@oc/api-tickets/instant-prize-win-mapper";
import { type TicketLike, ticketsToEntryDtos } from "@oc/api-tickets/ticket-mapper";
import { resolveOrderReadScope } from "@oc/api-server/lib/payment/guest-order-owners";
import { Hono } from "hono";
import mongoose from "mongoose";

const app = new Hono();

app.use("*", auth);

type UnknownRecord = Record<string, unknown>;

function resolveCompetitionImageUrl(competition: UnknownRecord): string | undefined {
  const prize =
    typeof competition.prizeImageUrl === "string" ? competition.prizeImageUrl.trim() : "";
  if (prize) return prize;
  const image = typeof competition.imageUrl === "string" ? competition.imageUrl.trim() : "";
  return image || undefined;
}

export function mapOrderItem(item: UnknownRecord) {
  const competition = item.competitionId as UnknownRecord | string | undefined;
  const competitionId =
    typeof competition === "object" && competition !== null
      ? {
          _id:
            (competition._id as { toString: () => string } | undefined)?.toString?.() ??
            String(competition._id ?? ""),
          title: typeof competition.title === "string" ? competition.title : undefined,
          prizeImageUrl: resolveCompetitionImageUrl(competition),
          slug: typeof competition.slug === "string" ? competition.slug : undefined,
        }
      : String(competition ?? "");

  return {
    ...item,
    competitionId,
  };
}

app.get("/", async (c) => {
  try {
    const { limit, page, skip } = parsePagination(c);
    const userId = c.get("userId")!;
    log.debug(
      `[me.orders.list] ENTER: userId=${userId} queryParams: limit=${limit} page=${page} skip=${skip}`
    );
    await dbConnect();

    const userIdQuery = { userId: new mongoose.Types.ObjectId(userId) };

    const [orders, total] = await Promise.all([
      Order.find(userIdQuery).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(userIdQuery).maxTimeMS(5000),
    ]);

    log.debug(`[me.orders.list] ordersCount=${orders.length} total=${total}`);

    const orderIds = orders.map((o) => o._id);
    const orderItems = await OrderItem.find({ orderId: { $in: orderIds } })
      .populate<{ competitionId: { title: string; prizeImageUrl?: string; imageUrl?: string } }>(
        "competitionId",
        "title prizeImageUrl imageUrl slug"
      )
      .lean();

    const itemsByOrderId: Record<string, unknown[]> = {};
    for (const item of orderItems) {
      const key = String(item.orderId);
      if (!itemsByOrderId[key]) itemsByOrderId[key] = [];
      itemsByOrderId[key].push(mapOrderItem(item as unknown as UnknownRecord));
    }

    const ordersWithItems = orders.map((o) => ({
      ...o,
      items: itemsByOrderId[o._id.toString()] || [],
    }));

    for (const o of ordersWithItems) {
      const totalQty = (o.items as Array<{ quantity?: number }>).reduce(
        (s, i) => s + (i.quantity ?? 0),
        0
      );
      log.debug(
        `[me.orders.list] orderId=${o._id} status=${o.status} itemsCount=${o.items.length} totalQuantity=${totalQty}`
      );
    }
    log.debug(`[me.orders.list] EXIT: returning ${ordersWithItems.length} orders`);

    return paginated(c, ordersWithItems, total, page, limit);
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "me.orders.list",
    });
    console.error("Error fetching orders:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const userId = c.get("userId")!;
    const user = c.get("user");
    log.debug(`[me.orders.get] ENTER: orderId=${id} userId=${userId}`);
    await dbConnect();

    const orderQuery: Record<string, unknown> = {
      _id: new mongoose.Types.ObjectId(id),
    };
    if (user?.isAnonymous) {
      // Guest checkout orders may be owned by a profile the checkout email
      // belongs to (email-based inheritance between guests and authed users).
      const scope = await resolveOrderReadScope(userId);
      log.debug(
        `[me.orders.get] anonymous owner scope userIds=${scope.userIds.length} emails=${scope.emails.length}`
      );
      orderQuery.$or = [
        { userId: { $in: scope.userIds } },
        { orderEmail: { $in: scope.emails } },
      ];
    } else {
      orderQuery.userId = new mongoose.Types.ObjectId(userId);
    }

    const order = await Order.findOne(orderQuery).lean();

    if (!order) {
      log.debug(`[me.orders.get] orderId=${id} NOT FOUND`);
      return error(c, ErrorCodes.NOT_FOUND, "Order not found", 404);
    }

    const totalQty =
      (order as unknown as { totalQuantity?: number }).totalQuantity ??
      (order as unknown as Record<string, unknown>).totalQuantity;
    log.debug(
      `[me.orders.get] orderId=${id} status=${order.status} totalQuantity=${totalQty} itemCount=${0}`
    );

    const orderItems = await OrderItem.find({ orderId: order._id })
      .populate<{ competitionId: { title: string; prizeImageUrl?: string; imageUrl?: string; slug?: string } }>(
        "competitionId",
        "title prizeImageUrl imageUrl slug"
      )
      .lean();

    log.debug(`[me.orders.get] orderId=${id} itemsCount=${orderItems.length}`);

    const tickets = await Ticket.find({ orderId: order._id, status: "sold" })
      .sort({ number: 1 })
      .lean();
    const ticketNumbersPresent = tickets.length > 0;
    log.debug(
      `[me.orders.get] orderId=${id} ticketNumbersPresent=${ticketNumbersPresent} ticketsCount=${tickets.length}`
    );

    log.info("[me.orders.get] returning order metadata shape", {
      orderId: id,
      status: order.status,
      hasMetadata: !!order.metadata,
      metadataKeys: Object.keys((order.metadata ?? {}) as Record<string, unknown>),
      hasFulfillmentFailedAfterCapture:
        (order.metadata as { fulfillmentFailedAfterCapture?: boolean } | undefined)
          ?.fulfillmentFailedAfterCapture ?? false,
      fulfillmentErrorMessage:
        (order.metadata as { fulfillmentError?: { message?: string } } | undefined)
          ?.fulfillmentError?.message ?? null,
      paytriotErrorCategory:
        (order.metadata as { paytriotErrorCategory?: string } | undefined)?.paytriotErrorCategory ??
        null,
      paytriotState:
        (order.metadata as { paytriotState?: string } | undefined)?.paytriotState ?? null,
    });

    if (tickets.length > 0) {
      const firstTicket = tickets[0]!;
      const firstItemSample = orderItems[0];
      log.debug(
        `[me.orders.get] orderId=${id} firstTicket.number=${firstTicket.number} firstItem.ticketNumbers=${JSON.stringify(firstItemSample?.ticketNumbers ?? "none")}`
      );
    }

    const entries = ticketsToEntryDtos(tickets as unknown as TicketLike[]);

    const ticketIds = tickets.map((t) => t._id);
    const instantPrizeWins = await InstantPrizeWin.find({
      entryId: { $in: ticketIds },
    })
      .populate({
        path: "competitionInstantPrizeId",
        select: "competitionId instantPrizeId",
        populate: {
          path: "instantPrizeId",
          select: "title description images value type linkedCompetitionId ticketCount",
          populate: {
            path: "linkedCompetitionId",
            select: "slug",
          },
        },
      })
      .lean();

    const instantWinsByEntryId: Record<string, unknown[]> = {};
    for (const win of instantPrizeWins) {
      const key = win.entryId.toString();
      if (!instantWinsByEntryId[key]) instantWinsByEntryId[key] = [];
      const grantedEntryIds = normalizeGrantedEntryIds(
        win.grantedTicketIds ?? win.grantedEntryIds ?? []
      );
      const mappedWin = {
        ...win,
        competitionInstantPrizeId: flattenCompetitionInstantPrize(win.competitionInstantPrizeId),
        grantedTicketIds: grantedEntryIds,
        grantedEntryIds,
      };
      instantWinsByEntryId[key].push(mappedWin);
    }

    const entriesWithWins = entries.map((e) => ({
      ...e,
      instantPrizeWins: instantWinsByEntryId[e._id] || [],
    }));

    const ticketNumbersByCompetitionId = new Map<string, number[]>();
    for (const ticket of tickets) {
      const compKey = ticket.competitionId.toString();
      const list = ticketNumbersByCompetitionId.get(compKey) ?? [];
      list.push(ticket.number);
      ticketNumbersByCompetitionId.set(compKey, list);
    }
    for (const list of ticketNumbersByCompetitionId.values()) {
      list.sort((a, b) => a - b);
    }

    const itemsWithTickets = orderItems.map((item) => {
      const mapped = mapOrderItem(item as unknown as UnknownRecord) as UnknownRecord;
      const compRef = mapped.competitionId;
      const compKey =
        typeof compRef === "object" && compRef !== null && "_id" in compRef
          ? String((compRef as { _id: string })._id)
          : String(compRef ?? "");
      const fromDb = Array.isArray(item.ticketNumbers) ? item.ticketNumbers : [];
      const fromTickets = ticketNumbersByCompetitionId.get(compKey) ?? [];
      const ticketNumbers = fromDb.length > 0 ? fromDb : fromTickets;
      return { ...mapped, ticketNumbers };
    });

    log.debug(`[me.orders.get] EXIT: orderId=${id} entriesCount=${entriesWithWins.length}`);
    return success(c, {
      ...order,
      items: itemsWithTickets,
      entries: entriesWithWins,
    });
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "me.orders.getOne",
    });
    console.error("Error fetching order:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;

const log = createLogger("orders");
