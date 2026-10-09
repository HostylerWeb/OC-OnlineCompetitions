import type { HomepageSectionConfig } from "@oc/types";
import { Schema } from "mongoose";
import { m } from "../db";

const HomepageSectionConfigSchema = new Schema<HomepageSectionConfig>(
  {
    id: {
      type: String,
      required: true,
      enum: ["hero", "ending_soon", "categories", "winners", "built_different", "cta"],
    },
    enabled: { type: Boolean, required: true },
  },
  { _id: false }
);

const HomepageLayoutSettingsSchema = new Schema(
  {
    _id: { type: String, required: true, enum: ["homepage_layout_settings"] },
    sections: { type: [HomepageSectionConfigSchema], required: true },
  },
  { timestamps: false, _id: false }
);

export interface IHomepageLayoutSettings {
  _id: "homepage_layout_settings";
  sections: HomepageSectionConfig[];
}

export const HomepageLayoutSettings = m<IHomepageLayoutSettings>(
  "HomepageLayoutSettings",
  HomepageLayoutSettingsSchema
);
