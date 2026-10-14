import { Schema } from "mongoose";
import type { PersonalisationAction, PersonalisationPlanPayload, PersonalisationSurface } from "@oc/types";
import { m } from "../db";

export interface IUserPersonalisationPlan {
  userId: string;
  runId: string;
  planVersion: number;
  action: PersonalisationAction;
  payload: PersonalisationPlanPayload;
  surfaces: PersonalisationSurface[];
  validFrom: Date;
  validUntil: Date;
  model: string;
  promptVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserPersonalisationPlanSchema = new Schema<IUserPersonalisationPlan>(
  {
    userId: { type: String, required: true },
    runId: { type: String, required: true, index: true },
    planVersion: { type: Number, required: true, default: 1 },
    action: {
      type: String,
      enum: ["none", "upsell_popup", "competition_highlight", "ticket_bundle_suggestion"],
      default: "none",
    },
    payload: { type: Schema.Types.Mixed, default: {} },
    surfaces: {
      type: [String],
      enum: ["home", "competition", "checkout"],
      default: [],
    },
    validFrom: { type: Date, required: true },
    validUntil: { type: Date, required: true, index: true },
    model: { type: String, default: "" },
    promptVersion: { type: String, default: "" },
  },
  { timestamps: true }
);

UserPersonalisationPlanSchema.index({ userId: 1 }, { unique: true });

export const UserPersonalisationPlan = m<IUserPersonalisationPlan>(
  "UserPersonalisationPlan",
  UserPersonalisationPlanSchema
);
