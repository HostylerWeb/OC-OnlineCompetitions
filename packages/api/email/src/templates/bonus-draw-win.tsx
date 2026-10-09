import type { IEmailSettings } from "@oc/api-db/models/EmailSettings";
import { formatCurrency } from "@oc/utils";
import { Button, Hr, Link, Section, Text } from "@react-email/components";
import { BaseEmail, emailStyles } from "./base";

export interface BonusDrawWinEmailProps {
  userName: string;
  competitionName: string;
  milestonePct: number;
  prizeTitle: string;
  prizeValue?: number;
  prizeImage?: string;
  claimUrl: string;
  isGuest?: boolean;
  settings?: IEmailSettings;
  frontendUrl?: string;
}

export function BonusDrawWinEmail({
  userName,
  competitionName,
  milestonePct,
  prizeTitle,
  prizeValue,
  prizeImage,
  claimUrl,
  isGuest,
  settings,
  frontendUrl,
}: BonusDrawWinEmailProps) {
  const supportAddress = settings?.supportAddress ?? "support@onlinecompetitions.co.uk";
  return (
    <BaseEmail
      preview={`🎉 You won a bonus draw in ${competitionName}!`}
      settings={settings}
      frontendUrl={frontendUrl}
    >
      <Text className="mb-[8px] text-center text-[14px] font-semibold tracking-widest uppercase text-[#D4AF37]">
        Congratulations!
      </Text>
      <Text className="mb-[16px] text-center text-[24px] font-bold text-[#D4AF37]">
        Bonus Draw Winner!
      </Text>
      <Text className={emailStyles.paragraph.className}>Hi {userName},</Text>
      <Text className={emailStyles.paragraph.className}>
        You won a bonus draw in <strong>{competitionName}</strong> at the{" "}
        <strong>{milestonePct}%</strong> milestone!
      </Text>
      <Section
        className="my-[24px] rounded-[12px] border-2 border-[#D4AF37] bg-[#0A0A0B] p-[24px] text-center"
        style={{ borderWidth: "2px", borderStyle: "solid" }}
      >
        {prizeImage && (
          <img
            src={prizeImage}
            alt={prizeTitle}
            className="w-32 h-32 object-contain mx-auto mb-[16px] rounded-lg"
          />
        )}
        <Text className="m-0 mb-[8px] text-[11px] uppercase tracking-widest text-[#A1A1AA]">
          Your Bonus Prize
        </Text>
        <Text className="m-0 mb-[8px] text-[20px] font-semibold text-[#D4AF37]">{prizeTitle}</Text>
        {prizeValue ? (
          <Text className="m-0 text-[17px] text-[#FFFFFF]">{formatCurrency(prizeValue)}</Text>
        ) : null}
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
      <Text className={emailStyles.paragraph.className}>
        Congratulations once again on your bonus draw win!
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

export default BonusDrawWinEmail;
