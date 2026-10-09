import { type IProfile, Profile } from "@oc/api-db/models";
import type { IComplianceSettings } from "@oc/api-db/models/ComplianceSettings";
import { invalidateUser } from "@oc/api-infra/cache";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import type { CheckoutComplianceHints } from "@oc/types";
import { isDobMeetsMinAge } from "./age-verification";
import { ComplianceError } from "./ComplianceError";
import {
  assertNotEffectivelySelfExcluded,
  reconcileSelfExclusionOnRead,
} from "./compliance-user-service";
import { cartHasInstantWinCompetitions } from "./instant-win";
import { getComplianceSettings, isComplianceEnforcementActive } from "./settings";
import {
  getMonthlySpendByEmail,
  getUserCompletedOrderCount,
  getUserCreditCardSpendThisMonth,
  getUserMonthlySpendAllMethods,
  reserveSpendAllowance,
} from "./spend-tracking";

export interface AssertComplianceOptions {
  userId: string;
  cartTotal: number;
  competitionIds: string[];
  /** When true, block card payment sessions for instant-win + credit ban. */
  blockCardPayment?: boolean;
  /** Additional amount that would be charged on a credit card this month. */
  projectedCreditSpend?: number;
}

/**
 * Order-value policy: blocks £0 checkouts when disabled by admin, and enforces
 * a minimum payable order value. Both checks measure the payable total
 * (`cartTotal`), i.e. the amount actually charged after wallet/discounts.
 * Field-tolerant so already-seeded settings docs (which predate these fields)
 * behave as enabled / no-minimum.
 */
function assertOrderValuePolicy(cartTotal: number, settings: IComplianceSettings): void {
  const allowZero = settings.allowZeroSubtotalOrders !== false;

  if (cartTotal <= 0 && !allowZero) {
    throw new ComplianceError(
      ErrorCodes.ZERO_SUBTOTAL_DISABLED,
      "Your order total is £0.00. Add at least one paid ticket to continue.",
      400
    );
  }

  const minimumOrderValue = Number(settings.minimumOrderValue) || 0;
  if (minimumOrderValue > 0 && cartTotal < minimumOrderValue) {
    throw new ComplianceError(
      ErrorCodes.MINIMUM_ORDER_NOT_MET,
      `This order is below the minimum order value of £${minimumOrderValue.toFixed(2)}. Please add more tickets to continue.`,
      400
    );
  }
}

async function applyPendingSpendLimit(
  profile: IProfile & { _id: { toString(): string } }
): Promise<IProfile & { _id: { toString(): string } }> {
  if (
    profile.pendingMonthlySpendLimit == null ||
    !profile.monthlySpendLimitEffectiveAt ||
    profile.monthlySpendLimitEffectiveAt > new Date()
  ) {
    return profile;
  }

  const userId = profile._id.toString();
  const updated = await Profile.findByIdAndUpdate(
    userId,
    {
      $set: {
        monthlySpendLimit: profile.pendingMonthlySpendLimit,
        pendingMonthlySpendLimit: null,
        monthlySpendLimitEffectiveAt: null,
        reservedSpend: 0,
      },
    },
    { returnDocument: "after" }
  ).lean();

  if (!updated) return profile;
  void invalidateUser(userId).catch(() => {});
  return updated as IProfile & { _id: { toString(): string } };
}

function assertAgeVerified(profile: IProfile, settings: IComplianceSettings): void {
  if (!settings.ageVerificationEnabled) return;
  if (profile.isAgeVerified) return;

  throw new ComplianceError(
    ErrorCodes.AGE_VERIFICATION_REQUIRED,
    "Age verification is required before you can complete a purchase. Please confirm your date of birth in your profile.",
    403
  );
}

async function assertPersonalSpendLimit(
  profile: IProfile,
  settings: IComplianceSettings,
  cartTotal: number,
  _completedOrderCount: number
): Promise<void> {
  if (!settings.personalSpendLimitsEnabled) return;

  if (profile.monthlySpendLimit == null) return;

  if (profile.monthlySpendLimit === 0) {
    throw new ComplianceError(
      ErrorCodes.PERSONAL_SPEND_LIMIT_EXCEEDED,
      "Your personal spend limit blocks all purchases this month.",
      403
    );
  }

  const currentMonthSpend = await getUserMonthlySpendAllMethods(profile._id.toString());
  const reserved = await reserveSpendAllowance(
    profile._id.toString(),
    cartTotal,
    currentMonthSpend
  );
  if (!reserved) {
    throw new ComplianceError(
      ErrorCodes.PERSONAL_SPEND_LIMIT_EXCEEDED,
      `This purchase would exceed your monthly spend limit of £${profile.monthlySpendLimit.toFixed(2)}.`,
      403
    );
  }
}

const GUEST_MAX_ORDER = 100;
const GUEST_MAX_MONTHLY = 500;
/** Guest caps (GBP) — not yet exposed in ComplianceSettings admin UI (P4-L3). */

async function assertGuestSpendLimit(profile: IProfile, cartTotal: number): Promise<void> {
  if (cartTotal > GUEST_MAX_ORDER) {
    throw new ComplianceError(
      ErrorCodes.CHECKOUT_ERROR,
      `Guest orders are limited to £${GUEST_MAX_ORDER} per purchase.`,
      400
    );
  }

  const monthSpentOnUser = await getUserMonthlySpendAllMethods(profile._id.toString());
  if (monthSpentOnUser + cartTotal > GUEST_MAX_MONTHLY) {
    throw new ComplianceError(
      ErrorCodes.PERSONAL_SPEND_LIMIT_EXCEEDED,
      "Guest monthly spend limit reached. Create an account to continue.",
      403
    );
  }

  if (!profile.email) {
    throw new ComplianceError(
      ErrorCodes.VALIDATION_ERROR,
      "Guest profile is missing an email address.",
      400
    );
  }

  const monthSpentOnEmail = await getMonthlySpendByEmail(profile.email);
  if (monthSpentOnEmail + cartTotal > GUEST_MAX_MONTHLY) {
    throw new ComplianceError(
      ErrorCodes.PERSONAL_SPEND_LIMIT_EXCEEDED,
      "Account limit reached. Create an account to continue.",
      403
    );
  }
}

async function assertCreditCardLimit(
  settings: IComplianceSettings,
  userId: string,
  projectedCreditSpend: number
): Promise<void> {
  if (!settings.creditCardMonthlyLimitEnabled) return;

  const spent = await getUserCreditCardSpendThisMonth(userId);
  const limit = settings.creditCardMonthlyLimitGBP;
  if (spent + projectedCreditSpend > limit) {
    const remaining = Math.max(0, limit - spent);
    throw new ComplianceError(
      ErrorCodes.CREDIT_CARD_LIMIT_EXCEEDED,
      `Credit card spend this month would exceed the £${limit} limit. Remaining allowance: £${remaining.toFixed(2)}.`,
      403
    );
  }
}

async function assertInstantWinCardBlock(
  settings: IComplianceSettings,
  competitionIds: string[],
  blockCardPayment: boolean
): Promise<boolean> {
  const instantWinInCart = await cartHasInstantWinCompetitions(competitionIds);
  if (blockCardPayment && instantWinInCart && settings.instantWinCreditCardBanEnabled) {
    throw new ComplianceError(
      ErrorCodes.INSTANT_WIN_CREDIT_CARD_BLOCKED,
      "Credit cards cannot be used for instant-win competitions. Please use a debit card, Apple Pay, or Google Pay.",
      403
    );
  }
  return instantWinInCart;
}

export async function assertComplianceForCheckout(
  opts: AssertComplianceOptions
): Promise<{ instantWinInCart: boolean; settings: IComplianceSettings }> {
  const settings = await getComplianceSettings();
  if (!isComplianceEnforcementActive(settings)) {
    const instantWinInCart = await cartHasInstantWinCompetitions(opts.competitionIds);
    return { instantWinInCart, settings };
  }

  await reconcileSelfExclusionOnRead(opts.userId);

  assertOrderValuePolicy(opts.cartTotal, settings);

  const profileDoc = await Profile.findById(opts.userId).lean();
  if (!profileDoc) {
    throw new ComplianceError(ErrorCodes.NOT_FOUND, "Profile not found", 404);
  }

  const activeProfile = await applyPendingSpendLimit(
    profileDoc as IProfile & { _id: { toString(): string } }
  );

  assertNotEffectivelySelfExcluded(activeProfile, settings);
  assertAgeVerified(activeProfile, settings);

  if (!activeProfile.isGuestCheckout) {
    const completedOrderCount = await getUserCompletedOrderCount(opts.userId);
    await assertPersonalSpendLimit(activeProfile, settings, opts.cartTotal, completedOrderCount);
  }

  await assertCreditCardLimit(settings, opts.userId, opts.projectedCreditSpend ?? opts.cartTotal);

  if (activeProfile.isGuestCheckout) {
    await assertGuestSpendLimit(activeProfile, opts.cartTotal);
  }

  const instantWinInCart = await assertInstantWinCardBlock(
    settings,
    opts.competitionIds,
    opts.blockCardPayment ?? false
  );

  return { instantWinInCart, settings };
}

export async function getCheckoutComplianceHints(
  userId: string,
  competitionIds: string[]
): Promise<CheckoutComplianceHints> {
  const settings = await getComplianceSettings();
  const profile = await Profile.findById(userId).lean();
  const instantWinInCart = await cartHasInstantWinCompetitions(competitionIds);
  const creditCardSpendThisMonth = await getUserCreditCardSpendThisMonth(userId);

  const enforcementActive = isComplianceEnforcementActive(settings);
  const creditCardMonthlyLimitEnabled = enforcementActive && settings.creditCardMonthlyLimitEnabled;
  const creditCardLimitRemaining = creditCardMonthlyLimitEnabled
    ? Math.max(0, settings.creditCardMonthlyLimitGBP - creditCardSpendThisMonth)
    : null;

  return {
    instantWinInCart,
    creditCardSpendThisMonth,
    creditCardLimitRemaining,
    creditCardMonthlyLimitEnabled,
    instantWinCreditCardBanEnabled: enforcementActive && settings.instantWinCreditCardBanEnabled,
    ageVerificationRequired:
      enforcementActive && settings.ageVerificationEnabled && !profile?.isAgeVerified,
    isAgeVerified: profile?.isAgeVerified ?? false,
  };
}

export async function verifyAgeFromDobUpdate(
  dateOfBirth: Date,
  minAge: number
): Promise<{ isAgeVerified: boolean }> {
  const meetsMinAge = isDobMeetsMinAge(dateOfBirth, minAge);
  return {
    isAgeVerified: meetsMinAge,
  };
}
