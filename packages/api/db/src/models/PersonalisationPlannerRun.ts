import { Schema } from "mongoose";
import type { AiPersonalisationSettings, PersonalisationPlannerRunStatus } from "@oc/types";
import { m } from "../db";

export interface IPersonalisationPlannerRun {
  runId: string;
  startedAt: Date;
  completedAt?: Date;
  status: PersonalisationPlannerRunStatus;
  usersEligible: number;
  usersPlanned: number;
  llmBatches: number;
  tokensIn: number;
  tokensOut: number;
  estimatedCostUsd: number;
  runErrors: string[];
  settingsSnapshot?: Partial<AiPersonalisationSettings>;
  dryRun: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PersonalisationPlannerRunSchema = new Schema<IPersonalisationPlannerRun>(
  {
    runId: { type: String, required: true, unique: true },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date },
    status: {
      type: String,
      enum: ["running", "completed", "failed", "skipped"],
      default: "running",
    },
    usersEligible: { type: Number, default: 0 },
    usersPlanned: { type: Number, default: 0 },
    llmBatches: { type: Number, default: 0 },
    tokensIn: { type: Number, default: 0 },
    tokensOut: { type: Number, default: 0 },
    estimatedCostUsd: { type: Number, default: 0 },
    runErrors: { type: [String], default: [] },
    settingsSnapshot: { type: Schema.Types.Mixed },
    dryRun: { type: Boolean, default: false },
  },
  { timestamps: true }
);

PersonalisationPlannerRunSchema.index({ startedAt: -1 });

export const PersonalisationPlannerRun = m<IPersonalisationPlannerRun>(
  "PersonalisationPlannerRun",
  PersonalisationPlannerRunSchema
);
