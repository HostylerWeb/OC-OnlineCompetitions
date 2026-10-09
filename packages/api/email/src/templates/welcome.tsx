import type { IEmailSettings } from "@oc/api-db/models/EmailSettings";
import { Button, Hr, Link, Section, Text } from "@react-email/components";
import { BaseEmail, emailStyles } from "./base";

type WelcomeEmailProps = {
  userName: string;
  settings?: IEmailSettings;
  frontendUrl?: string;
};

export function WelcomeEmail({ userName, settings, frontendUrl }: WelcomeEmailProps) {
  const supportAddress = settings?.supportAddress ?? "support@onlinecompetitions.co.uk";
  const competitionsUrl = `${frontendUrl ?? ""}/competitions`;
  const dashboardUrl = `${frontendUrl ?? ""}/dashboard`;

  return (
    <BaseEmail
      preview={`Welcome to Online Competitions, ${userName}! Your email is verified — start winning today.`}
      settings={settings}
      frontendUrl={frontendUrl}
    >
      <Text className={emailStyles.heading.className}>Welcome to Online Competitions!</Text>
      <Text className={emailStyles.paragraph.className}>Hi {userName},</Text>
      <Text className={emailStyles.paragraph.className}>
        Thank you for joining Online Competitions! Your email is verified and your account is ready — you&apos;re
        now part of a community competing for incredible luxury prizes.
      </Text>
      <Section
        className="my-[16px] rounded-[8px] border-l-4 border-[#D4AF37] bg-[#0A0A0B] px-[20px] py-[16px]"
        style={{
          borderLeftWidth: "4px",
          borderLeftStyle: "solid",
          backgroundColor: "rgba(212, 175, 55, 0.1)",
        }}
      >
        <Text className="m-0 text-[14px] leading-[22px] text-[#A1A1AA]">
          <strong className="text-[#D4AF37]">You&apos;re all set:</strong> Browse competitions,
          secure your entries, and track everything from your dashboard.
        </Text>
      </Section>
      <Hr className={emailStyles.divider.className} />
      <Text className="mb-[16px] text-[17px] font-semibold text-[#FFFFFF]">What&apos;s Next?</Text>
      <Text className={emailStyles.paragraph.className}>
        <span className="font-semibold text-[#D4AF37]">1. Browse Competitions</span>
        <br />
        Explore luxury prizes from tech to dream experiences.
      </Text>
      <Text className={emailStyles.paragraph.className}>
        <span className="font-semibold text-[#D4AF37]">2. Get Your Tickets</span>
        <br />
        Answer a skill question and secure your entries.
      </Text>
      <Text className={emailStyles.paragraph.className}>
        <span className="font-semibold text-[#D4AF37]">3. Win Big</span>
        <br />
        Live draws, instant notifications, insured delivery.
      </Text>
      <Section className="my-[24px] text-center">
        <Button href={competitionsUrl} className={emailStyles.button.className}>
          Start Browsing Competitions
        </Button>
      </Section>
      <Section className="my-[8px] text-center">
        <Button href={dashboardUrl} className={emailStyles.button.className}>
          Go to Your Dashboard
        </Button>
      </Section>
      <Hr className={emailStyles.divider.className} />
      <Text className={emailStyles.muted.className}>
        Questions? Contact our support team at{" "}
        <Link href={`mailto:${supportAddress}`} className="text-[#D4AF37] no-underline">
          {supportAddress}
        </Link>
      </Text>
      <Text className={emailStyles.paragraph.className}>
        Good luck!
        <br />
        The Online Competitions Team
      </Text>
    </BaseEmail>
  );
}

export default WelcomeEmail;
