import type { IEmailSettings } from "@oc/api-db/models/EmailSettings";
import { Button, Hr, Link, Section, Text } from "@react-email/components";
import { BaseEmail, emailStyles } from "./base";

type EmailTemplateProps = {
  userName: string;
  code: string;
  recoveryUrl: string;
  settings?: IEmailSettings;
  frontendUrl?: string;
};

export function AdminEmergencyEmail({
  userName,
  code,
  recoveryUrl,
  settings,
  frontendUrl,
}: EmailTemplateProps) {
  const supportAddress = settings?.supportAddress ?? "support@onlinecompetitions.co.uk";
  return (
    <BaseEmail
      preview={`Admin emergency recovery code: ${code}`}
      settings={settings}
      frontendUrl={frontendUrl}
    >
      <Section
        className="mb-[24px] rounded-[8px] border-l-4 border-[#EF4444] px-[20px] py-[16px]"
        style={{
          borderLeftWidth: "4px",
          borderLeftStyle: "solid",
          backgroundColor: "rgba(239, 68, 68, 0.1)",
        }}
      >
        <Text className="m-0 text-[14px] leading-[22px] text-[#A1A1AA]">
          <strong className="text-[#EF4444]">Emergency access:</strong> This code resets the Online Competitions
          admin account. Only use it if your team is locked out. If you did not request this, ignore
          this email immediately.
        </Text>
      </Section>
      <Text className={emailStyles.heading.className}>Admin Emergency Recovery</Text>
      <Text className={emailStyles.paragraph.className}>Hi {userName},</Text>
      <Text className={emailStyles.paragraph.className}>
        An emergency admin recovery was requested. Enter the code below on the recovery page to
        repair the admin account and receive new credentials.
      </Text>
      <Section className="my-[32px] text-center">
        <Text
          className="m-0 mb-[8px] text-[36px] font-semibold tracking-[0.2em] text-[#D4AF37]"
          style={{ fontFamily: "ui-monospace, monospace" }}
        >
          {code}
        </Text>
        <Text className={emailStyles.muted.className}>
          Enter this code on the emergency recovery page
        </Text>
      </Section>
      <Section className="my-[24px] text-center">
        <Button href={recoveryUrl} className={emailStyles.button.className}>
          Open Emergency Recovery
        </Button>
      </Section>
      <Text className={emailStyles.muted.className}>
        If the button above doesn&apos;t work, copy and paste this URL into your browser:
        <br />
        <Link href={recoveryUrl} className="break-all text-[#D4AF37] no-underline">
          {recoveryUrl}
        </Link>
      </Text>
      <Hr className={emailStyles.divider.className} />
      <Section
        className="my-[16px] rounded-[8px] border-l-4 border-[#D4AF37] px-[20px] py-[16px]"
        style={{
          borderLeftWidth: "4px",
          borderLeftStyle: "solid",
          backgroundColor: "rgba(212, 175, 55, 0.1)",
        }}
      >
        <Text className="m-0 text-[14px] leading-[22px] text-[#A1A1AA]">
          <strong className="text-[#D4AF37]">Time-Sensitive:</strong> This code expires in 5
          minutes. After use, all existing admin sessions are revoked.
        </Text>
      </Section>
      <Text className={emailStyles.muted.className}>
        Need help? Contact our support team at{" "}
        <Link href={`mailto:${supportAddress}`} className="text-[#D4AF37] no-underline">
          {supportAddress}
        </Link>
      </Text>
      <Text className={emailStyles.paragraph.className}>
        Stay secure,
        <br />
        The Online Competitions Team
      </Text>
    </BaseEmail>
  );
}

export default AdminEmergencyEmail;
