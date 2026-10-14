import { Schema } from "mongoose";
import { m } from "../db";

export interface IUserActivityDay {
  userId: string;
  day: string;
  lastSeenAt: Date;
  categorySlugs: string[];
}

const UserActivityDaySchema = new Schema<IUserActivityDay>(
  {
    userId: { type: String, required: true },
    day: { type: String, required: true },
    lastSeenAt: { type: Date, required: true },
    categorySlugs: { type: [String], default: [] },
  },
  { timestamps: true }
);

UserActivityDaySchema.index({ userId: 1, day: 1 }, { unique: true });
UserActivityDaySchema.index({ day: 1, lastSeenAt: -1 });

export const UserActivityDay = m<IUserActivityDay>("UserActivityDay", UserActivityDaySchema);
