import { Schema } from "mongoose";
import { m } from "../db";

const SeoSettingsSchema = new Schema(
  {
    _id: { type: String, required: true, enum: ["seo_settings"] },
    defaultOgImageUrl: { type: String, default: "" },
    referralOgImageUrl: { type: String, default: "" },
    defaultTitle: {
      type: String,
      default: "Online Competitions — Win Amazing Prizes & Luxury Experiences",
    },
    defaultDescription: {
      type: String,
      default:
        "Enter competitions on Online Competitions to win incredible prizes, from premium electronics and designer fashion to unforgettable luxury experiences. Play skill-based contests and try instant win games.",
    },
  },
  { timestamps: false, _id: false }
);

export interface ISeoSettings {
  _id: "seo_settings";
  defaultOgImageUrl?: string;
  referralOgImageUrl?: string;
  defaultTitle: string;
  defaultDescription: string;
  updatedAt?: Date;
}

export const SeoSettings = m<ISeoSettings>("SeoSettings", SeoSettingsSchema);
