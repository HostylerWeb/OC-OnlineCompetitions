import { z } from "zod";

export const UK_COUNTRY_CODE = "GB";

const UK_ONLY_MESSAGE = "Only United Kingdom addresses are accepted";

export const ukCountryCodeSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => v === UK_COUNTRY_CODE, { message: UK_ONLY_MESSAGE });

export const ukCountryCodeOptionalSchema = z
  .union([z.undefined(), z.literal(""), z.string()])
  .transform((v) => {
    if (v === undefined || v === "") return UK_COUNTRY_CODE;
    return v.trim().toUpperCase();
  })
  .pipe(ukCountryCodeSchema);
