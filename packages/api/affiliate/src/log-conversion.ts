import { ConversionPostbackLog } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import type { AffiliateConversionData } from "./types";

export interface PostbackLogEntry {
  eventType: "signup" | "purchase";
  trackerId: string;
  trackerName: string;
  url: string;
  method: "GET" | "POST";
  status: number | null;
  ok: boolean;
  error?: string;
  data: AffiliateConversionData;
  payout: number;
}

export async function recordPostbackLog(entry: PostbackLogEntry): Promise<void> {
  try {
    await dbConnect();
    await ConversionPostbackLog.create({
      eventType: entry.eventType,
      trackerId: entry.trackerId,
      trackerName: entry.trackerName,
      url: entry.url,
      method: entry.method,
      status: entry.status,
      ok: entry.ok,
      error: entry.error ?? null,
      clickId: entry.data.clickId ?? null,
      source: entry.data.source ?? null,
      userId: entry.data.userId,
      email: entry.data.email ?? null,
      amount: entry.data.amount ?? null,
      payout: entry.payout,
      currency: entry.data.currency ?? null,
      orderId: entry.data.orderId ?? null,
      transactionId: entry.data.transactionId ?? null,
    });
  } catch (err) {
    console.warn(
      JSON.stringify({
        event: "affiliate.postback_log_failed",
        error: err instanceof Error ? err.message : String(err),
        eventType: entry.eventType,
        trackerId: entry.trackerId,
        timestamp: new Date().toISOString(),
      })
    );
  }
}
