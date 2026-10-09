import { Schema } from "mongoose";
import { m } from "../db";

import { LEGAL_POSTAL_ADDRESS } from "@oc/utils";

const DEFAULT_POSTAL_ADDRESS = LEGAL_POSTAL_ADDRESS;

const ComplianceSettingsSchema = new Schema(
  {
    _id: { type: String, required: true, enum: ["compliance_settings"] },
    masterEnabled: { type: Boolean, default: false },
    ageVerificationEnabled: { type: Boolean, default: false },
    ageVerificationMinAge: { type: Number, default: 18 },
    ageVerificationProvider: { type: String, default: "" },
    creditCardMonthlyLimitEnabled: { type: Boolean, default: false },
    creditCardMonthlyLimitGBP: { type: Number, default: 250 },
    instantWinCreditCardBanEnabled: { type: Boolean, default: false },
    personalSpendLimitsEnabled: { type: Boolean, default: false },
    spendLimitIncreaseCooldownHours: { type: Number, default: 24 },
    selfExclusionEnabled: { type: Boolean, default: false },
    selfExclusionMinMonths: { type: Number, default: 6 },
    marketingWebhookUrl: { type: String, default: "" },
    postalEntryAddress: { type: String, default: DEFAULT_POSTAL_ADDRESS },
    postalEntryProminenceEnabled: { type: Boolean, default: true },
    compliancePageEnabled: { type: Boolean, default: false },
    guestCheckoutEnabled: { type: Boolean, default: true },
    allowZeroSubtotalOrders: { type: Boolean, default: true },
    minimumOrderValue: { type: Number, default: 0 },
  },
  { timestamps: false, _id: false }
);

export interface IComplianceSettings {
  _id: "compliance_settings";
  masterEnabled: boolean;
  ageVerificationEnabled: boolean;
  ageVerificationMinAge: number;
  ageVerificationProvider?: string;
  creditCardMonthlyLimitEnabled: boolean;
  creditCardMonthlyLimitGBP: number;
  instantWinCreditCardBanEnabled: boolean;
  personalSpendLimitsEnabled: boolean;
  spendLimitIncreaseCooldownHours: number;
  selfExclusionEnabled: boolean;
  selfExclusionMinMonths: number;
  marketingWebhookUrl?: string;
  postalEntryAddress: string;
  postalEntryProminenceEnabled: boolean;
  compliancePageEnabled: boolean;
  guestCheckoutEnabled: boolean;
  allowZeroSubtotalOrders: boolean;
  minimumOrderValue: number;
}

export const DEFAULT_COMPLIANCE_SETTINGS: IComplianceSettings = {
  _id: "compliance_settings",
  masterEnabled: false,
  ageVerificationEnabled: false,
  ageVerificationMinAge: 18,
  ageVerificationProvider: "",
  creditCardMonthlyLimitEnabled: false,
  creditCardMonthlyLimitGBP: 250,
  instantWinCreditCardBanEnabled: false,
  personalSpendLimitsEnabled: false,
  spendLimitIncreaseCooldownHours: 24,
  selfExclusionEnabled: false,
  selfExclusionMinMonths: 6,
  marketingWebhookUrl: "",
  postalEntryAddress: DEFAULT_POSTAL_ADDRESS,
  postalEntryProminenceEnabled: true,
  compliancePageEnabled: false,
  guestCheckoutEnabled: true,
  allowZeroSubtotalOrders: true,
  minimumOrderValue: 0,
};

export const ComplianceSettings = m<IComplianceSettings>(
  "ComplianceSettings",
  ComplianceSettingsSchema
);
