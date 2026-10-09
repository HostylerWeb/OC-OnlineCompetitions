import { createExternalAxios } from "@oc/api-axios";
import { dbConnect } from "@oc/api-db";
import { ComplianceAuditLog, type IProfile, Profile } from "@oc/api-db/models";
import type { IComplianceSettings } from "@oc/api-db/models/ComplianceSettings";
import { invalidateUser } from "@oc/api-infra/cache";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import type { SelfExclusionDuration } from "@oc/types";
import { ComplianceError } from "./ComplianceError";
import { getComplianceSettings, isComplianceEnforcementActive } from "./settings";
import {
  getUserCompletedOrderCount,
  getUserCreditCardSpendThisMonth,
  getUserMonthlySpendAllMethods,
} from "./spend-tracking";

const externalWebhookAxios = createExternalAxios({ baseURL: "", timeout: 5_000 });

export interface EffectiveSelfExclusion {
  effective: boolean;
  isPermanent: boolean;
  until: Date | null;
}

export type ComplianceAuditSource = "admin" | "user";

export interface ApplySpendLimitOptions {
  bypassCooldown?: boolean;
  reason?: string;
  actorId?: string;
  source?: ComplianceAuditSource;
}

export interface ApplySelfExclusionOptions {
  actorId?: string;
  reason?: string;
  source?: ComplianceAuditSource;
  sendWebhook?: boolean;
}

export interface LiftSelfExclusionOptions {
  actorId?: string;
  reason?: string;
  source?: ComplianceAuditSource;
  acknowledgePermanent?: boolean;
  sendWebhook?: boolean;
  onLifted?: (userId: string) => void;
}

export interface CancelPendingSpendIncreaseOptions {
  actorId?: string;
  reason?: string;
}

type ProfileComplianceFields = Pick<
  IProfile,
  | "selfExcluded"
  | "selfExcludedUntil"
  | "selfExcludedAt"
  | "monthlySpendLimit"
  | "pendingMonthlySpendLimit"
  | "monthlySpendLimitEffectiveAt"
  | "isAgeVerified"
  | "ageVerifiedAt"
  | "ageVerificationMethod"
  | "email"
  | "marketingConsent"
>;

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function resolveSelfExclusionUntil(
  duration: SelfExclusionDuration,
  minMonths: number
): Date | null {
  const now = new Date();
  switch (duration) {
    case "6months":
      return addMonths(now, Math.max(6, minMonths));
    case "1year":
      return addMonths(now, 12);
    case "5years":
      return addMonths(now, 60);
    case "permanent":
      return null;
    default:
      return addMonths(now, minMonths);
  }
}

export function resolveEffectiveSelfExclusion(
  profile: Pick<IProfile, "selfExcluded" | "selfExcludedUntil">
): EffectiveSelfExclusion {
  if (!profile.selfExcluded) {
    return { effective: false, isPermanent: false, until: profile.selfExcludedUntil ?? null };
  }

  const until = profile.selfExcludedUntil ?? null;
  if (until === null) {
    return { effective: true, isPermanent: true, until: null };
  }

  const effective = until > new Date();
  return { effective, isPermanent: false, until };
}

export async function syncAuthBanState(
  userId: string,
  opts: { banned: boolean; banReason?: string; banExpires?: Date | null; revokeSessions?: boolean }
): Promise<void> {
  const mongoose = await dbConnect();
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database not connected");

  if (opts.banned) {
    await db.collection("user").updateOne(
      { _id: userId as any },
      {
        $set: {
          banned: true,
          banReason: opts.banReason ?? "Self-exclusion",
          banExpires: opts.banExpires ?? null,
          updatedAt: new Date(),
        },
      }
    );
    void invalidateUser(userId).catch(() => {});
    if (opts.revokeSessions !== false) {
      await db.collection("session").deleteMany({ userId });
    }
    return;
  }

  await db.collection("user").updateOne(
    { _id: userId as any },
    {
      $set: {
        banned: false,
        banExpires: null,
        banReason: null,
        updatedAt: new Date(),
      },
    }
  );
  void invalidateUser(userId).catch(() => {});
}

export async function banUserForSelfExclusion(
  userId: string,
  selfExcludedUntil: Date | null
): Promise<void> {
  let banExpires: Date | undefined;
  if (selfExcludedUntil) {
    banExpires = selfExcludedUntil;
  }

  await syncAuthBanState(userId, {
    banned: true,
    banReason: "Self-exclusion",
    banExpires,
    revokeSessions: true,
  });
}

export async function unbanUserAfterLift(userId: string): Promise<void> {
  await syncAuthBanState(userId, { banned: false, revokeSessions: true });
}

export async function applyPendingSpendLimitIfDue(userId: string): Promise<IProfile | null> {
  const profile = await Profile.findById(userId).lean<IProfile>();
  if (!profile) return null;

  if (
    profile.pendingMonthlySpendLimit == null ||
    !profile.monthlySpendLimitEffectiveAt ||
    profile.monthlySpendLimitEffectiveAt > new Date()
  ) {
    return profile;
  }

  const updated = await Profile.findByIdAndUpdate(
    userId,
    {
      $set: {
        monthlySpendLimit: profile.pendingMonthlySpendLimit,
        pendingMonthlySpendLimit: null,
        monthlySpendLimitEffectiveAt: null,
      },
    },
    { returnDocument: "after" }
  );
  void invalidateUser(userId).catch(() => {});
  return updated;
}

export async function reconcileSelfExclusionOnRead(userId: string): Promise<IProfile | null> {
  const profile = await Profile.findById(userId).lean<IProfile>();
  if (!profile) return null;

  if (!profile.selfExcluded) return profile;

  const { effective } = resolveEffectiveSelfExclusion(profile);
  if (effective) return profile;

  await Profile.findByIdAndUpdate(userId, {
    $set: {
      selfExcluded: false,
      selfExcludedUntil: null,
      selfExcludedAt: null,
    },
  });
  void invalidateUser(userId).catch(() => {});
  await unbanUserAfterLift(userId);

  // Auto-reject any pending override requests when self-exclusion expires
  await rejectPendingOverrideRequests(userId);

  return Profile.findById(userId).lean<IProfile>();
}

async function rejectPendingOverrideRequests(userId: string): Promise<void> {
  try {
    const { SelfExclusionOverrideRequest } = await import("@oc/api-db/models");
    await SelfExclusionOverrideRequest.updateMany(
      { userId, status: "pending" },
      {
        $set: {
          status: "rejected",
          adminNote: "Self-exclusion lifted (auto-rejected)",
          processedAt: new Date(),
        },
      }
    );
    void invalidateUser(userId).catch(() => {});
  } catch {
    // Gracefully handle — audit log write not needed for auto-reject
  }
}

export async function writeComplianceAuditLog(input: {
  actorId: string | null;
  targetUserId: string | null;
  action: string;
  reason: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  source: ComplianceAuditSource;
}): Promise<void> {
  await ComplianceAuditLog.create({
    actorId: input.actorId,
    targetUserId: input.targetUserId,
    action: input.action,
    reason: input.reason,
    before: input.before,
    after: input.after,
    source: input.source,
  });
  if (input.targetUserId) void invalidateUser(input.targetUserId).catch(() => {});
}

function snapshotComplianceFields(profile: ProfileComplianceFields): Record<string, unknown> {
  return {
    monthlySpendLimit: profile.monthlySpendLimit ?? null,
    pendingMonthlySpendLimit: profile.pendingMonthlySpendLimit ?? null,
    monthlySpendLimitEffectiveAt: profile.monthlySpendLimitEffectiveAt?.toISOString() ?? null,
    selfExcluded: profile.selfExcluded ?? false,
    selfExcludedUntil: profile.selfExcludedUntil?.toISOString() ?? null,
    selfExcludedAt: profile.selfExcludedAt?.toISOString() ?? null,
    isAgeVerified: profile.isAgeVerified ?? false,
  };
}

async function fireMarketingWebhook(
  settings: IComplianceSettings,
  payload: { email: string; userId: string; event: string }
): Promise<void> {
  if (!settings.marketingWebhookUrl) return;
  void externalWebhookAxios
    .post(settings.marketingWebhookUrl, payload, {
      headers: { "Content-Type": "application/json" },
    })
    .catch((webhookErr) => {
      console.error("Compliance marketing webhook failed:", webhookErr);
    });
}

export async function applySpendLimit(
  userId: string,
  monthlySpendLimit: number,
  opts: ApplySpendLimitOptions = {}
): Promise<IProfile> {
  if (monthlySpendLimit < 0) {
    throw new ComplianceError(ErrorCodes.VALIDATION_ERROR, "Invalid monthly spend limit", 400);
  }

  const settings = await getComplianceSettings();
  if (!isComplianceEnforcementActive(settings) || !settings.personalSpendLimitsEnabled) {
    throw new ComplianceError(ErrorCodes.FORBIDDEN, "Personal spend limits are not enabled", 403);
  }

  const profile = await Profile.findById(userId).lean<IProfile>();
  if (!profile) {
    throw new ComplianceError(ErrorCodes.NOT_FOUND, "Profile not found", 404);
  }

  const before = snapshotComplianceFields(profile);
  const currentLimit = profile.monthlySpendLimit;
  const bypassCooldown = opts.bypassCooldown === true;

  let updated: IProfile | null | undefined;
  if (currentLimit == null || monthlySpendLimit <= currentLimit || bypassCooldown) {
    updated = await Profile.findByIdAndUpdate(
      userId,
      {
        $set: {
          monthlySpendLimit,
          pendingMonthlySpendLimit: null,
          monthlySpendLimitEffectiveAt: null,
        },
      },
      { returnDocument: "after" }
    );
    void invalidateUser(userId).catch(() => {});
  } else {
    const effectiveAt = new Date();
    effectiveAt.setHours(effectiveAt.getHours() + settings.spendLimitIncreaseCooldownHours);
    updated = await Profile.findByIdAndUpdate(
      userId,
      {
        $set: {
          pendingMonthlySpendLimit: monthlySpendLimit,
          monthlySpendLimitEffectiveAt: effectiveAt,
        },
      },
      { returnDocument: "after" }
    );
    void invalidateUser(userId).catch(() => {});
  }

  if (!updated) {
    throw new ComplianceError(ErrorCodes.NOT_FOUND, "Profile not found", 404);
  }

  if (opts.reason && opts.actorId) {
    await writeComplianceAuditLog({
      actorId: opts.actorId,
      targetUserId: userId,
      action: "set_spend_limit",
      reason: opts.reason,
      before,
      after: snapshotComplianceFields(updated),
      source: opts.source ?? "admin",
    });

    if (opts.source === "admin") {
      await fireMarketingWebhook(settings, {
        email: updated.email,
        userId,
        event: "spend_limit_admin_override",
      });
    }
  }

  return updated;
}

export async function cancelPendingSpendIncrease(
  userId: string,
  opts: CancelPendingSpendIncreaseOptions = {}
): Promise<IProfile> {
  const profile = await Profile.findById(userId).lean<IProfile>();
  if (!profile) {
    throw new ComplianceError(ErrorCodes.NOT_FOUND, "Profile not found", 404);
  }

  const before = snapshotComplianceFields(profile);

  const updated = await Profile.findByIdAndUpdate(
    userId,
    {
      $set: {
        pendingMonthlySpendLimit: null,
        monthlySpendLimitEffectiveAt: null,
      },
    },
    { returnDocument: "after" }
  );
  void invalidateUser(userId).catch(() => {});
  if (!updated) {
    throw new ComplianceError(ErrorCodes.NOT_FOUND, "Profile not found", 404);
  }

  if (opts.reason && opts.actorId) {
    await writeComplianceAuditLog({
      actorId: opts.actorId,
      targetUserId: userId,
      action: "clear_pending_spend_limit",
      reason: opts.reason,
      before,
      after: snapshotComplianceFields(updated),
      source: "admin",
    });
  }

  return updated;
}

export async function applySelfExclusion(
  userId: string,
  duration: SelfExclusionDuration,
  opts: ApplySelfExclusionOptions = {}
): Promise<{ selfExcludedUntil: Date | null }> {
  const settings = await getComplianceSettings();
  if (!isComplianceEnforcementActive(settings) || !settings.selfExclusionEnabled) {
    throw new ComplianceError(ErrorCodes.FORBIDDEN, "Self-exclusion is not enabled", 403);
  }

  const profile = await Profile.findById(userId).lean();
  if (!profile) {
    throw new ComplianceError(ErrorCodes.NOT_FOUND, "Profile not found", 404);
  }

  const before = snapshotComplianceFields(profile as ProfileComplianceFields);
  const now = new Date();

  // Apply immediately
  const selfExcludedUntil = resolveSelfExclusionUntil(duration, settings.selfExclusionMinMonths);

  await Profile.findByIdAndUpdate(userId, {
    $set: {
      selfExcluded: true,
      selfExcludedUntil,
      selfExcludedAt: now,
      selfExclusionScheduledAt: null,
      selfExclusionRequestedAt: null,
      marketingConsent: false,
    },
  });
  void invalidateUser(userId).catch(() => {});

  await banUserForSelfExclusion(userId, selfExcludedUntil);

  const updated = await Profile.findById(userId).lean();
  if (!updated) {
    throw new ComplianceError(ErrorCodes.NOT_FOUND, "Profile not found", 404);
  }

  if (opts.reason) {
    await writeComplianceAuditLog({
      actorId: opts.actorId ?? null,
      targetUserId: userId,
      action: "impose_self_exclusion",
      reason: opts.reason,
      before,
      after: snapshotComplianceFields(updated as ProfileComplianceFields),
      source: opts.source ?? "user",
    });
  }

  const webhookEvent = opts.source === "admin" ? "self_exclusion_admin_imposed" : "self_excluded";

  if (opts.sendWebhook !== false) {
    await fireMarketingWebhook(settings, {
      email: profile.email,
      userId,
      event: webhookEvent,
    });
  }

  return { selfExcludedUntil };
}

export async function liftSelfExclusion(
  userId: string,
  opts: LiftSelfExclusionOptions = {}
): Promise<IProfile> {
  const profile = await Profile.findById(userId).lean<IProfile>();
  if (!profile) {
    throw new ComplianceError(ErrorCodes.NOT_FOUND, "Profile not found", 404);
  }

  const exclusion = resolveEffectiveSelfExclusion(profile);
  if (!profile.selfExcluded && !exclusion.effective) {
    throw new ComplianceError(ErrorCodes.VALIDATION_ERROR, "User is not self-excluded", 400);
  }

  if (exclusion.isPermanent && !opts.acknowledgePermanent) {
    throw new ComplianceError(
      ErrorCodes.VALIDATION_ERROR,
      "Permanent self-exclusion requires acknowledgePermanent",
      400
    );
  }

  const before = snapshotComplianceFields(profile);

  const [updated, _] = await Promise.all([
    Profile.findByIdAndUpdate(
      userId,
      {
        $set: {
          selfExcluded: false,
          selfExcludedUntil: null,
          selfExcludedAt: null,
        },
      },
      { returnDocument: "after" }
    ).then((res) => {
      void invalidateUser(userId).catch(() => {});
      return res;
    }),
    unbanUserAfterLift(userId),
  ]);

  // Ensure profile is fully consistent after lift
  await reconcileSelfExclusionOnRead(userId);
  await rejectPendingOverrideRequests(userId);

  if (!updated) {
    throw new ComplianceError(ErrorCodes.NOT_FOUND, "Profile not found", 404);
  }

  if (opts.reason) {
    await writeComplianceAuditLog({
      actorId: opts.actorId ?? null,
      targetUserId: userId,
      action: "lift_self_exclusion",
      reason: opts.reason,
      before,
      after: snapshotComplianceFields(updated),
      source: opts.source ?? "admin",
    });
  }

  if (opts.sendWebhook !== false && opts.source === "admin") {
    const settings = await getComplianceSettings();
    await fireMarketingWebhook(settings, {
      email: updated.email,
      userId,
      event: "self_exclusion_admin_lifted",
    });
  }

  opts.onLifted?.(userId);

  return updated;
}

export async function setAgeVerified(
  userId: string,
  isAgeVerified: boolean,
  opts: { actorId: string; reason: string }
): Promise<IProfile> {
  const profile = await Profile.findById(userId).lean<IProfile>();
  if (!profile) {
    throw new ComplianceError(ErrorCodes.NOT_FOUND, "Profile not found", 404);
  }

  const before = snapshotComplianceFields(profile);

  const updated = await Profile.findByIdAndUpdate(
    userId,
    {
      $set: {
        isAgeVerified,
        ageVerifiedAt: isAgeVerified ? new Date() : null,
        ageVerificationMethod: isAgeVerified ? "admin" : null,
      },
    },
    { returnDocument: "after" }
  );
  void invalidateUser(userId).catch(() => {});
  if (!updated) {
    throw new ComplianceError(ErrorCodes.NOT_FOUND, "Profile not found", 404);
  }

  await writeComplianceAuditLog({
    actorId: opts.actorId,
    targetUserId: userId,
    action: "set_age_verified",
    reason: opts.reason,
    before,
    after: snapshotComplianceFields(updated),
    source: "admin",
  });

  return updated;
}

export async function buildSaferPlayState(userId: string) {
  const settings = await getComplianceSettings();
  await reconcileSelfExclusionOnRead(userId);
  const profile = await applyPendingSpendLimitIfDue(userId);
  if (!profile) {
    return {
      monthlySpendLimit: null,
      pendingMonthlySpendLimit: null,
      selfExclusion: null,
      selfExcluded: false,
      effectiveSelfExcluded: false,
      selfExcludedUntil: null,
      pendingOverrideRequest: false,
      spendLimitRequired: false,
      creditCardMonthlyLimitEnabled: false,
      creditCardSpendThisMonth: 0,
      monthlySpendThisMonth: 0,
      completedOrderCount: 0,
      requestedExclusionDuration: null,
      spendLimitEnforced: false,
    };
  }

  const exclusion = resolveEffectiveSelfExclusion(profile);

  // Check for pending override request
  const { SelfExclusionOverrideRequest } = await import("@oc/api-db/models");
  const pendingOverride = await SelfExclusionOverrideRequest.findOne({
    userId: profile._id,
    status: "pending",
  }).lean();

  const [monthlySpendThisMonth, creditCardSpendThisMonth, completedOrderCount] = await Promise.all([
    getUserMonthlySpendAllMethods(userId),
    getUserCreditCardSpendThisMonth(userId),
    getUserCompletedOrderCount(userId),
  ]);

  const enforcementActive = isComplianceEnforcementActive(settings);
  const creditCardMonthlyLimitEnabled = enforcementActive && settings.creditCardMonthlyLimitEnabled;
  return {
    monthlySpendLimit: profile.monthlySpendLimit ?? null,
    pendingMonthlySpendLimit: profile.pendingMonthlySpendLimit ?? null,
    monthlySpendLimitEffectiveAt: profile.monthlySpendLimitEffectiveAt?.toISOString() ?? null,
    monthlySpendThisMonth,
    creditCardSpendThisMonth,
    creditCardMonthlyLimitGBP: creditCardMonthlyLimitEnabled
      ? settings.creditCardMonthlyLimitGBP
      : null,
    creditCardMonthlyLimitEnabled,
    selfExcluded: profile.selfExcluded ?? false,
    effectiveSelfExcluded: exclusion.effective,
    selfExcludedUntil: profile.selfExcludedUntil?.toISOString() ?? null,
    selfExcludedAt: profile.selfExcludedAt?.toISOString() ?? null,
    hasPendingOverrideRequest: !!pendingOverride,
    personalSpendLimitsEnabled: enforcementActive && settings.personalSpendLimitsEnabled,
    spendLimitIncreaseCooldownHours: settings.spendLimitIncreaseCooldownHours,
    selfExclusionEnabled: enforcementActive && settings.selfExclusionEnabled,
    selfExclusionMinMonths: settings.selfExclusionMinMonths,
    completedOrderCount,
    spendLimitRequired: false,
  };
}

export async function buildAdminUserComplianceState(userId: string) {
  const settings = await getComplianceSettings();
  await reconcileSelfExclusionOnRead(userId);
  const profile = await applyPendingSpendLimitIfDue(userId);
  if (!profile) {
    throw new ComplianceError(ErrorCodes.NOT_FOUND, "Profile not found", 404);
  }

  const exclusion = resolveEffectiveSelfExclusion(profile);

  const [monthlySpendThisMonth, creditCardSpendThisMonth, completedOrderCount] = await Promise.all([
    getUserMonthlySpendAllMethods(userId),
    getUserCreditCardSpendThisMonth(userId),
    getUserCompletedOrderCount(userId),
  ]);

  const enforcementActive = isComplianceEnforcementActive(settings);
  const spendLimitRequired =
    enforcementActive &&
    settings.personalSpendLimitsEnabled &&
    completedOrderCount >= 1 &&
    profile.monthlySpendLimit == null;

  const { SelfExclusionOverrideRequest } = await import("@oc/api-db/models");
  const pendingOverride = await SelfExclusionOverrideRequest.findOne({
    userId: profile._id,
    status: "pending",
  }).lean();

  return {
    userId,
    email: profile.email,
    isAgeVerified: profile.isAgeVerified ?? false,
    ageVerifiedAt: profile.ageVerifiedAt?.toISOString() ?? null,
    monthlySpendLimit: profile.monthlySpendLimit ?? null,
    pendingMonthlySpendLimit: profile.pendingMonthlySpendLimit ?? null,
    monthlySpendLimitEffectiveAt: profile.monthlySpendLimitEffectiveAt?.toISOString() ?? null,
    monthlySpendThisMonth,
    creditCardSpendThisMonth,
    creditCardMonthlyLimitGBP:
      enforcementActive && settings.creditCardMonthlyLimitEnabled
        ? settings.creditCardMonthlyLimitGBP
        : null,
    selfExcluded: profile.selfExcluded ?? false,
    effectiveSelfExcluded: exclusion.effective,
    selfExcludedPermanent: exclusion.isPermanent,
    selfExcludedUntil: profile.selfExcludedUntil?.toISOString() ?? null,
    selfExcludedAt: profile.selfExcludedAt?.toISOString() ?? null,
    hasPendingOverrideRequest: !!pendingOverride,
    spendLimitRequired,
    completedOrderCount,
    featureFlags: {
      enforcementActive,
      ageVerificationEnabled: enforcementActive && settings.ageVerificationEnabled,
      personalSpendLimitsEnabled: enforcementActive && settings.personalSpendLimitsEnabled,
      selfExclusionEnabled: enforcementActive && settings.selfExclusionEnabled,
      creditCardMonthlyLimitEnabled: enforcementActive && settings.creditCardMonthlyLimitEnabled,
    },
  };
}

export function assertNotEffectivelySelfExcluded(
  profile: Pick<IProfile, "selfExcluded" | "selfExcludedUntil">,
  settings: IComplianceSettings
): void {
  if (!settings.selfExclusionEnabled) return;
  const { effective } = resolveEffectiveSelfExclusion(profile);
  if (!effective) return;

  throw new ComplianceError(
    ErrorCodes.ACCOUNT_SELF_EXCLUDED,
    "Your account is self-excluded. You cannot enter competitions during this period.",
    403
  );
}

export async function createSelfExclusionOverrideRequest(
  userId: string,
  userReason: string
): Promise<{ requestId: string }> {
  const profile = await Profile.findById(userId).lean<IProfile>();
  if (!profile) {
    throw new ComplianceError(ErrorCodes.NOT_FOUND, "Profile not found", 404);
  }

  const exclusion = resolveEffectiveSelfExclusion(profile);
  if (!exclusion.effective && !profile.selfExcluded) {
    throw new ComplianceError(
      ErrorCodes.VALIDATION_ERROR,
      "You are not currently self-excluded",
      400
    );
  }

  const { SelfExclusionOverrideRequest } = await import("@oc/api-db/models");

  const existing = await SelfExclusionOverrideRequest.findOne({
    userId: profile._id,
    status: "pending",
  }).lean();

  if (existing) {
    throw new ComplianceError(
      ErrorCodes.VALIDATION_ERROR,
      "You already have a pending override request",
      400
    );
  }

  const request = await SelfExclusionOverrideRequest.create({
    userId: profile._id,
    status: "pending",
    userReason,
  });
  void invalidateUser(userId).catch(() => {});

  return { requestId: request._id.toString() };
}
