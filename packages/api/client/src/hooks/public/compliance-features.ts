"use client";
import type { ApiResponse, PublicComplianceSettings, SaferPlayState } from "@oc/types";
import { useMemo } from "react";
import { usePublicComplianceSettings } from "./compliance";

export interface ComplianceFeatures {
  isLoading: boolean;
  enforcementActive: boolean;
  ageVerification: boolean;
  personalSpendLimits: boolean;
  selfExclusion: boolean;
  creditCardCap: boolean;
  instantWinCreditBan: boolean;
  publicResponsiblePlayPage: boolean;
  postalProminence: boolean;
  guestCheckoutEnabled: boolean;
  allowZeroSubtotalOrders: boolean;
  minimumOrderValue: number;
  minAge: number;
  creditCardLimitGBP: number;
  spendLimitIncreaseCooldownHours: number;
  selfExclusionMinMonths: number;
  postalEntryAddress: string;
}

export function deriveComplianceFeatures(
  settings: PublicComplianceSettings | undefined,
  isLoading: boolean
): ComplianceFeatures {
  const master = settings?.masterEnabled ?? false;

  return {
    isLoading,
    enforcementActive: master,
    ageVerification: master && (settings?.ageVerificationEnabled ?? false),
    personalSpendLimits: master && (settings?.personalSpendLimitsEnabled ?? false),
    selfExclusion: master && (settings?.selfExclusionEnabled ?? false),
    creditCardCap: master && (settings?.creditCardMonthlyLimitEnabled ?? false),
    instantWinCreditBan: master && (settings?.instantWinCreditCardBanEnabled ?? false),
    publicResponsiblePlayPage: master && (settings?.compliancePageEnabled ?? false),
    postalProminence: master && (settings?.postalEntryProminenceEnabled ?? false),
    guestCheckoutEnabled: !master || (settings?.guestCheckoutEnabled ?? true),
    allowZeroSubtotalOrders: !master || (settings?.allowZeroSubtotalOrders ?? true),
    minimumOrderValue: master ? (settings?.minimumOrderValue ?? 0) : 0,
    minAge: settings?.ageVerificationMinAge ?? 18,
    creditCardLimitGBP: settings?.creditCardMonthlyLimitGBP ?? 250,
    spendLimitIncreaseCooldownHours: settings?.spendLimitIncreaseCooldownHours ?? 24,
    selfExclusionMinMonths: settings?.selfExclusionMinMonths ?? 6,
    postalEntryAddress: settings?.postalEntryAddress ?? "",
  };
}

export function useComplianceFeatures(options?: {
  initialData?: ApiResponse<PublicComplianceSettings>;
}): ComplianceFeatures {
  const { data, isLoading } = usePublicComplianceSettings({ initialData: options?.initialData });

  return useMemo(() => deriveComplianceFeatures(data?.data, isLoading), [data?.data, isLoading]);
}

export function resolveEffectiveSelfExcluded(state: SaferPlayState | undefined): boolean {
  if (!state?.selfExcluded) return false;

  if (typeof state.effectiveSelfExcluded === "boolean") {
    return state.effectiveSelfExcluded;
  }

  if (!state.selfExcludedUntil) return true;

  return new Date(state.selfExcludedUntil) > new Date();
}

export function hasResponsiblePlayTools(features: ComplianceFeatures): boolean {
  return features.personalSpendLimits || features.selfExclusion || features.creditCardCap;
}

export const RESPONSIBLE_PLAY_SECTION_FEATURES = {
  age: "ageVerification",
  "credit-cap": "creditCardCap",
  "instant-win": "instantWinCreditBan",
  "spend-limits": "personalSpendLimits",
  "self-exclusion": "selfExclusion",
  postal: "postalProminence",
} as const satisfies Record<string, keyof ComplianceFeatures>;

export type ResponsiblePlaySectionFeatureKey =
  (typeof RESPONSIBLE_PLAY_SECTION_FEATURES)[keyof typeof RESPONSIBLE_PLAY_SECTION_FEATURES];

export function isResponsiblePlaySectionVisible(
  sectionId: string,
  features: ComplianceFeatures
): boolean {
  if (sectionId === "draws") return true;

  const featureKey =
    RESPONSIBLE_PLAY_SECTION_FEATURES[sectionId as keyof typeof RESPONSIBLE_PLAY_SECTION_FEATURES];
  if (!featureKey) return true;

  return features[featureKey] as boolean;
}
