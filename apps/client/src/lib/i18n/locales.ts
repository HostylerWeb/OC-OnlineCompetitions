export const SUPPORTED_LOCALES = ["en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const LOCALE_PREFIXES: Record<Locale, string> = {
  en: "/en",
};
export const localeDefault: Locale = "en";
