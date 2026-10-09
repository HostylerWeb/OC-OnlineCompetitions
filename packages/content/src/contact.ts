import type { ContactInfoCard } from "./content-types";
import {
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_HOURS,
  CONTACT_PHONE_TEL,
  LEGAL_COMPANY_NAME,
  LEGAL_COMPANY_NUMBER_LABEL,
  LEGAL_CONTACT_EMAIL,
  LEGAL_REGISTERED_OFFICE,
} from "@oc/utils";

export const CONTACT_EMAIL = LEGAL_CONTACT_EMAIL;
export const COMPANY_NAME = LEGAL_COMPANY_NAME;
export const COMPANY_NUMBER = LEGAL_COMPANY_NUMBER_LABEL;
export const COMPANY_ADDRESS = LEGAL_REGISTERED_OFFICE;
export const CONTACT_PHONE = CONTACT_PHONE_DISPLAY;
export { CONTACT_PHONE_HOURS };

export const contactHero = {
  title: "Get in Touch",
  subtitle: "Have a question or need help? We'd love to hear from you.",
};

export const contactFooterNote =
  "We respond within 24 hours on business days (Mon–Fri, 9am–5pm GMT).";

export const CONTACT_INFO_CARDS: Omit<ContactInfoCard, "icon">[] = [
  {
    label: "Email",
    value: CONTACT_EMAIL,
    href: `mailto:${CONTACT_EMAIL}`,
    subvalue: null,
  },
  {
    label: "Phone",
    value: CONTACT_PHONE,
    href: `tel:${CONTACT_PHONE_TEL}`,
    subvalue: CONTACT_PHONE_HOURS,
  },
  {
    label: "Address",
    value: COMPANY_ADDRESS,
    href: null,
    subvalue: null,
  },
  {
    label: "Registered",
    value: COMPANY_NAME,
    subvalue: COMPANY_NUMBER,
    href: null,
  },
];
