import { ReferralPurchase, ReferralSettings } from "@oc/api-db/models";
import { createLogger } from "@oc/api-logger";
import { awardPendingReferralTickets } from "@oc/api-referrals/referral-award";
import { DEFAULT_REFERRAL_SETTINGS } from "@oc/api-referrals/referral-defaults";

const log = createLogger("bootstrap.referrals");

export async function flushPendingReferralAwards(): Promise<void> {
  try {
    const settingsDoc = await ReferralSettings.findById("referral_settings").lean();
    const settings = { ...DEFAULT_REFERRAL_SETTINGS, ...settingsDoc } as Parameters<
      typeof awardPendingReferralTickets
    >[1];

    const unawardedReferrers = await ReferralPurchase.distinct("referrerId", {
      $or: [{ ticketsAwarded: { $exists: false } }, { ticketsAwarded: 0 }],
      deletedAt: null,
    });

    if (unawardedReferrers.length === 0) {
      log.info("bootstrap: no pending referral awards to flush");
      return;
    }

    log.info(
      `bootstrap: flushing ${unawardedReferrers.length} referrer(s) with pending referral awards`
    );

    let flushed = 0;
    let failed = 0;
    for (const referrerId of unawardedReferrers) {
      try {
        const result = await awardPendingReferralTickets(referrerId, settings);
        if (result.ticketsGranted > 0) flushed++;
      } catch (err) {
        failed++;
        log.error("bootstrap: failed to flush profile", { err, referrerId: referrerId.toString() });
      }
    }

    log.info(`bootstrap: flushed ${flushed} referrer(s), ${failed} failed`);
  } catch (err) {
    log.error("bootstrap: flushPendingReferralAwards crashed (non-fatal)", { err });
  }
}
