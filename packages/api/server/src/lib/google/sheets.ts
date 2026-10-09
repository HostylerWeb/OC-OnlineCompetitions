import { google as googleApi } from "googleapis";

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
}

interface EntryRow {
  entryNumber: number;
  fullName: string;
}

interface CreateSheetResult {
  sheetUrl: string;
  sheetId: string;
}

interface ReconcileResult {
  added: number;
  removed: number;
  failed: Array<{ email: string; reason: string }>;
  intact: number;
}

function getClients(tokens: GoogleTokens) {
  const auth = new googleApi.auth.OAuth2({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  });
  auth.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });
  return {
    sheets: googleApi.sheets({ version: "v4", auth: auth as never }),
    drive: googleApi.drive({ version: "v3", auth: auth as never }),
  };
}

export async function getSheetRowCount(sheetId: string, tokens: GoogleTokens): Promise<number> {
  const { sheets } = getClients(tokens);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Entries!A:A",
  });
  return (res.data.values ?? []).length;
}

export async function createDrawSheet(
  title: string,
  entries: EntryRow[],
  tokens: GoogleTokens
): Promise<CreateSheetResult> {
  const { sheets, drive } = getClients(tokens);

  const createResponse = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: `Online Competitions Draw - ${title}` },
      sheets: [{ properties: { title: "Entries" } }],
    },
  });

  const spreadsheetId = createResponse.data.spreadsheetId;
  if (!spreadsheetId) throw new Error("Failed to create spreadsheet");

  const dataRows = entries.map((e) => [String(e.entryNumber), e.fullName]);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Entries!A1",
    valueInputOption: "RAW",
    requestBody: {
      values: dataRows,
    },
  });

  await drive.permissions.create({
    fileId: spreadsheetId,
    requestBody: { type: "anyone", role: "reader" },
  });

  return {
    sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    sheetId: spreadsheetId,
  };
}

export async function refreshSheetEntries(
  sheetId: string,
  entries: EntryRow[],
  tokens: GoogleTokens
): Promise<void> {
  const { sheets } = getClients(tokens);
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId,
    range: "Entries!A:Z",
  });
  const dataRows = entries.map((e) => [String(e.entryNumber), e.fullName]);
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: "Entries!A1",
    valueInputOption: "RAW",
    requestBody: { values: dataRows },
  });
}

export async function reconcileSheetEditors(
  sheetId: string,
  desiredEditors: string[],
  tokens: GoogleTokens
): Promise<ReconcileResult> {
  const { drive } = getClients(tokens);

  const {
    data: { permissions },
  } = await drive.permissions.list({
    fileId: sheetId,
    fields: "permissions(id, type, role, emailAddress)",
  });

  const current = new Map<string, { permissionId: string }>();
  for (const perm of permissions ?? []) {
    if (perm.type === "user" && perm.role === "writer" && perm.emailAddress) {
      current.set(perm.emailAddress.toLowerCase(), { permissionId: perm.id! });
    }
  }

  const desired = new Set(desiredEditors.map((e) => e.toLowerCase()));
  const toCreate = desiredEditors.filter((e) => !current.has(e.toLowerCase()));
  const toDelete: string[] = [];
  for (const [email, { permissionId }] of current) {
    if (!desired.has(email)) toDelete.push(permissionId);
  }
  const intact = current.size - toDelete.length;

  for (const permId of toDelete) {
    await drive.permissions.delete({ fileId: sheetId, permissionId: permId });
  }

  const failed: Array<{ email: string; reason: string }> = [];
  for (const email of toCreate) {
    try {
      await drive.permissions.create({
        fileId: sheetId,
        requestBody: { type: "user", role: "writer", emailAddress: email },
        sendNotificationEmail: false,
      });
    } catch (err) {
      failed.push({ email, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  return { added: toCreate.length - failed.length, removed: toDelete.length, failed, intact };
}

export async function syncAllSheetEditors(
  sheetIds: string[],
  desiredEditors: string[],
  tokens: GoogleTokens
): Promise<Array<{ sheetId: string; result: ReconcileResult }>> {
  const results: Array<{ sheetId: string; result: ReconcileResult }> = [];
  for (const sheetId of sheetIds) {
    try {
      const result = await reconcileSheetEditors(sheetId, desiredEditors, tokens);
      results.push({ sheetId, result });
    } catch (err) {
      results.push({
        sheetId,
        result: {
          added: 0,
          removed: 0,
          failed: [{ email: "n/a", reason: String(err) }],
          intact: 0,
        },
      });
    }
  }
  return results;
}
