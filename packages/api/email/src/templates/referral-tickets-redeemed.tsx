import { formatTicketNumber } from "@oc/utils";
import { Button, Hr, Link, Section, Text } from "@react-email/components";
import type { EmailTemplateProps } from "../types";
import { BaseEmail, emailStyles } from "./base";

export function ReferralTicketsRedeemedEmail({
  userName,
  competitionTitle,
  quantityRedeemed,
  ticketNumbers,
  walletBalance,
  ticketsUrl,
  settings,
  frontendUrl,
}: EmailTemplateProps) {
  const supportAddress = settings?.supportAddress ?? "support@onlinecompetitions.co.uk";
  const ticketLabel = quantityRedeemed === 1 ? "ticket" : "tickets";

  return (
    <BaseEmail
      preview={`Your referral ${ticketLabel} for ${competitionTitle} have been redeemed`}
      settings={settings}
      frontendUrl={frontendUrl}
    >
      <Text className={emailStyles.heading.className}>Referral Tickets Redeemed</Text>
      <Text className={emailStyles.paragraph.className}>Hi {userName},</Text>
      <Text className={emailStyles.paragraph.className}>
        Your referral {ticketLabel} have been successfully redeemed for{" "}
        <strong style={{ color: "#D4AF37" }}>{competitionTitle}</strong>. You are now entered into
        the competition — good luck!
      </Text>
      <Section
        className="my-[24px] rounded-[12px] border border-[#27272A] bg-[#0A0A0B] p-[20px]"
        style={{ borderWidth: "1px", borderStyle: "solid" }}
      >
        <Text className="m-0 mb-[4px] text-[11px] uppercase tracking-wide font-semibold text-[#A1A1AA]">
          Competition
        </Text>
        <Text className="m-0 mb-[16px] text-[15px] font-semibold text-[#FFFFFF]">
          {competitionTitle}
        </Text>
        <Text className="m-0 mb-[4px] text-[11px] uppercase tracking-wide font-semibold text-[#A1A1AA]">
          Tickets Redeemed
        </Text>
        <Text className="m-0 mb-[16px] text-[15px] font-semibold text-[#FFFFFF]">
          {quantityRedeemed} {ticketLabel}
        </Text>
        <Text className="m-0 mb-[4px] text-[11px] uppercase tracking-wide font-semibold text-[#A1A1AA]">
          Ticket Numbers
        </Text>
        <Text className="m-0 mb-[16px] text-[14px] font-semibold text-[#D4AF37]">
          {ticketNumbers!.map(formatTicketNumber).join(", ")}
        </Text>
        <Text className="m-0 mb-[4px] text-[11px] uppercase tracking-wide font-semibold text-[#A1A1AA]">
          Remaining Referral Balance
        </Text>
        <Text className="m-0 text-[15px] font-semibold text-[#FFFFFF]">
          {walletBalance} {walletBalance === 1 ? "ticket" : "tickets"}
        </Text>
      </Section>
      <Section className="my-[32px] text-center">
        <Button
          href={ticketsUrl}
          className="bg-[#D4AF37] rounded-[6px] px-[32px] py-[16px] text-[17px] font-semibold text-[#0A0A0B] no-underline inline-block text-center"
        >
          View My Tickets
        </Button>
      </Section>
      <Text className={emailStyles.paragraph.className}>
        Share your referral code to earn more tickets and unlock higher reward tiers.
      </Text>
      <Hr className={emailStyles.divider.className} />
      <Text className={emailStyles.muted.className}>
        Questions? Contact us at{" "}
        <Link href={`mailto:${supportAddress}`} className="text-[#D4AF37] no-underline">
          {supportAddress}
        </Link>
      </Text>
      <Text className={emailStyles.paragraph.className}>
        Best of luck,
        <br />
        The Online Competitions Team
      </Text>
    </BaseEmail>
  );
}

export default ReferralTicketsRedeemedEmail;
