import { Competition, DrawSheet, SheetAccessSettings, Ticket } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { requireAdmin } from "@oc/api-server/middleware/auth";
import { getDisplayName } from "@oc/utils";
import { Hono } from "hono";
import { Types } from "mongoose";

const app = new Hono();
app.use("*", requireAdmin);

interface GoogleTokenResult {
  accessToken: string;
  refreshToken?: string;
}

async function getGoogleTokenResult(c: any): Promise<GoogleTokenResult | null> {
  const auth = c.get("authInstance");
  const headers = c.req.raw.headers;
  if (!auth) return null;
  try {
    const refreshed = await auth.api
      .refreshToken({ body: { providerId: "google" }, headers })
      .catch(() => null);
    if (refreshed?.accessToken) {
      return { accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken };
    }
    const stored = await auth.api.getAccessToken({ body: { providerId: "google" }, headers });
    if (!stored?.accessToken) return null;
    return { accessToken: stored.accessToken, refreshToken: stored.refreshToken };
  } catch {
    return null;
  }
}

function isGoogleAuthError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; code?: number; response?: { status?: number } };
  return e.status === 401 || e.code === 401 || e.response?.status === 401;
}

async function buildSheetResponse(
  sheetId: string,
  sheetUrl: string,
  accessToken: string,
  refreshToken: string | undefined,
  dbEntryCount: number
) {
  const { getSheetRowCount } = await import("../../lib/google/sheets");
  let sheetRowCount = 0;
  try {
    sheetRowCount = await getSheetRowCount(sheetId, { accessToken, refreshToken });
  } catch {
    // sheet row count is best-effort
  }
  const dataRowCount = sheetRowCount;
  const diff = dbEntryCount - dataRowCount;
  return {
    sheetUrl,
    sheetId,
    dbEntryCount,
    sheetRowCount,
    dataRowCount,
    diff,
    inSync: diff === 0,
    lastSyncedAt: new Date().toISOString(),
  };
}

app.post("/create-sheet", async (c) => {
  try {
    const tokens = await getGoogleTokenResult(c);
    if (!tokens) {
      return success(c, { needsReauth: true });
    }

    await dbConnect();
    const { competitionId } = await c.req.json();
    if (!competitionId) return error(c, ErrorCodes.VALIDATION_ERROR, "competitionId required", 400);

    const competition = await Competition.findById(competitionId).lean();
    if (!competition) return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);

    const tickets = await Ticket.find({
      competitionId: new Types.ObjectId(competitionId),
      status: "sold",
    })
      .sort({ number: 1 })
      .populate<{ ownerId: { firstName?: string; lastName?: string; email: string } }>(
        "ownerId",
        "firstName lastName email"
      )
      .lean();

    const entries = tickets
      .filter((t) => t.ownerId)
      .map((t) => ({
        entryNumber: t.number,
        fullName: getDisplayName(
          {
            firstName: (t.ownerId as { firstName?: string }).firstName,
            lastName: (t.ownerId as { lastName?: string }).lastName,
          },
          (t.ownerId as { email: string }).email
        ),
      }));

    const { createDrawSheet, refreshSheetEntries, reconcileSheetEditors } = await import(
      "../../lib/google/sheets"
    );

    const existing = await DrawSheet.findOne({ competitionId: new Types.ObjectId(competitionId) });

    let sheetId: string;
    let sheetUrl: string;

    if (existing) {
      sheetId = existing.sheetId;
      sheetUrl = existing.sheetUrl;
      await refreshSheetEntries(sheetId, entries, tokens);
    } else {
      const result = await createDrawSheet(competition.title, entries, tokens);
      sheetId = result.sheetId;
      sheetUrl = result.sheetUrl;
      await DrawSheet.create({
        competitionId: new Types.ObjectId(competitionId),
        sheetId,
        sheetUrl,
      });
    }

    await DrawSheet.findOneAndUpdate(
      { competitionId: new Types.ObjectId(competitionId) },
      { lastSyncedAt: new Date() }
    );

    const settings = await SheetAccessSettings.findOne().lean();
    const whitelistedEmails = settings?.whitelistedEmails ?? [];
    if (whitelistedEmails.length > 0) {
      await reconcileSheetEditors(sheetId, whitelistedEmails, tokens);
    }

    const dbEntryCount = tickets.filter((t) => t.ownerId).length;
    const sheetResponse = await buildSheetResponse(
      sheetId,
      sheetUrl,
      tokens.accessToken,
      tokens.refreshToken,
      dbEntryCount
    );

    return success(c, sheetResponse);
  } catch (err) {
    if (isGoogleAuthError(err)) {
      return success(c, { needsReauth: true });
    }
    captureRouteError(err, { path: c.req.path });
    return error(
      c,
      ErrorCodes.INTERNAL_ERROR,
      err instanceof Error ? err.message : "Failed to create sheet",
      500
    );
  }
});

app.get("/sheets/:competitionId", async (c) => {
  try {
    const tokens = await getGoogleTokenResult(c);
    await dbConnect();
    const { competitionId } = c.req.param();

    const [sheet, tickets] = await Promise.all([
      DrawSheet.findOne({ competitionId: new Types.ObjectId(competitionId) }).lean(),
      Ticket.countDocuments({
        competitionId: new Types.ObjectId(competitionId),
        status: "sold",
      }),
    ]);

    if (!sheet) return success(c, null);

    const dbEntryCount = tickets;
    const sheetResponse = await buildSheetResponse(
      sheet.sheetId,
      sheet.sheetUrl,
      tokens?.accessToken ?? "",
      tokens?.refreshToken,
      dbEntryCount
    );

    return success(c, sheetResponse);
  } catch (err) {
    if (isGoogleAuthError(err)) {
      return success(c, { needsReauth: true });
    }
    captureRouteError(err, { path: c.req.path });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Failed to get sheet", 500);
  }
});

app.get("/sheet-settings", async (c) => {
  try {
    await dbConnect();
    const settings = await SheetAccessSettings.findOne().lean();
    return success(c, {
      whitelistedEmails: settings?.whitelistedEmails ?? [],
      driveFolderId: settings?.driveFolderId ?? "",
    });
  } catch (err) {
    captureRouteError(err, { path: c.req.path });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Failed to get settings", 500);
  }
});

app.post("/sheet-settings", async (c) => {
  try {
    await dbConnect();
    const body = (await c.req.json()) as { email?: string; driveFolderId?: string };

    const setFields: Record<string, string> = {};
    const addToSet: Record<string, string> = {};

    if (body.email && typeof body.email === "string") {
      addToSet.whitelistedEmails = body.email.toLowerCase().trim();
    }
    if (typeof body.driveFolderId === "string") {
      setFields.driveFolderId = body.driveFolderId.trim();
    }

    if (Object.keys(addToSet).length === 0 && Object.keys(setFields).length === 0) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "email or driveFolderId required", 400);
    }

    const updateDoc: Record<string, unknown> = {};
    if (Object.keys(addToSet).length > 0) updateDoc.$addToSet = addToSet;
    if (Object.keys(setFields).length > 0) updateDoc.$set = setFields;

    const settings = await SheetAccessSettings.findOneAndUpdate({}, updateDoc, {
      upsert: true,
      new: true,
    }).lean();

    if (body.email) {
      const allSheets = await DrawSheet.find().lean();
      if (allSheets.length > 0) {
        const token = await getGoogleTokenResult(c);
        if (token) {
          const { syncAllSheetEditors } = await import("../../lib/google/sheets");
          syncAllSheetEditors(
            allSheets.map((s) => s.sheetId),
            settings.whitelistedEmails,
            token
          ).catch((err) => console.error("[livestream] sync failed:", err));
        }
      }
    }

    return success(c, {
      whitelistedEmails: settings.whitelistedEmails,
      driveFolderId: settings.driveFolderId ?? "",
    });
  } catch (err) {
    captureRouteError(err, { path: c.req.path });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Failed to update settings", 500);
  }
});

app.delete("/sheet-settings/:email", async (c) => {
  try {
    await dbConnect();
    const email = decodeURIComponent(c.req.param("email")).toLowerCase().trim();

    const settings = await SheetAccessSettings.findOneAndUpdate(
      {},
      { $pull: { whitelistedEmails: email } },
      { new: true }
    ).lean();

    return success(c, {
      whitelistedEmails: settings?.whitelistedEmails ?? [],
      driveFolderId: settings?.driveFolderId ?? "",
    });
  } catch (err) {
    captureRouteError(err, { path: c.req.path });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Failed to remove email", 500);
  }
});

app.post("/sheet-settings/sync", async (c) => {
  try {
    const tokens = await getGoogleTokenResult(c);
    if (!tokens) {
      return error(c, ErrorCodes.UNAUTHORIZED, "Google account not linked", 401);
    }

    await dbConnect();
    const settings = await SheetAccessSettings.findOne().lean();
    const whitelistedEmails = settings?.whitelistedEmails ?? [];
    const allSheets = await DrawSheet.find().lean();

    const { syncAllSheetEditors } = await import("../../lib/google/sheets");
    const results = await syncAllSheetEditors(
      allSheets.map((s) => s.sheetId),
      whitelistedEmails,
      tokens
    );

    return success(c, { results });
  } catch (err) {
    captureRouteError(err, { path: c.req.path });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Failed to sync permissions", 500);
  }
});

export default app;
