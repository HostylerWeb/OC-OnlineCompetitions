import { Button, Hr, Link, Section, Text } from "@react-email/components";
import type { EmailTemplateProps } from "../types";
import { BaseEmail, emailStyles } from "./base";

export function SelfExclusionOverrideActionEmail({
  userName,
  action,
  adminNote,
  settings,
  frontendUrl,
}: EmailTemplateProps & {
  action: "approved" | "rejected";
  adminNote?: string;
}) {
  const supportAddress = settings?.supportAddress ?? "support@onlinecompetitions.co.uk";

  return (
    <BaseEmail
      preview={
        action === "approved"
          ? "Your self-exclusion has been lifted"
          : "Your override request has been reviewed"
      }
      settings={settings}
      frontendUrl={frontendUrl}
    >
      <Text className={emailStyles.heading.className}>
        {action === "approved" ? "Self-Exclusion Lifted" : "Override Request Reviewed"}
      </Text>
      <Text className={emailStyles.paragraph.className}>Hi {userName},</Text>
      <Text className={emailStyles.paragraph.className}>
        {action === "approved"
          ? "Your self-exclusion has been reviewed and lifted. You can now access your account and place orders normally."
          : "Your request to override your self-exclusion has been reviewed and was not approved at this time."}
      </Text>
      {adminNote ? (
        <Section className="my-[24px] rounded-[8px] bg-[#18181B] p-[16px]">
          <Text className="m-0 text-[11px] uppercase tracking-widest text-[#A1A1AA]">
            Admin Note
          </Text>
          <Text className="m-0 mt-[8px] text-[14px] text-[#E4E4E7]">{adminNote}</Text>
        </Section>
      ) : null}
      {action === "rejected" ? (
        <Text className={emailStyles.paragraph.className}>
          Your self-exclusion remains in place. If you believe there has been an error, please
          contact support.
        </Text>
      ) : (
        <Section className="my-[32px] text-center">
          <Button
            href={frontendUrl || "https://onlinecompetitions.co.uk"}
            className="bg-[#D4AF37] rounded-[6px] px-[32px] py-[16px] text-[17px] font-semibold text-[#0A0A0B] no-underline inline-block text-center"
          >
            Go to Dashboard
          </Button>
        </Section>
      )}
      <Hr className={emailStyles.divider.className} />
      <Text className={emailStyles.muted.className}>
        Questions? Contact us at{" "}
        <Link href={`mailto:${supportAddress}`} className="text-[#D4AF37] no-underline">
          {supportAddress}
        </Link>
      </Text>
      <Text className={emailStyles.paragraph.className}>
        Best regards,
        <br />
        The Online Competitions Team
      </Text>
    </BaseEmail>
  );
}

export default SelfExclusionOverrideActionEmail;
