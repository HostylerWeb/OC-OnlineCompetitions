import { Button, Hr, Link, Section, Text } from "@react-email/components";
import type { EmailTemplateProps } from "../types";
import { BaseEmail, emailStyles } from "./base";

export function WinNotificationEmail({
  userName,
  competitionName,
  prizeTitle,
  prizeValue,
  claimUrl,
  settings,
  isGuest,
}: EmailTemplateProps) {
  const supportAddress = settings?.supportAddress ?? "support@onlinecompetitions.co.uk";
  return (
    <BaseEmail preview={`Congratulations! You've won ${prizeTitle}!`} settings={settings}>
      <Text className="mb-[16px] text-center text-[24px] font-bold text-[#FFFFFF]">
        You&apos;re a Winner!
      </Text>
      <Text className={emailStyles.paragraph.className}>Hi {userName},</Text>
      <Text className={emailStyles.paragraph.className}>
        We&apos;re thrilled to inform you that you&apos;ve won in the{" "}
        <strong>{competitionName}</strong> competition!
      </Text>
      <Section
        className="my-[24px] rounded-[12px] border-2 border-[#D4AF37] bg-[#0A0A0B] p-[24px] text-center"
        style={{ borderWidth: "2px", borderStyle: "solid" }}
      >
        <Text className="m-0 mb-[8px] text-[11px] uppercase tracking-widest text-[#A1A1AA]">
          Your Prize
        </Text>
        <Text className="m-0 mb-[8px] text-[20px] font-semibold text-[#D4AF37]">{prizeTitle}</Text>
        {prizeValue != null && (
          <Text className="m-0 text-[17px] text-[#FFFFFF]">
            £{Number(prizeValue).toLocaleString()}
          </Text>
        )}
      </Section>
      {!isGuest && (
        <Section className="my-[32px] text-center">
          <Button
            href={claimUrl}
            className="bg-[#D4AF37] rounded-[6px] px-[32px] py-[16px] text-[17px] font-semibold text-[#0A0A0B] no-underline inline-block text-center"
          >
            View Your Win
          </Button>
        </Section>
      )}
      {!isGuest && (
        <Section
          className="my-[24px] rounded-[12px] border border-[#27272A] bg-[#0A0A0B] p-[20px]"
          style={{ borderWidth: "1px", borderStyle: "solid" }}
        >
          <Text className="m-0 text-[14px] leading-[22px] text-[#FFFFFF]">
            An admin will process your prize. We&apos;ll be in touch via email to arrange delivery
            or collection.
          </Text>
        </Section>
      )}
      {isGuest && (
        <Section
          className="my-[24px] rounded-[12px] border border-[#27272A] bg-[#0A0A0B] p-[20px]"
          style={{ borderWidth: "1px", borderStyle: "solid" }}
        >
          <Text className="m-0 text-[14px] leading-[22px] text-[#FFFFFF]">
            No action needed — your prize is already claimed. Create an account to track your wins
            and manage your profile.
          </Text>
        </Section>
      )}
      <Text className={emailStyles.paragraph.className}>
        Congratulations once again! This is a life-changing moment — we can&apos;t wait to see you
        enjoy your prize!
      </Text>
      <Hr className={emailStyles.divider.className} />
      <Text className={emailStyles.muted.className}>
        Have questions about your prize? Contact us at{" "}
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

export default WinNotificationEmail;
