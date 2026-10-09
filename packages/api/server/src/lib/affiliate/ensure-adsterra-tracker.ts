import { ConversionSettings } from "@oc/api-db/models";
import { CH, invalidateByChannelSafe } from "@oc/api-infra/cache";

const CONVERSION_SETTINGS_ID = "conversion_settings";
const ADSTERRA_TRACKER_ID = "adsterra";
const DEFAULT_ADSTERRA_POSTBACK_URL =
  "https://www.pbterra.com/code/GBP/onlinecompetitions/at?subid_short={clickid}&atpay={payout}";

export async function ensureAdsterraTracker(): Promise<void> {
  try {
    const existing = await ConversionSettings.findOne({ _id: CONVERSION_SETTINGS_ID }).lean();
    const existingTrackers = existing?.trackers ?? [];
    if (existingTrackers.some((t) => t.id === ADSTERRA_TRACKER_ID)) return;

    const adsterraTracker = {
      id: ADSTERRA_TRACKER_ID,
      name: "Adsterra",
      // disabled by default — the admin enables it manually from /conversion-tracking
      enabled: false,
      events: {
        purchase: {
          enabled: false,
          method: "GET" as const,
          urlTemplate: DEFAULT_ADSTERRA_POSTBACK_URL,
          payoutOverride: null,
        },
      },
    };

    const trackers = [...existingTrackers, adsterraTracker];

    // create-only: never overwrite admin edits to an existing adsterra tracker.
    // Fresh docs are seeded fully disabled (master toggle off) so nothing fires
    // until the admin configures payouts and enables tracking.
    await ConversionSettings.findOneAndUpdate(
      { _id: CONVERSION_SETTINGS_ID },
      existing
        ? { $set: { trackers } }
        : {
            $set: {
              trackers,
              enabled: false,
              defaultPayouts: { signup: 0, purchase: 0 },
            },
          },
      { upsert: true }
    );

    console.log("[ADSTERRA-SEED] seeded adsterra tracker (disabled by default)");
    void invalidateByChannelSafe(CH.conversionSettings).catch(() => {});
  } catch (err) {
    console.warn(
      "[ADSTERRA-SEED] failed to seed adsterra tracker (non-fatal):",
      err instanceof Error ? err.message : String(err)
    );
  }
}
