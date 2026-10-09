/**
 * Single source of truth for public company / contact details.
 * Change values here to update the site, legal copy, emails, and defaults.
 */
export const BRAND_NAME = "Online Competitions";
export const BRAND_NAME_SHORT = BRAND_NAME;

export const LEGAL_COMPANY_NAME = "ONLINE COMPETITIONS LTD";
export const LEGAL_COMPANY_NUMBER = "SC729481";
/** Display line for forms and about sections */
export const LEGAL_COMPANY_NUMBER_LABEL = `Company No. ${LEGAL_COMPANY_NUMBER} (Scotland)`;
export const LEGAL_COMPANY_REGISTRATION_LINE = `${LEGAL_COMPANY_NAME} — ${LEGAL_COMPANY_NUMBER_LABEL}`;

export const LEGAL_REGISTERED_OFFICE =
  "42 Meadowbank Drive, Edinburgh, EH8 7AQ, Scotland";
export const LEGAL_REGISTERED_OFFICE_POSTAL =
  "42 Meadowbank Drive, Edinburgh, EH8 7AQ, United Kingdom";
export const LEGAL_REGISTERED_OFFICE_LINES = [
  "42 Meadowbank Drive",
  "Edinburgh, EH8 7AQ",
  "Scotland, United Kingdom",
] as const;

/** Single-line postal address (free entry, compliance defaults) */
export const LEGAL_POSTAL_ADDRESS = "42 Meadowbank Drive, Edinburgh, EH8 7AQ";

export const LEGAL_WEBSITE = "onlinecompetitions.co.uk";
export const LEGAL_WEBSITE_URL = `https://${LEGAL_WEBSITE}`;

/** Public path to the brand logo (served from each app’s `public/brand/`). */
export const BRAND_LOGO_PATH = "/brand/logo2.png";
/** Browser tab / shortcut icon (`public/favicon.png` per app). */
export const BRAND_FAVICON_PATH = "/favicon.png";
/** Default Tailwind height classes for header / nav logos */
export const BRAND_LOGO_CLASS = "h-11 w-auto md:h-14";
export const BRAND_LOGO_CLASS_COMPACT = "h-9 w-auto md:h-10";
export const BRAND_LOGO_CLASS_SQUARE = "h-11 w-11 md:h-12 md:w-12";

export function brandLogoUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}${BRAND_LOGO_PATH}`;
}

export const LEGAL_CONTACT_EMAIL = "contact@onlinecompetitions.co.uk";
export const LEGAL_SUPPORT_EMAIL = "support@onlinecompetitions.co.uk";

export const CONTACT_PHONE_DISPLAY = "123 123 1234";
export const CONTACT_PHONE_TEL = "+441231231234";
export const CONTACT_PHONE_HOURS = "Mon–Fri, 9am–5pm GMT";

export function getFooterCopyright(year: number): string {
  return `© ${year} ${LEGAL_COMPANY_NAME} ${LEGAL_COMPANY_NUMBER}. All rights reserved.`;
}

export function getMailtoContact(): string {
  return `mailto:${LEGAL_CONTACT_EMAIL}`;
}
