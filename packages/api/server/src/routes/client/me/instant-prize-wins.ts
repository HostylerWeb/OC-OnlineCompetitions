import { InstantPrizeWin } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { isPaginationRequested, parsePagination } from "@oc/api-infra/pagination";
import { error, paginated, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { auth } from "@oc/api-server/middleware/auth";
import { Hono } from "hono";
import mongoose from "mongoose";
import { fetchAndMapWins } from "./instant-prize-wins.mapper";

const app = new Hono();

app.use("*", auth);

export const DEFAULT_INSTANT_WIN_LIMIT = 50;
export const MAX_INSTANT_WIN_IDS = 100;

export function parseInstantPrizeWinIds(
  idsParam: string | undefined
): { ok: true; ids: string[] } | { ok: false; message: string } {
  if (idsParam === undefined) {
    return { ok: true, ids: [] };
  }

  const ids = idsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const uniqueIds = [...new Set(ids)];

  if (uniqueIds.length === 0) {
    return { ok: false, message: "ids query parameter is required" };
  }

  if (uniqueIds.length > MAX_INSTANT_WIN_IDS) {
    return {
      ok: false,
      message: `ids query parameter accepts up to ${MAX_INSTANT_WIN_IDS} ids`,
    };
  }

  return { ok: true, ids: uniqueIds };
}

app.get("/", async (c) => {
  try {
    const userId = c.get("userId")!;
    await dbConnect();

    const userOid = new mongoose.Types.ObjectId(userId);
    const idsResult = parseInstantPrizeWinIds(c.req.query("ids"));

    if (!idsResult.ok) {
      return error(c, ErrorCodes.VALIDATION_ERROR, idsResult.message, 400);
    }

    if (idsResult.ids.length > 0) {
      const objectIds = idsResult.ids
        .filter((id) => mongoose.Types.ObjectId.isValid(id) && id.length === 24)
        .map((id) => new mongoose.Types.ObjectId(id));

      const wins = await fetchAndMapWins({
        userId: userOid,
        _id: { $in: objectIds },
      });

      return success(c, wins);
    }

    const baseFilter = { userId: userOid };

    if (!isPaginationRequested(c)) {
      const wins = await fetchAndMapWins(baseFilter, {
        skip: 0,
        limit: DEFAULT_INSTANT_WIN_LIMIT,
      });
      return success(c, wins);
    }

    const { limit, page, skip } = parsePagination(c);

    const [wins, total] = await Promise.all([
      fetchAndMapWins(baseFilter, { skip, limit }),
      InstantPrizeWin.countDocuments(baseFilter).maxTimeMS(5000),
    ]);

    return paginated(c, wins, total, page, limit);
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "me.instantPrizeWins.list",
    });
    console.error("Error fetching instant prize wins:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
