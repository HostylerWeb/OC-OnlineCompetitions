import { Schema } from "mongoose";
import type { UserPersonalisationFeatureSnapshot } from "@oc/types";
import { m } from "../db";

export interface IUserPersonalisationFeatures extends UserPersonalisationFeatureSnapshot {
  runId: string;
  updatedAt: Date;
}

const UserPersonalisationFeaturesSchema = new Schema<IUserPersonalisationFeatures>(
  {
    userId: { type: String, required: true },
    runId: { type: String, required: true, index: true },
    totalSpent: { type: Number, default: 0 },
    totalEntries: { type: Number, default: 0 },
    topCategorySlugs: { type: [String], default: [] },
    lastOrderAt: { type: Date },
    walletBalanceBand: {
      type: String,
      enum: ["zero", "low", "medium", "high"],
      default: "zero",
    },
    referralBand: { type: String, enum: ["none", "active"], default: "none" },
    marketingConsent: { type: Boolean, default: false },
    selfExcluded: { type: Boolean, default: false },
    selfExcludedUntil: { type: Date, default: null },
    hasActiveSpendLimit: { type: Boolean, default: false },
    isGuestCheckout: { type: Boolean, default: false },
    eligibleForLlm: { type: Boolean, default: false },
  },
  { timestamps: true }
);

UserPersonalisationFeaturesSchema.index({ userId: 1 }, { unique: true });
UserPersonalisationFeaturesSchema.index({ runId: 1, eligibleForLlm: 1 });

export const UserPersonalisationFeatures = m<IUserPersonalisationFeatures>(
  "UserPersonalisationFeatures",
  UserPersonalisationFeaturesSchema
);
