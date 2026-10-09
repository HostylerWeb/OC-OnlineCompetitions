import {
  BRAND_NAME,
  CONTACT_PHONE_DISPLAY,
  getMailtoContact,
  LEGAL_COMPANY_NAME,
  LEGAL_COMPANY_NUMBER,
  LEGAL_CONTACT_EMAIL,
  LEGAL_REGISTERED_OFFICE,
  LEGAL_REGISTERED_OFFICE_POSTAL,
  LEGAL_WEBSITE,
  LEGAL_WEBSITE_URL,
} from "@oc/utils";

export function CompanyEmailLink({ className = "text-gold hover:underline" }: { className?: string }) {
  return (
    <a href={getMailtoContact()} className={className}>
      {LEGAL_CONTACT_EMAIL}
    </a>
  );
}

export const LEGAL_COMPANY_REGISTRY_EN = `${LEGAL_COMPANY_NAME} (Company No.${LEGAL_COMPANY_NUMBER}, registered in Scotland)`;
export const LEGAL_COMPANY_REGISTRY_RO = `${LEGAL_COMPANY_NAME} (Nr. Înreg. ${LEGAL_COMPANY_NUMBER}, înregistrată în Scoția)`;

export {
  BRAND_NAME,
  CONTACT_PHONE_DISPLAY,
  LEGAL_COMPANY_NAME,
  LEGAL_COMPANY_NUMBER,
  LEGAL_CONTACT_EMAIL,
  LEGAL_REGISTERED_OFFICE,
  LEGAL_REGISTERED_OFFICE_POSTAL,
  LEGAL_WEBSITE,
  LEGAL_WEBSITE_URL,
};
