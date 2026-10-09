import { Button, Hr, Link, Section, Text } from "@react-email/components";
import type { EmailTemplateProps } from "../types";
import { BaseEmail, emailStyles } from "./base";

export function ReferralTicketsAwardedEmail({
  userName,
  ticketsAwarded,
  ticketsUrl,
  currentTier,
  settings,
  frontendUrl,
}: EmailTemplateProps) {
  const supportAddress = settings?.supportAddress ?? "support@onlinecompetitions.co.uk";
  const ticketLabel = ticketsAwarded === 1 ? "ticket" : "tickets";

  return (
    <BaseEmail
      preview={`You've earned ${ticketsAwarded} referral ${ticketLabel} — ready to redeem`}
      settings={settings}
      frontendUrl={frontendUrl}
    >
      <Text className={emailStyles.heading.className}>Referral Rewards</Text>
      <Text className={emailStyles.paragraph.className}>Hi {userName},</Text>
      <Text className={emailStyles.paragraph.className}>
        Great news — you&apos;ve earned{" "}
        <strong style={{ color: "#D4AF37" }}>
          {ticketsAwarded} referral {ticketLabel}
        </strong>{" "}
        from your referrals. They&apos;ve been added to your account and are ready to redeem.
      </Text>
      <Section
        className="my-[24px] rounded-[12px] border-2 border-[#D4AF37] bg-[#0A0A0B] p-[24px] text-center"
        style={{ borderWidth: "2px", borderStyle: "solid" }}
      >
        <Text className="m-0 mb-[8px] text-[11px] uppercase tracking-widest text-[#A1A1AA]">
          Tickets Earned
        </Text>
        <Text className="m-0 mb-[8px] text-[20px] font-semibold text-[#D4AF37]">
          {ticketsAwarded}
        </Text>
        {currentTier && (
          <Text className="m-0 text-[14px] text-[#A1A1AA]">
            Current tier: <span style={{ color: "#D4AF37" }}>{currentTier}</span>
          </Text>
        )}
      </Section>
      <Section className="my-[32px] text-center">
        <Button
          href={ticketsUrl}
          className="bg-[#D4AF37] rounded-[6px] px-[32px] py-[16px] text-[17px] font-semibold text-[#0A0A0B] no-underline inline-block text-center"
        >
          Redeem Your Tickets
        </Button>
      </Section>
      <Text className={emailStyles.paragraph.className}>
        Keep sharing your referral code to earn more tickets. The more active referrals you have,
        the better your rewards.
      </Text>
      <Hr className={emailStyles.divider.className} />
      <Text className={emailStyles.muted.className}>
        Questions? Contact us at{" "}
        <Link href={`mailto:${supportAddress}`} className="text-[#D4AF37] no-underline">
          {supportAddress}
        </Link>
      </Text>
      <Text className={emailStyles.paragraph.className}>
        Thank you for spreading the word,
        <br />
        The Online Competitions Team
      </Text>
    </BaseEmail>
  );
}

export default ReferralTicketsAwardedEmail;
