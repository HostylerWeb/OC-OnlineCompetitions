import type { ContactInfoCard } from "../content-types";
import {
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_HOURS,
  CONTACT_PHONE_TEL,
  LEGAL_COMPANY_NAME,
  LEGAL_COMPANY_NUMBER,
  LEGAL_CONTACT_EMAIL,
  LEGAL_REGISTERED_OFFICE,
} from "@oc/utils";

export const CONTACT_EMAIL = LEGAL_CONTACT_EMAIL;
export const COMPANY_NAME = LEGAL_COMPANY_NAME;
export const COMPANY_NUMBER = `Nr. Înreg. ${LEGAL_COMPANY_NUMBER} (Scoția)`;
export const COMPANY_ADDRESS = LEGAL_REGISTERED_OFFICE;
export const CONTACT_PHONE = CONTACT_PHONE_DISPLAY;

export const CONTACT_PHONE_HOURS_RO = "Lun–Vin, 9:00–17:00 GMT";

export const contactHero = {
  title: "Ia legătura",
  subtitle: "Ai o întrebare sau ai nevoie de ajutor? Am fi încântați să auzim de la tine.",
};

export const contactFooterNote =
  "Răspundem în maxim 24 de ore în zilele lucrătoare (Lun–Vin, 9:00–17:00 GMT).";

export const CONTACT_INFO_CARDS: Omit<ContactInfoCard, "icon">[] = [
  {
    label: "Email",
    value: CONTACT_EMAIL,
    href: `mailto:${CONTACT_EMAIL}`,
    subvalue: null,
  },
  {
    label: "Telefon",
    value: CONTACT_PHONE,
    href: `tel:${CONTACT_PHONE_TEL}`,
    subvalue: CONTACT_PHONE_HOURS_RO,
  },
  {
    label: "Adresă",
    value: COMPANY_ADDRESS,
    href: null,
    subvalue: null,
  },
  {
    label: "Înregistrat",
    value: COMPANY_NAME,
    subvalue: COMPANY_NUMBER,
    href: null,
  },
];
