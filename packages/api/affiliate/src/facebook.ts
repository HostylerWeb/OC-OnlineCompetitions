import { createHash } from "node:crypto";
import { getCurrentContext } from "@oc/api-infra/env";
import type { AffiliateEventType, FacebookPixelConfig } from "./types";

const FB_EVENT_MAP: Record<AffiliateEventType, string> = {
  signup: "Lead",
  purchase: "Purchase",
};

const FB_API_VERSION = "v21.0";

function sha256(input: string): string {
  return createHash("sha256").update(input.toLowerCase().trim()).digest("hex");
}

export function sendFacebookPixelEvent(
  config: FacebookPixelConfig,
  eventType: AffiliateEventType,
  data: {
    userId: string;
    email?: string;
    amount?: number;
    currency?: string;
    orderId?: string;
  }
): void {
  if (!config.enabled || !config.pixelId || !config.accessToken || !config.events[eventType]) return;

  const eventName = FB_EVENT_MAP[eventType];

  const userData: Record<string, string> = {};
  if (data.email) {
    userData.em = sha256(data.email);
  }
  userData.client_user_agent = "onlinecompetitions-server/1.0";
  userData.client_ip_address = "0.0.0.0";

  const customData: Record<string, string | number> = {};
  if (data.amount !== undefined) customData.value = data.amount;
  if (data.currency) customData.currency = data.currency;
  if (data.orderId) customData.order_id = data.orderId;

  const body = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        user_data: userData,
        ...(Object.keys(customData).length > 0 ? { custom_data: customData } : {}),
        event_source_url: getCurrentContext().frontendUrl,
        action_source: "website",
      },
    ],
  };

  const url = `https://graph.facebook.com/${FB_API_VERSION}/${config.pixelId}/events?access_token=${encodeURIComponent(config.accessToken)}`;

  void (async () => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "<unreadable>");
        console.warn(
          JSON.stringify({
            event: "affiliate.facebook_failed",
            eventType,
            status: res.status,
            body: text.slice(0, 500),
            timestamp: new Date().toISOString(),
          })
        );
      }
    } catch (err) {
      console.warn("[affiliate] Facebook Pixel event failed:", err);
    }
  })();
}
