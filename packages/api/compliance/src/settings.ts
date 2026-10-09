import {
  ComplianceSettings,
  DEFAULT_COMPLIANCE_SETTINGS,
  type IComplianceSettings,
} from "@oc/api-db/models/ComplianceSettings";
import { CH, invalidateByChannelSafe } from "@oc/api-infra/cache";
import type { PublicComplianceSettings } from "@oc/types";

/**
 * Idempotently ensure the singleton ComplianceSettings document exists.
 *
 * If no record is present, creates one with the schema's default values
 * (masterEnabled=false, postalEntryProminenceEnabled=true,
 * guestCheckoutEnabled=true, etc.) and logs `[COMPLIANCE-AUTOSEED]` so QA
 * can grep the boot logs to confirm the seed ran.
 *
 * If a record already exists, returns it as-is — never overwrites
 * admin-customised values.
 */
export async function ensureComplianceSettings(): Promise<IComplianceSettings> {
  const result = (await ComplianceSettings.findOneAndUpdate(
    { _id: "compliance_settings" },
    { $setOnInsert: { ...DEFAULT_COMPLIANCE_SETTINGS } },
    { upsert: true, new: true, includeResultMetadata: true }
  )) as unknown as {
    value: (IComplianceSettings & { toObject?: () => IComplianceSettings }) | null;
    lastErrorObject?: { upserted?: unknown };
  };

  if (result?.lastErrorObject?.upserted) {
    console.log("[COMPLIANCE-AUTOSEED] compliance settings created with defaults");
  }
  void invalidateByChannelSafe(CH.complianceSettings).catch(() => {});

  if (result?.value) {
    const value = result.value;
    if (typeof value.toObject === "function") {
      return { ...DEFAULT_COMPLIANCE_SETTINGS, ...(value.toObject() as IComplianceSettings) };
    }
    return { ...DEFAULT_COMPLIANCE_SETTINGS, ...(value as IComplianceSettings) };
  }

  const fetched = await ComplianceSettings.findById("compliance_settings").lean();
  return fetched ? { ...DEFAULT_COMPLIANCE_SETTINGS, ...fetched } : DEFAULT_COMPLIANCE_SETTINGS;
}

export async function getComplianceSettings(): Promise<IComplianceSettings> {
  const settings = await ComplianceSettings.findById("compliance_settings").lean();
  if (settings) {
    return { ...DEFAULT_COMPLIANCE_SETTINGS, ...settings };
  }
  return ensureComplianceSettings();
}

export function toPublicComplianceSettings(
  settings: IComplianceSettings
): PublicComplianceSettings {
  return {
    masterEnabled: settings.masterEnabled,
    ageVerificationEnabled: settings.ageVerificationEnabled,
    ageVerificationMinAge: settings.ageVerificationMinAge,
    creditCardMonthlyLimitEnabled: settings.creditCardMonthlyLimitEnabled,
    creditCardMonthlyLimitGBP: settings.creditCardMonthlyLimitGBP,
    instantWinCreditCardBanEnabled: settings.instantWinCreditCardBanEnabled,
    personalSpendLimitsEnabled: settings.personalSpendLimitsEnabled,
    spendLimitIncreaseCooldownHours: settings.spendLimitIncreaseCooldownHours,
    selfExclusionEnabled: settings.selfExclusionEnabled,
    selfExclusionMinMonths: settings.selfExclusionMinMonths,
    postalEntryAddress: settings.postalEntryAddress,
    postalEntryProminenceEnabled: settings.postalEntryProminenceEnabled,
    compliancePageEnabled: settings.compliancePageEnabled,
    guestCheckoutEnabled: settings.guestCheckoutEnabled,
    allowZeroSubtotalOrders: settings.allowZeroSubtotalOrders,
    minimumOrderValue: settings.minimumOrderValue,
  };
}

export function isComplianceEnforcementActive(settings: IComplianceSettings): boolean {
  return settings.masterEnabled;
}
