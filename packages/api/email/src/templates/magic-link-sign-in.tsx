import type { IEmailSettings } from "@oc/api-db/models/EmailSettings";
import { Button, Hr, Link, Section, Text } from "@react-email/components";
import { BaseEmail, emailStyles } from "./base";

type EmailTemplateProps = {
  userName: string;
  signInUrl: string;
  settings?: IEmailSettings;
  frontendUrl?: string;
};

export function MagicLinkSignInEmail({
  userName,
  signInUrl,
  settings,
  frontendUrl,
}: EmailTemplateProps) {
  const supportAddress = settings?.supportAddress ?? "support@onlinecompetitions.co.uk";
  return (
    <BaseEmail preview="Sign in to Online Competitions" settings={settings} frontendUrl={frontendUrl}>
      <Text className={emailStyles.heading.className}>Sign In to Online Competitions</Text>
      <Text className={emailStyles.paragraph.className}>Hi {userName},</Text>
      <Text className={emailStyles.paragraph.className}>
        Click the button below to sign in to your Online Competitions account. This link expires in 10 minutes
        and can only be used once.
      </Text>
      <Section className="my-[24px] text-center">
        <Button href={signInUrl} className={emailStyles.button.className}>
          Sign In to Online Competitions
        </Button>
      </Section>
      <Text className={emailStyles.muted.className}>
        If the button above doesn&apos;t work, copy and paste this URL into your browser:
        <br />
        <Link href={signInUrl} className="break-all text-[#D4AF37] no-underline">
          {signInUrl}
        </Link>
      </Text>
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
          <strong className="text-[#D4AF37]">Security Notice:</strong> If you didn&apos;t request
          this sign-in link, you can safely ignore this email.
        </Text>
      </Section>
      <Text className={emailStyles.muted.className}>
        Need help? Contact our support team at{" "}
        <Link href={`mailto:${supportAddress}`} className="text-[#D4AF37] no-underline">
          {supportAddress}
        </Link>
      </Text>
      <Text className={emailStyles.paragraph.className}>The Online Competitions Team</Text>
    </BaseEmail>
  );
}

export default MagicLinkSignInEmail;
