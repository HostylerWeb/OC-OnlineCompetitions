import { formatTicketNumber } from "@oc/utils";
import { Button, Hr, Link, Section, Text } from "@react-email/components";
import type { EmailTemplateProps } from "../types";
import { BaseEmail, emailStyles } from "./base";

export function InstantWinEmail({
  userName,
  prizeTitle,
  prizeImage,
  prizeValue,
  ticketNumber,
  competitionName,
  wins,
  settings,
  frontendUrl,
  isGuest,
}: EmailTemplateProps) {
  const supportAddress = settings?.supportAddress ?? "support@onlinecompetitions.co.uk";
  const winItems =
    Array.isArray(wins) && wins.length > 0
      ? wins
      : prizeTitle != null && ticketNumber != null
        ? [{ prizeTitle, prizeImage, prizeValue, ticketNumber, competitionName }]
        : [];

  return (
    <BaseEmail
      preview={
        winItems.length === 1
          ? `Congratulations! You've won ${winItems[0]!.prizeTitle}!`
          : `Congratulations! You've won ${winItems.length} instant prizes!`
      }
      settings={settings}
      frontendUrl={frontendUrl}
    >
      <Text className="mb-[8px] text-center text-[14px] font-semibold tracking-widest uppercase text-[#D4AF37]">
        You Won {winItems.length === 1 ? "an Instant Prize" : "Instant Prizes"}
      </Text>
      <Text className="mb-[16px] text-center text-[24px] font-bold text-[#FFFFFF]">
        Congratulations!
      </Text>
      <Text className={emailStyles.paragraph.className}>Hi {userName},</Text>
      <Text className={emailStyles.paragraph.className}>
        Great news — you just won {winItems.length === 1 ? "an instant prize" : "instant prizes"}{" "}
        from your ticket purchase! Check your winning details below.
      </Text>
      {winItems.map((win, index) => (
        <Section
          key={`${win.ticketNumber}-${index}`}
          className="my-[24px] rounded-[12px] border-2 border-[#D4AF37] bg-[#0A0A0B] p-[24px] text-center"
          style={{ borderWidth: "2px", borderStyle: "solid" }}
        >
          {win.prizeImage && (
            <img
              src={win.prizeImage}
              alt={win.prizeTitle}
              className="w-32 h-32 object-contain mx-auto mb-[16px] rounded-lg"
            />
          )}
          <Text className="m-0 mb-[8px] text-[11px] uppercase tracking-widest text-[#A1A1AA]">
            You Won
          </Text>
          <Text className="m-0 mb-[8px] text-[20px] font-semibold text-[#D4AF37]">
            {win.prizeTitle}
          </Text>
          {win.prizeValue && (
            <Text className="m-0 text-[17px] text-[#FFFFFF]">
              Value: £{Number(win.prizeValue).toLocaleString()}
            </Text>
          )}
          <Text className="m-0 mt-[12px] text-[13px] text-[#A1A1AA]">
            Winning Ticket:{" "}
            <span className="font-mono font-semibold text-[#FFFFFF]">
              #{formatTicketNumber(win.ticketNumber)}
            </span>
          </Text>
          {win.competitionName && (
            <Text className="m-0 mt-[8px] text-[13px] text-[#A1A1AA]">
              From: {win.competitionName}
            </Text>
          )}
        </Section>
      ))}
      <Text className={emailStyles.paragraph.className}>
        Your prize will be processed shortly. We&apos;ll be in touch to arrange delivery or
        collection — no action needed on your part.
      </Text>
      {!isGuest && (
        <Section className="my-[24px] text-center">
          <Button href={`${frontendUrl}/dashboard/wins`} className={emailStyles.button.className}>
            View My Wins
          </Button>
        </Section>
      )}
      {isGuest && (
        <Section
          className="my-[24px] rounded-[12px] border border-[#27272A] bg-[#0A0A0B] p-[20px]"
          style={{ borderWidth: "1px", borderStyle: "solid" }}
        >
          <Text className="m-0 text-[14px] leading-[22px] text-[#FFFFFF]">
            No action needed — your prize is already claimed. We&apos;ll be in touch via email to
            arrange delivery.
          </Text>
        </Section>
      )}
      <Hr className={emailStyles.divider.className} />
      <Text className={emailStyles.paragraph.className}>
        Congratulations once again and enjoy your prize!
      </Text>
      <Hr className={emailStyles.divider.className} />
      <Text className={emailStyles.muted.className}>
        Questions? Contact us at{" "}
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

export default InstantWinEmail;
