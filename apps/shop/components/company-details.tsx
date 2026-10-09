import {
  BRAND_NAME,
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_TEL,
  getFooterCopyright,
  LEGAL_COMPANY_NAME,
  LEGAL_COMPANY_NUMBER,
  LEGAL_COMPANY_NUMBER_LABEL,
  LEGAL_CONTACT_EMAIL,
  LEGAL_REGISTERED_OFFICE,
  LEGAL_REGISTERED_OFFICE_LINES,
  LEGAL_WEBSITE,
  getMailtoContact,
} from "@oc/utils";

export function RegisteredOfficeAddress({ className }: { className?: string }) {
  return (
    <address className={className ?? "not-italic text-muted-foreground leading-relaxed"}>
      {LEGAL_REGISTERED_OFFICE_LINES.map((line, index) => (
        <span key={line}>
          {line}
          {index < LEGAL_REGISTERED_OFFICE_LINES.length - 1 ? <br /> : null}
        </span>
      ))}
    </address>
  );
}

export function CompanyContactEmail({ className = "text-gold hover:underline" }: { className?: string }) {
  return (
    <a href={getMailtoContact()} className={className}>
      {LEGAL_CONTACT_EMAIL}
    </a>
  );
}

export function ShopFooterLegal({ year }: { year: number }) {
  return <>{getFooterCopyright(year)}</>;
}

export function ContactPhoneLink({ className = "text-gold hover:underline" }: { className?: string }) {
  return (
    <a href={`tel:${CONTACT_PHONE_TEL}`} className={className}>
      {CONTACT_PHONE_DISPLAY}
    </a>
  );
}

export function CompanyNameAndAddress() {
  return (
    <>
      {LEGAL_COMPANY_NAME}
      <br />
      <RegisteredOfficeAddress />
    </>
  );
}

export function ShopLegalContactList() {
  return (
    <ul className="mt-2 list-none space-y-1 pl-0">
      <li>
        Email: <CompanyContactEmail className="text-gold transition-colors hover:text-gold/80" />
      </li>
      <li>
        Phone: <ContactPhoneLink className="text-gold transition-colors hover:text-gold/80" />
      </li>
      <li>
        Post: {LEGAL_COMPANY_NAME}, {LEGAL_REGISTERED_OFFICE}
      </li>
    </ul>
  );
}

export {
  BRAND_NAME,
  CONTACT_PHONE_DISPLAY,
  LEGAL_COMPANY_NAME,
  LEGAL_COMPANY_NUMBER,
  LEGAL_COMPANY_NUMBER_LABEL,
  LEGAL_CONTACT_EMAIL,
  LEGAL_REGISTERED_OFFICE,
  LEGAL_WEBSITE,
};
