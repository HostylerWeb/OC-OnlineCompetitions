import { BRAND_NAME, LEGAL_CONTACT_EMAIL } from "@oc/utils";
import mongoose, { Schema } from "mongoose";

const EmailSettingsSchema = new Schema(
  {
    _id: { type: String, required: true, enum: ["email_settings"] },
    fromName: { type: String, default: BRAND_NAME },
    fromEmail: { type: String, default: LEGAL_CONTACT_EMAIL },
    supportAddress: { type: String, default: LEGAL_CONTACT_EMAIL },
    social: {
      facebook: { type: String, default: "" },
      instagram: { type: String, default: "" },
      whatsapp: { type: String, default: "" },
      telegram: { type: String, default: "" },
      tiktok: { type: String, default: "" },
    },
  },
  { timestamps: false, _id: false }
);

export interface IEmailSettings {
  _id: "email_settings";
  fromName: string;
  fromEmail: string;
  supportAddress: string;
  social: {
    facebook: string;
    instagram: string;
    whatsapp: string;
    telegram: string;
    tiktok: string;
  };
  updatedAt?: Date;
}

export const EmailSettings =
  mongoose.models.EmailSettings ??
  mongoose.model<IEmailSettings>("EmailSettings", EmailSettingsSchema);
