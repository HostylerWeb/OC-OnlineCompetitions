import { z } from "zod";
import { ukCountryCodeOptionalSchema } from "./address";

const selfExclusionDurationSchema = z.enum(["6months", "1year", "5years", "permanent"]);

const reasonSchema = z.string().trim().min(10, "Reason must be at least 10 characters");

export const adminComplianceOverrideSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set_spend_limit"),
    reason: reasonSchema,
    monthlySpendLimit: z.number().min(0),
    bypassCooldown: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("clear_pending_spend_limit"),
    reason: reasonSchema,
  }),
  z.object({
    action: z.literal("impose_self_exclusion"),
    reason: reasonSchema,
    duration: selfExclusionDurationSchema,
  }),
  z.object({
    action: z.literal("lift_self_exclusion"),
    reason: reasonSchema,
    acknowledgePermanent: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("set_age_verified"),
    reason: reasonSchema,
    isAgeVerified: z.boolean(),
  }),
]);

export const adminComplianceAuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const adminUserProfilePatchSchema = z.object({
  reason: reasonSchema,
  email: z.string().trim().email().optional(),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(30).optional(),
  addressLine1: z.string().trim().max(200).optional(),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  postcode: z.string().trim().max(20).optional(),
  country: ukCountryCodeOptionalSchema,
  marketingConsent: z.boolean().optional(),
  dateOfBirth: z.string().datetime().optional(),
});

export const adminComplianceSettingsUpdateSchema = z.object({
  reason: reasonSchema,
  masterEnabled: z.boolean().optional(),
  ageVerificationEnabled: z.boolean().optional(),
  ageVerificationMinAge: z.number().optional(),
  ageVerificationProvider: z.string().optional(),
  creditCardMonthlyLimitEnabled: z.boolean().optional(),
  creditCardMonthlyLimitGBP: z.number().optional(),
  instantWinCreditCardBanEnabled: z.boolean().optional(),
  personalSpendLimitsEnabled: z.boolean().optional(),
  spendLimitIncreaseCooldownHours: z.number().optional(),
  selfExclusionEnabled: z.boolean().optional(),
  selfExclusionMinMonths: z.number().optional(),
  marketingWebhookUrl: z.string().optional().or(z.literal("")),
  postalEntryAddress: z.string().optional(),
  postalEntryProminenceEnabled: z.boolean().optional(),
  compliancePageEnabled: z.boolean().optional(),
  guestCheckoutEnabled: z.boolean().optional(),
  allowZeroSubtotalOrders: z.boolean().optional(),
  minimumOrderValue: z.number().min(0).optional(),
});

export const createOverrideRequestSchema = z.object({
  reason: z.string().trim().min(10, "Reason must be at least 10 characters"),
});

export const userSpendLimitUpdateSchema = z.object({
  monthlySpendLimit: z
    .number()
    .finite("Monthly spend limit must be a finite number")
    .min(0, "Monthly spend limit cannot be negative")
    .max(1_000_000, "Monthly spend limit exceeds maximum allowed value"),
});

export const processOverrideRequestSchema = z.object({
  action: z.enum(["approve", "reject"]),
  adminNote: z.string().trim().min(1).optional(),
});

export const adminLiftSelfExclusionSchema = z.object({
  reason: reasonSchema,
  acknowledgePermanent: z.boolean().optional(),
});

export type AdminLiftSelfExclusionInput = z.infer<typeof adminLiftSelfExclusionSchema>;

export type AdminComplianceOverrideInput = z.infer<typeof adminComplianceOverrideSchema>;
export type AdminUserProfilePatchInput = z.infer<typeof adminUserProfilePatchSchema>;
export type AdminComplianceSettingsUpdateInput = z.infer<
  typeof adminComplianceSettingsUpdateSchema
>;
