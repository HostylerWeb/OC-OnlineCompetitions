import type { IEmailSettings } from "@oc/api-db/models/EmailSettings";
import { Button, Hr, Link, Section, Text } from "@react-email/components";
import { BaseEmail, emailStyles } from "./base";

type EmailTemplateProps = {
  userName: string;
  code: string;
  verificationUrl?: string;
  settings?: IEmailSettings;
  frontendUrl?: string;
};

type VerificationPurpose = "email-verification" | "sign-in";

export function EmailVerificationEmail({
  userName,
  code,
  verificationUrl,
  purpose = "email-verification",
  settings,
  frontendUrl,
}: EmailTemplateProps & { purpose?: VerificationPurpose }) {
  const isSignIn = purpose === "sign-in";
  const heading = isSignIn ? "Your Sign-In Code" : "Verify Your Email";
  const intro = isSignIn
    ? "Use the code below to sign in to your Online Competitions account."
    : "Welcome to Online Competitions! To complete your registration and start winning incredible prizes, please verify your email address using the code below.";
  const codeHint = isSignIn ? "Enter this code to sign in" : "Enter this code to verify your email";

  return (
    <BaseEmail preview={`${heading} — code: ${code}`} settings={settings} frontendUrl={frontendUrl}>
      <Text className={emailStyles.heading.className}>{heading}</Text>
      <Text className={emailStyles.paragraph.className}>Hi {userName},</Text>
      <Text className={emailStyles.paragraph.className}>{intro}</Text>
      <Section className="my-[32px] text-center">
        <Text
          className="m-0 mb-[8px] text-[36px] font-semibold tracking-[0.2em] text-[#D4AF37]"
          style={{ fontFamily: "ui-monospace, monospace" }}
        >
          {code}
        </Text>
        <Text className={emailStyles.muted.className}>{codeHint}</Text>
      </Section>
      {verificationUrl ? (
        <>
          <Section className="my-[24px] text-center">
            <Button href={verificationUrl} className={emailStyles.button.className}>
              {isSignIn ? "Sign In" : "Verify Email Address"}
            </Button>
          </Section>
          <Text className={emailStyles.muted.className}>
            Or copy and paste this URL into your browser:
            <br />
            <Link href={verificationUrl} className="break-all text-[#D4AF37] no-underline">
              {verificationUrl}
            </Link>
          </Text>
        </>
      ) : null}
      <Hr className={emailStyles.divider.className} />
      <Section
        className="my-[16px] rounded-[8px] border-l-4 border-[#D4AF37] bg-[#0A0A0B] px-[20px] py-[16px]"
        style={{
          borderLeftWidth: "4px",
          borderLeftStyle: "solid",
          backgroundColor: "rgba(212, 175, 55, 0.1)",
        }}
      >
        <Text className="m-0 text-[14px] leading-[22px] text-[#A1A1AA]">
          <strong className="text-[#D4AF37]">Security Notice:</strong> This code expires in 15
          minutes. If you didn&apos;t request this email, please ignore it — your account remains
          secure.
        </Text>
      </Section>
      <Text className={emailStyles.paragraph.className}>
        Good luck!
        <br />
        The Online Competitions Team
      </Text>
    </BaseEmail>
  );
}

export default EmailVerificationEmail;
