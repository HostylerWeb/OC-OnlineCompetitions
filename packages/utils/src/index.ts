export {
  BRAND_NAME,
  BRAND_LOGO_CLASS,
  BRAND_LOGO_CLASS_COMPACT,
  BRAND_LOGO_CLASS_SQUARE,
  BRAND_FAVICON_PATH,
  BRAND_LOGO_PATH,
  BRAND_NAME_SHORT,
  brandLogoUrl,
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_HOURS,
  CONTACT_PHONE_TEL,
  getFooterCopyright,
  getMailtoContact,
  LEGAL_COMPANY_NAME,
  LEGAL_COMPANY_NUMBER,
  LEGAL_COMPANY_NUMBER_LABEL,
  LEGAL_COMPANY_REGISTRATION_LINE,
  LEGAL_CONTACT_EMAIL,
  LEGAL_POSTAL_ADDRESS,
  LEGAL_REGISTERED_OFFICE,
  LEGAL_REGISTERED_OFFICE_LINES,
  LEGAL_REGISTERED_OFFICE_POSTAL,
  LEGAL_SUPPORT_EMAIL,
  LEGAL_WEBSITE,
  LEGAL_WEBSITE_URL,
} from "./company";
export {
  formatDateIso,
  getDefaultBirthDate,
  getLatestAllowedBirthDate,
  isDobAtLeastMinAge,
  parseIsoDate,
} from "./age-validation";
export { cn } from "./cn";
export type { TicketAvailabilityFields, TicketQuantityLimits, TimeLeft } from "./competition";
export {
  clampCartQuantity,
  formatCurrency,
  formatMaxTicketsReason,
  formatTicketLimitWarning,
  formatTimeLeft,
  getAvailableTickets,
  getCompetitionCountdownTarget,
  getGrantedTicketIds,
  getMaxCartQuantity,
  getMaxPurchasable,
  getMaxTickets,
  getProgress,
  getTicketsSold,
  getTicketsTaken,
} from "./competition";
export { CountdownLabel, type CountdownLabelProps } from "./countdown-label";
export type {
  EndingSoonCombineMode,
  EndingSoonCompetition,
  EndingSoonSettings,
  EndingSoonTicketsMetric,
  ResolvedEndingSoonSettings,
} from "./ending-soon";
export {
  compareEndingSoonUrgency,
  DEFAULT_ENDING_SOON_DAYS_THRESHOLD,
  DEFAULT_ENDING_SOON_TICKETS_THRESHOLD,
  filterEndingSoonCompetitions,
  getCompetitionEndDate,
  isEndingSoonCompetition,
  resolveEndingSoonSettings,
} from "./ending-soon";
export {
  formatOrderNumber,
  formatTicketNumber,
  getDisplayName,
  getProfileInitials,
} from "./format";
export {
  formatDate,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercentage,
  formatRelativeTime,
  roundCurrency,
} from "./format-utils";
export type {
  NavHomepageSection,
  ResolvedHomepageSection,
  ResolveHomepageSectionsContext,
} from "./homepage-layout";
export {
  HOMEPAGE_SECTION_LABELS,
  resolveHomepageNavSections,
  resolveHomepageSections,
} from "./homepage-layout";
export { OrderNumberCell, type OrderNumberCellProps } from "./order-number-cell";
export {
  getReferralCodeFromCookie,
  getReferralCookie,
  REFERRAL_COOKIE_NAME,
  setReferralCookie,
} from "./referral";
export { getCookieEnvTag, getSessionCookiePrefix } from "./session-cookie";
export type { SocialIconName, SocialLink } from "./social";
export { DEFAULT_SOCIAL_URLS, SOCIAL_LINKS } from "./social";
export {
  assetCacheVersion,
  getCompetitionImageUrl,
  withAssetCacheVersion,
} from "./asset-cache-url";
export { getPublicWinnerImageUrl, getPublicWinnerImageUrls } from "./winner-image";
export { HOSTYLER_CONSOLE_NOTICE_INLINE } from "./hostyler-console-notice";
export { hostylerConsoleNoticeIndexHtmlPlugin } from "./vite-hostyler-console-notice-plugin";
