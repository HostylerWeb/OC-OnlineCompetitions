import { formatTicketNumber } from "@oc/utils";
import { Button, Hr, Link, Section, Text } from "@react-email/components";
import type { EmailTemplateProps } from "../types";
import { BaseEmail, emailStyles } from "./base";

export function ReferralTicketsAllocatedEmail({
  userName,
  totalTickets,
  competitionCount,
  allocation,
  currentTier,
  ticketsUrl,
  settings,
  frontendUrl,
}: EmailTemplateProps) {
  const supportAddress = settings?.supportAddress ?? "support@onlinecompetitions.co.uk";
  const ticketsLabel = totalTickets === 1 ? "ticket" : "tickets";
  const competitionsLabel = competitionCount === 1 ? "competition" : "competitions";

  return (
    <BaseEmail
      preview={`You've earned ${totalTickets} referral ${ticketsLabel} across ${competitionCount} ${competitionsLabel}`}
      settings={settings}
      frontendUrl={frontendUrl}
    >
      <Text className={emailStyles.heading.className}>Referral Tickets Allocated</Text>
      <Text className={emailStyles.paragraph.className}>Hi {userName},</Text>
      <Text className={emailStyles.paragraph.className}>
        Your referral rewards have been allocated. You&apos;ve earned{" "}
        <strong style={{ color: "#D4AF37" }}>
          {totalTickets} referral {ticketsLabel}
        </strong>{" "}
        across{" "}
        <strong style={{ color: "#D4AF37" }}>
          {competitionCount} {competitionsLabel}
        </strong>
        . Here&apos;s the breakdown by competition:
      </Text>

      <Section
        className="my-[24px] rounded-[12px] border border-[#27272A] bg-[#0A0A0B] p-[20px]"
        style={{ borderWidth: "1px", borderStyle: "solid" }}
      >
        <Text className="m-0 mb-[4px] text-[11px] uppercase tracking-wide font-semibold text-[#A1A1AA]">
          Tickets Earned
        </Text>
        <Text className="m-0 mb-[16px] text-[20px] font-semibold text-[#D4AF37]">
          {totalTickets} {ticketsLabel}
        </Text>
        <Text className="m-0 mb-[4px] text-[11px] uppercase tracking-wide font-semibold text-[#A1A1AA]">
          Competitions
        </Text>
        <Text className="m-0 mb-[16px] text-[15px] font-semibold text-[#FFFFFF]">
          {competitionCount} {competitionsLabel}
        </Text>
        {currentTier && (
          <>
            <Text className="m-0 mb-[4px] text-[11px] uppercase tracking-wide font-semibold text-[#A1A1AA]">
              Current Tier
            </Text>
            <Text className="m-0 text-[15px] font-semibold text-[#FFFFFF]">
              <span style={{ color: "#D4AF37" }}>{currentTier}</span>
            </Text>
          </>
        )}
      </Section>

      <Text className={emailStyles.subheading.className}>Allocation Breakdown</Text>
      {(allocation ?? []).map((entry) => {
        const entryLabel = entry.qty === 1 ? "ticket" : "tickets";
        return (
          <Section
            key={entry.competitionId}
            className="my-[12px] rounded-[12px] border border-[#27272A] bg-[#0A0A0B] p-[16px]"
            style={{ borderWidth: "1px", borderStyle: "solid" }}
          >
            <Text className="m-0 mb-[8px] text-[15px] font-semibold text-[#FFFFFF]">
              {entry.competitionTitle}
            </Text>
            <Text className="m-0 mb-[4px] text-[11px] uppercase tracking-wide font-semibold text-[#A1A1AA]">
              Quantity
            </Text>
            <Text className="m-0 mb-[12px] text-[14px] font-semibold text-[#FFFFFF]">
              {entry.qty} {entryLabel}
            </Text>
            <Text className="m-0 mb-[4px] text-[11px] uppercase tracking-wide font-semibold text-[#A1A1AA]">
              Ticket Numbers
            </Text>
            <Text className="m-0 text-[14px] font-semibold text-[#D4AF37]">
              {entry.ticketNumbers.map(formatTicketNumber).join(", ")}
            </Text>
          </Section>
        );
      })}

      <Section className="my-[32px] text-center">
        <Button
          href={ticketsUrl}
          className="bg-[#D4AF37] rounded-[6px] px-[32px] py-[16px] text-[17px] font-semibold text-[#0A0A0B] no-underline inline-block text-center"
        >
          View My Tickets
        </Button>
      </Section>
      <Text className={emailStyles.paragraph.className}>
        Keep sharing your referral code to earn more tickets across even more competitions. The more
        active referrals you have, the higher your tier and the bigger your rewards.
      </Text>
      <Hr className={emailStyles.divider.className} />
      <Text className={emailStyles.muted.className}>
        Questions? Contact us at{" "}
        <Link href={`mailto:${supportAddress}`} className="text-[#D4AF37] no-underline">
          {supportAddress}
        </Link>
      </Text>
      <Text className={emailStyles.paragraph.className}>
        Good luck in the draws,
        <br />
        The Online Competitions Team
      </Text>
    </BaseEmail>
  );
}

export default ReferralTicketsAllocatedEmail;
