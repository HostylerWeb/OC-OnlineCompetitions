import type { IEmailSettings } from "@oc/api-db/models/EmailSettings";
import { Button, Hr, Link, Section, Text } from "@react-email/components";
import { BaseEmail, emailStyles } from "./base";

type EmailTemplateProps = {
  userName: string;
  code: string;
  resetUrl: string;
  settings?: IEmailSettings;
  frontendUrl?: string;
};

export function PasswordResetEmail({
  userName,
  code,
  resetUrl,
  settings,
  frontendUrl,
}: EmailTemplateProps) {
  const supportAddress = settings?.supportAddress ?? "support@onlinecompetitions.co.uk";
  return (
    <BaseEmail
      preview={`Password reset requested — code: ${code}`}
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
          <strong className="text-[#EF4444]">Security Alert:</strong> If you did not request a
          password reset, please ignore this email. Your password will remain unchanged.
        </Text>
      </Section>
      <Text className={emailStyles.heading.className}>Reset Your Password</Text>
      <Text className={emailStyles.paragraph.className}>Hi {userName},</Text>
      <Text className={emailStyles.paragraph.className}>
        We received a request to reset your Online Competitions account password. Use the code below to set a new
        password.
      </Text>
      <Section className="my-[32px] text-center">
        <Text
          className="m-0 mb-[8px] text-[36px] font-semibold tracking-[0.2em] text-[#D4AF37]"
          style={{ fontFamily: "ui-monospace, monospace" }}
        >
          {code}
        </Text>
        <Text className={emailStyles.muted.className}>Enter this code to reset your password</Text>
      </Section>
      <Section className="my-[24px] text-center">
        <Button href={resetUrl} className={emailStyles.button.className}>
          Reset Password
        </Button>
      </Section>
      <Text className={emailStyles.muted.className}>
        If the button above doesn&apos;t work, copy and paste this URL into your browser:
        <br />
        <Link href={resetUrl} className="break-all text-[#D4AF37] no-underline">
          {resetUrl}
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
          <strong className="text-[#D4AF37]">Time-Sensitive:</strong> This reset code expires in 5
          minutes. After that, you&apos;ll need to request a new one.
        </Text>
      </Section>
      <Hr className={emailStyles.divider.className} />
      <Text className="mb-[16px] text-[17px] font-semibold text-[#FFFFFF]">Security Tips</Text>
      <Text className={emailStyles.paragraph.className}>
        <span className="font-semibold text-[#D4AF37]">Use a strong password</span>
        <br />
        At least 8 characters with a mix of letters, numbers, and symbols.
      </Text>
      <Text className={emailStyles.paragraph.className}>
        <span className="font-semibold text-[#D4AF37]">Don&apos;t reuse passwords</span>
        <br />
        Use a unique password for your Online Competitions account.
      </Text>
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

export default PasswordResetEmail;
