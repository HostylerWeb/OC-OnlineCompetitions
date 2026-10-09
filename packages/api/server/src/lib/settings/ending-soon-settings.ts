import { EndingSoonSettings } from "@oc/api-db/models";
import type { IEndingSoonSettings } from "@oc/api-db/models/EndingSoonSettings";

export const DEFAULT_ENDING_SOON_SETTINGS: IEndingSoonSettings = {
  _id: "ending_soon_settings",
  endingSoonDaysThreshold: 7,
  endingSoonTicketsThreshold: 20,
  endingSoonCombineMode: "or",
  endingSoonTimeEnabled: true,
  endingSoonTicketsEnabled: true,
  endingSoonTicketsMetric: "remaining",
};

export async function getEndingSoonSettings(): Promise<IEndingSoonSettings> {
  const settings = await EndingSoonSettings.findById("ending_soon_settings").lean();
  if (!settings) {
    return DEFAULT_ENDING_SOON_SETTINGS;
  }
  return {
    ...DEFAULT_ENDING_SOON_SETTINGS,
    ...settings,
  };
}
