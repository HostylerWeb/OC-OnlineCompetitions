import { fireConversion, getAffiliateClickId, getAffiliateSource } from "@oc/api-affiliate";
import type { IOrder } from "@oc/api-db/models";
import { Profile } from "@oc/api-db/models";
import { createLogger } from "@oc/api-logger";

const log = createLogger("payment.order-conversion");

interface FireOrderConversionParams {
  order: IOrder;
  userId: string;
  email?: string | null;
}

export function fireOrderPurchaseConversion({
  order,
  userId,
  email,
}: FireOrderConversionParams): void {
  void (async () => {
    try {
      if (Number(order.total) > 0) {
        let clickId: string | null = null;
        let source: string | null = null;
        try {
          const orderClickId = order.metadata?.affiliateClickId;
          const orderSource = order.metadata?.affiliateSource;
          clickId =
            typeof orderClickId === "string" && orderClickId.length > 0
              ? orderClickId
              : getAffiliateClickId();
          source =
            typeof orderSource === "string" && orderSource.length > 0
              ? orderSource
              : getAffiliateSource();
          const profile = await Profile.findById(userId).select("affiliate").lean();
          if (!clickId) clickId = profile?.affiliate?.clickId ?? null;
          if (!source) source = profile?.affiliate?.source ?? null;
        } catch {
          // Non-critical
        }

        fireConversion("purchase", {
          clickId,
          source: source ?? undefined,
          userId,
          email: email ?? order.orderEmail,
          amount: order.total,
          currency: "GBP",
          orderId: order._id.toString(),
        });
      }
    } catch (err) {
      log.warn("[order.conversion] conversion tracking failed", {
        error: err instanceof Error ? err.message : String(err),
        orderId: order._id.toString(),
      });
    }
  })();
}
