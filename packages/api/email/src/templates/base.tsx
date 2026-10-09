import type { IEmailSettings } from "@oc/api-db/models/EmailSettings";
import {
  BRAND_NAME,
  brandLogoUrl,
  LEGAL_COMPANY_NAME,
  LEGAL_COMPANY_NUMBER,
  LEGAL_REGISTERED_OFFICE,
  LEGAL_WEBSITE,
  SOCIAL_LINKS,
} from "@oc/utils";
import {
  Body,
  Container,
  Font,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

export function BaseEmail({
  preview,
  children,
  settings: _settings,
  frontendUrl,
}: {
  preview: string;
  children: React.ReactNode;
  settings?: IEmailSettings;
  frontendUrl?: string;
}) {
  const effectiveUrl = frontendUrl ?? "https://staging.onlinecompetitions.co.uk";
  return (
    <Tailwind
      config={{
        theme: {
          extend: {
            colors: {
              gold: "#D4AF37",
              background: "#0A0A0B",
              card: "#1A1A1D",
              foreground: "#FFFFFF",
              muted: "#A1A1AA",
              border: "#27272A",
              danger: "#EF4444",
            },
            fontFamily: { sans: ["Plus Jakarta Sans", "Arial", "sans-serif"] },
          },
        },
      }}
    >
      <Html>
        <Head>
          <Font
            fontFamily="Plus Jakarta Sans"
            fallbackFontFamily="Arial"
            webFont={{
              url: "https://fonts.gstatic.com/s/plusjakartasans/v8/IJ9aO5Lnw3FPMv7nI5H1U.woff2",
              format: "woff2",
            }}
            fontWeight={400}
            fontStyle="normal"
          />
          <Font
            fontFamily="Plus Jakarta Sans"
            fallbackFontFamily="Arial"
            webFont={{
              url: "https://fonts.gstatic.com/s/plusjakartasans/v8/IJ9aO5Lnw3FPMv7nI5H1U.woff2",
              format: "woff2",
            }}
            fontWeight={600}
            fontStyle="normal"
          />
        </Head>
        <Preview>{preview}</Preview>
        <Body
          className="mx-auto my-auto px-[8px]"
          style={{ backgroundColor: "#0A0A0B", fontFamily: "Plus Jakarta Sans, Arial, sans-serif" }}
        >
          <Container className="mx-auto my-[40px] max-w-[600px]">
            <Section className="p-[32px] text-center">
              <Link href={effectiveUrl}>
                <Img
                  src={brandLogoUrl(effectiveUrl)}
                  alt={BRAND_NAME}
                  width={280}
                  style={{ margin: "0 auto", height: "auto", maxWidth: "100%" }}
                />
              </Link>
            </Section>
            <Section
              className="mx-[24px] my-0 rounded-[12px] border border-solid bg-[#1A1A1D] p-[32px]"
              style={{
                borderColor: "#27272A",
                borderRadius: "12px",
                backgroundColor: "#1A1A1D",
                padding: "32px",
              }}
            >
              {children}
            </Section>
            <Section className="p-[32px] text-center">
              <Text className="m-[8px] text-center text-[12px] leading-[20px] text-[#A1A1AA]">
                This email was sent by {BRAND_NAME} ({LEGAL_WEBSITE})
                <br />
                {LEGAL_COMPANY_NAME} · Company No. {LEGAL_COMPANY_NUMBER}
                <br />
                {LEGAL_REGISTERED_OFFICE}
              </Text>
              <Text className="m-[16px] text-center text-[12px] text-[#A1A1AA]">
                {SOCIAL_LINKS.map((link, index) => (
                  <span key={link.icon}>
                    {index > 0 ? " | " : null}
                    <Link href={link.href} className="text-[#D4AF37] no-underline">
                      {link.label}
                    </Link>
                  </span>
                ))}
              </Text>
              <Text className="m-[8px] text-center text-[12px] text-[#A1A1AA]">
                <Link href={`${effectiveUrl}/privacy`} className="text-[#A1A1AA] underline">
                  Privacy Policy
                </Link>{" "}
                |{" "}
                <Link href={`${effectiveUrl}/terms`} className="text-[#A1A1AA] underline">
                  Terms of Service
                </Link>{" "}
                |{" "}
                <Link href={`${effectiveUrl}/contact`} className="text-[#A1A1AA] underline">
                  Contact Us
                </Link>
              </Text>
              <Text className="m-[24px] text-center text-[11px] text-[#A1A1AA]">
                &copy; {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
              </Text>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}

export const emailStyles = {
  heading: { className: "text-[24px] font-semibold text-center text-[#FFFFFF] mb-[16px]" },
  subheading: { className: "text-[20px] font-semibold text-[#FFFFFF] mb-[16px]" },
  paragraph: { className: "text-[15px] leading-[24px] text-[#FFFFFF] mb-[16px]" },
  button: {
    className:
      "bg-[#D4AF37] rounded-[6px] text-[#0A0A0B] font-semibold px-[24px] py-[12px] no-underline inline-block text-center",
  },
  divider: { className: "mx-0 my-[24px] w-full border border-solid" },
  muted: { className: "text-[12px] leading-[20px] text-[#A1A1AA]" },
};
