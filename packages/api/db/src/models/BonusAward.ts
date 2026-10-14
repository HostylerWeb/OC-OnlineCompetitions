import { type Document, Schema, type Types } from "mongoose";
import { m } from "../db";

export interface IBonusAward extends Document {
  title: string;
  description?: string;
  value?: number;
  images: string[];
  isActive: boolean;
  type: "prize" | "competition_ticket";
  prizeCategory?: "cash" | "site_credit" | "physical";
  linkedCompetitionId?: Types.ObjectId;
  ticketCount?: number;
  sourceInstantPrizeId?: Types.ObjectId;
  totalAssignments: number;
  totalWins: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
}

const BonusAwardSchema = new Schema<IBonusAward>(
  {
    title: { type: String, required: true },
    description: { type: String },
    value: { type: Number },
    images: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    type: { type: String, enum: ["prize", "competition_ticket"], default: "prize" },
    prizeCategory: {
      type: String,
      enum: ["cash", "site_credit", "physical"],
      required: false,
    },
    linkedCompetitionId: { type: Schema.Types.ObjectId, ref: "Competition" },
    ticketCount: { type: Number },
    sourceInstantPrizeId: { type: Schema.Types.ObjectId, ref: "InstantPrize" },
    totalAssignments: { type: Number, default: 0 },
    totalWins: { type: Number, default: 0 },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "Profile" },
  },
  { timestamps: true }
);

BonusAwardSchema.index({ sourceInstantPrizeId: 1 });
BonusAwardSchema.index({ deletedAt: 1, createdAt: -1 });
BonusAwardSchema.index({ title: "text", description: "text" });

export const BonusAward = m<IBonusAward>("BonusAward", BonusAwardSchema);
