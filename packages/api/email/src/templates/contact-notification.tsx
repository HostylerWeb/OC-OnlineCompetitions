import { Hr, Link, Section, Text } from "@react-email/components";
import type { EmailTemplateProps } from "../types";
import { BaseEmail, emailStyles } from "./base";

export function ContactNotificationEmail({
  name,
  email,
  subject,
  message,
  submittedAt,
  settings,
}: EmailTemplateProps) {
  return (
    <BaseEmail preview={`New contact form submission from ${name}`} settings={settings}>
      <Text className={emailStyles.heading.className}>New Contact Form Submission</Text>
      <Text className={emailStyles.paragraph.className}>
        A new message has been submitted through the contact form on onlinecompetitions.co.uk.
      </Text>
      <Hr className={emailStyles.divider.className} />
      <Section className="mb-[16px]">
        <Text className="m-0 mb-[4px] text-[11px] uppercase tracking-wide font-semibold text-[#A1A1AA]">
          From:
        </Text>
        <Text className="m-0 mb-[16px] text-[15px] text-[#FFFFFF]">{name}</Text>
        <Text className="m-0 mb-[4px] text-[11px] uppercase tracking-wide font-semibold text-[#A1A1AA]">
          Email:
        </Text>
        <Text className="m-0 mb-[16px] text-[15px]">
          <Link href={`mailto:${email}`} className="text-[#D4AF37] no-underline">
            {email}
          </Link>
        </Text>
        <Text className="m-0 mb-[4px] text-[11px] uppercase tracking-wide font-semibold text-[#A1A1AA]">
          Subject:
        </Text>
        <Text className="m-0 mb-[16px] text-[15px] text-[#FFFFFF]">{subject}</Text>
        <Text className="m-0 mb-[4px] text-[11px] uppercase tracking-wide font-semibold text-[#A1A1AA]">
          Submitted:
        </Text>
        <Text className="m-0 text-[15px] text-[#FFFFFF]">{submittedAt}</Text>
      </Section>
      <Hr className={emailStyles.divider.className} />
      <Text className="m-0 mb-[8px] text-[11px] uppercase tracking-wide font-semibold text-[#A1A1AA]">
        Message:
      </Text>
      <Section
        className="rounded-[12px] border border-[#27272A] bg-[#0A0A0B] p-[16px]"
        style={{ borderWidth: "1px", borderStyle: "solid" }}
      >
        <Text className="m-0 whitespace-pre-wrap text-[14px] leading-[22px] text-[#FFFFFF]">
          {message}
        </Text>
      </Section>
      <Hr className={emailStyles.divider.className} />
      <Text className={emailStyles.muted.className}>
        Reply directly to this email to respond to the customer, or click the email address above.
      </Text>
    </BaseEmail>
  );
}

export default ContactNotificationEmail;
