import { ConversionSettings } from "@oc/api-db/models";
import { tryGetRedis } from "@oc/api-infra/cache";
import type {
  AffiliateConversionData,
  AffiliateEventType,
  ConversionSettingsData,
} from "./types";
import { sendFacebookPixelEvent } from "./facebook";
import { sendGA4Event } from "./ga4";
import { recordPostbackLog } from "./log-conversion";
import { assertSafeOutboundUrl } from "./outbound-url";

const SETTINGS_CACHE_KEY = "pub:settings:conversion_settings:singleton";

function interpolate(template: string, data: AffiliateConversionData): string {
  return template
    .replace(/\{clickid\}/g, data.clickId ? encodeURIComponent(data.clickId) : "")
    .replace(/\{source\}/g, encodeURIComponent(data.source ?? ""))
    .replace(/\{userid\}/g, encodeURIComponent(data.userId))
    .replace(/\{email\}/g, encodeURIComponent(data.email ?? ""))
    .replace(/\{amount\}/g, encodeURIComponent((data.amount ?? 0).toString()))
    .replace(/\{currency\}/g, encodeURIComponent(data.currency ?? "GBP"))
    .replace(/\{orderid\}/g, encodeURIComponent(data.orderId ?? ""))
    .replace(/\{transaction_id\}/g, encodeURIComponent(data.transactionId ?? ""))
    .replace(/\{pubid\}/g, encodeURIComponent(data.pubId ?? ""))
    .replace(/\{zone\}/g, encodeURIComponent(data.zone ?? ""))
    .replace(/\{campaignid\}/g, encodeURIComponent(data.campaignId ?? ""))
    .replace(/\{device\}/g, encodeURIComponent(data.device ?? ""))
    .replace(/\{country\}/g, encodeURIComponent(data.country ?? ""))
    .replace(/\{creativeid\}/g, encodeURIComponent(data.creativeId ?? ""));
}

function resolvePayout(
  eventType: AffiliateEventType,
  data: AffiliateConversionData,
  settings: ConversionSettingsData
): number {
  if (eventType === "purchase" && data.amount !== undefined) {
    return data.amount;
  }
  return settings.defaultPayouts[eventType] ?? 0;
}

async function loadSettings(): Promise<ConversionSettingsData | null> {
  const redis = await tryGetRedis();
  try {
    if (redis) {
      const cached = await redis.get(SETTINGS_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached) as ConversionSettingsData;
      }
    }
    const doc = await ConversionSettings.findById("conversion_settings").lean();
    if (doc) {
      const data = doc as unknown as ConversionSettingsData;
      if (redis) {
        void redis.setex(SETTINGS_CACHE_KEY, 60, JSON.stringify(data)).catch(() => {});
      }
      return data;
    }
    return null;
  } catch (err) {
    console.warn("[affiliate] loadSettings error:", err);
    return null;
  }
}

async function fireTrackerUrl(
  url: string,
  method: string,
  trackerId: string,
  trackerName: string,
  eventType: AffiliateEventType,
  data: AffiliateConversionData,
  payout: number
): Promise<void> {
  try {
    assertSafeOutboundUrl(url);
    const res = await fetch(url, {
      ...(method === "POST" ? { method: "POST" } : {}),
      redirect: "error",
    });
    void recordPostbackLog({
      eventType,
      trackerId,
      trackerName,
      url,
      method: method === "POST" ? "POST" : "GET",
      status: res.status,
      ok: res.ok,
      data,
      payout,
    }).catch(() => {});
    if (res.ok) {
      console.log(
        JSON.stringify({
          event: "affiliate.postback_sent",
          tracker: trackerName,
          eventType,
          url,
          status: res.status,
          timestamp: new Date().toISOString(),
        })
      );
    } else {
      const body = await res.text().catch(() => "<unreadable>");
      void recordPostbackLog({
        eventType,
        trackerId,
        trackerName,
        url,
        method: method === "POST" ? "POST" : "GET",
        status: res.status,
        ok: false,
        error: body.slice(0, 500),
        data,
        payout,
      }).catch(() => {});
      console.warn(
        JSON.stringify({
          event: "affiliate.postback_failed",
          tracker: trackerName,
          eventType,
          url,
          status: res.status,
          body: body.slice(0, 500),
          timestamp: new Date().toISOString(),
        })
      );
    }
  } catch (err) {
    void recordPostbackLog({
      eventType,
      trackerId,
      trackerName,
      url,
      method: method === "POST" ? "POST" : "GET",
      status: null,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      data,
      payout,
    }).catch(() => {});
    console.warn(
      JSON.stringify({
        event: "affiliate.postback_error",
        tracker: trackerName,
        eventType,
        url,
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      })
    );
  }
}

export function fireConversion(
  eventType: AffiliateEventType,
  data: AffiliateConversionData
): void {
  void (async () => {
    try {
      const settings = await loadSettings();
      if (!settings || !settings.enabled) {
        console.log(
          JSON.stringify({
            event: "affiliate.skipped_settings_disabled",
            eventType,
            timestamp: new Date().toISOString(),
          })
        );
        return;
      }

      for (const tracker of settings.trackers) {
        if (!tracker.enabled) continue;

        const eventConfig = tracker.events[eventType];
        if (!eventConfig?.enabled || !eventConfig.urlTemplate) continue;

        const payout = eventConfig.payoutOverride ?? resolvePayout(eventType, data, settings);
        let url = eventConfig.urlTemplate
          .replace(/\{payout\}/g, payout.toString());

        url = interpolate(url, { ...data, amount: payout });

        if (eventConfig.extraParams) {
          const separator = url.includes("?") ? "&" : "?";
          const raw = eventConfig.extraParams;
          let extraRecord: Record<string, string>;
          if (typeof raw === "string") {
            const parsed: Record<string, string> = {};
            raw.split("&").forEach((pair: string) => {
              const eqIdx = pair.indexOf("=");
              if (eqIdx > 0) {
                parsed[decodeURIComponent(pair.slice(0, eqIdx))] = decodeURIComponent(pair.slice(eqIdx + 1));
              } else if (pair) {
                parsed[decodeURIComponent(pair)] = "";
              }
            });
            extraRecord = parsed;
          } else {
            extraRecord = raw;
          }
          const extra = new URLSearchParams(extraRecord).toString();
          url += `${separator}${extra}`;
        }

        const method = eventConfig.method ?? "GET";
        void fireTrackerUrl(url, method, tracker.id, tracker.name, eventType, data, payout);
      }

      if (settings.googleAnalytics) {
        sendGA4Event(settings.googleAnalytics, eventType, {
          userId: data.userId,
          email: data.email,
          amount: data.amount,
          currency: data.currency,
          orderId: data.orderId,
        });
      }

      if (settings.facebookPixel) {
        sendFacebookPixelEvent(settings.facebookPixel, eventType, {
          userId: data.userId,
          email: data.email,
          amount: data.amount,
          currency: data.currency,
          orderId: data.orderId,
        });
      }
    } catch (err) {
      console.warn(
        JSON.stringify({
          event: "affiliate.fireConversion_error",
          error: err instanceof Error ? err.message : String(err),
          eventType,
          timestamp: new Date().toISOString(),
        })
      );
    }
  })();
}
