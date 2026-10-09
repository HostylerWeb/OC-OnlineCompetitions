"use client";
import type { ApiResponse, SaferPlayState } from "@oc/types";
import { useMemo } from "react";
import { useMyProfile } from "../private/profile";
import { useSaferPlay } from "../private/safer-play";
import { usePublicComplianceSettings } from "../public/compliance";
import { resolveEffectiveSelfExcluded, useComplianceFeatures } from "../public/compliance-features";

export interface CheckoutEligibility {
  isLoading: boolean;
  canCheckout: boolean;
  ageVerificationRequired: boolean;
  spendLimitRequired: boolean;
  selfExcluded: boolean;
}

export function useCheckoutEligibility(options?: {
  saferPlayInitialData?: ApiResponse<SaferPlayState>;
}): CheckoutEligibility {
  const { data: profileResponse, isLoading: profileLoading } = useMyProfile();
  const { isLoading: complianceLoading } = usePublicComplianceSettings();
  const { data: saferPlayResponse, isLoading: saferPlayLoading } = useSaferPlay({
    initialData: options?.saferPlayInitialData,
  });
  const features = useComplianceFeatures();

  const profile = profileResponse?.data;
  const saferPlay = saferPlayResponse?.data;

  return useMemo(() => {
    const ageVerificationRequired = features.ageVerification && !profile?.isAgeVerified;

    const spendLimitRequired =
      features.personalSpendLimits && (saferPlay?.spendLimitRequired ?? false);

    const effectiveSelfExcluded = resolveEffectiveSelfExcluded(saferPlay);
    const selfExcluded = features.selfExclusion && effectiveSelfExcluded;

    const isLoading = profileLoading || complianceLoading || saferPlayLoading || features.isLoading;
    const canCheckout =
      !isLoading && !ageVerificationRequired && !spendLimitRequired && !selfExcluded;

    return {
      isLoading,
      canCheckout,
      ageVerificationRequired,
      spendLimitRequired,
      selfExcluded,
    };
  }, [
    features.ageVerification,
    features.personalSpendLimits,
    features.selfExclusion,
    features.isLoading,
    profile?.isAgeVerified,
    profileLoading,
    complianceLoading,
    saferPlayLoading,
    saferPlay,
  ]);
}
