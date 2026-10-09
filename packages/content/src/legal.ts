import {
  BRAND_NAME,
  LEGAL_COMPANY_NAME,
  LEGAL_COMPANY_NUMBER,
  LEGAL_REGISTERED_OFFICE,
  LEGAL_WEBSITE,
} from "./brand";

export const LEGAL_SITE_NAME = BRAND_NAME;

export const termsIntro = {
  title: "Terms & Conditions",
  lastUpdated: "May 2026",
  companyName: LEGAL_COMPANY_NAME,
  companyNumber: LEGAL_COMPANY_NUMBER,
  registeredOffice: LEGAL_REGISTERED_OFFICE,
  website: LEGAL_WEBSITE,
  pageSubtitle: "Draw Entry Terms and Conditions",
};

export const privacyIntro = {
  title: "Privacy Policy",
  lastUpdated: "May 2026",
  dataController: LEGAL_COMPANY_NAME,
};

export const cookiePolicyIntro = {
  title: "Cookie Policy",
  lastUpdated: "May 2026",
};

export { cookiePolicySections } from "./legal/cookie-policy-sections";
export { privacySections } from "./legal/privacy-sections";
export { termsSections } from "./legal/terms-sections";
