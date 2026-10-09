"use client";

import { deriveComplianceFeatures } from "@oc/api-client";
import {
  BRAND_NAME,
  LEGAL_COMPANY_NUMBER_LABEL,
  LEGAL_POSTAL_ADDRESS,
} from "@oc/utils";
import { AlertCircle, Check } from "@oc/icons";
import { usePageContext } from "vike-react/usePageContext";
import { GoldOutlineButton } from "@/components/buttons";
import { Link } from "@/components/Link";
import { type TranslationKey, useTranslation } from "@/lib/i18n";
import { useRouter } from "@/lib/navigation";

function formatPostalAddress(address: string): string[] {
  return address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export default function FreePostalEntryPage() {
  const { t } = useTranslation();
  const pageContext = usePageContext();
  const features = deriveComplianceFeatures(pageContext.complianceFeaturesData?.data, false);
  const router = useRouter();

  if (!features.postalProminence) {
    router.replace("/competitions");
    return null;
  }

  const postalAddress = features.postalEntryAddress || LEGAL_POSTAL_ADDRESS;
  const addressLines = formatPostalAddress(postalAddress);

  return (
    <div className="oc-container-narrow pb-8">
      <div className="py-5 lg:py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4 text-balance">
            {t("staticPages.freePostalEntry.heading")}
          </h1>
          <p className="text-xl text-muted-foreground">
            {t("staticPages.freePostalEntry.subtitle")}
          </p>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] mb-8">
          <div className="p-1.5 rounded-[2rem] bg-white/5 ring-1 ring-white/10">
            <div className="rounded-[calc(2rem-0.375rem)] bg-card p-6 sm:p-8 space-y-8">
              <section>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t("staticPages.freePostalEntry.intro")}
                </p>
              </section>

              <section className="bg-gradient-to-br from-gold/10 to-gold/5 border border-gold/20 rounded-2xl p-6">
                <h3 className="font-semibold mb-3">{t("staticPages.freePostalEntry.sendTo")}</h3>
                <p className="text-lg font-medium text-foreground leading-relaxed">
                  {BRAND_NAME}
                  <br />
                  {addressLines.map((line, i) => (
                    <span key={i}>
                      {line}
                      <br />
                    </span>
                  ))}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {LEGAL_COMPANY_NUMBER_LABEL}
                </p>
              </section>

              <section className="space-y-4">
                <h3 className="font-semibold">{t("staticPages.freePostalEntry.includeHeading")}</h3>
                <ul className="space-y-2">
                  {(
                    t(
                      "staticPages.freePostalEntry.includeItems" as TranslationKey
                    ) as unknown as string[]
                  ).map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 size-4 shrink-0 text-gold" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
                <p className="text-sm text-destructive font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {t("staticPages.freePostalEntry.warning")}
                </p>
              </div>

              <section className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                {(
                  t("staticPages.freePostalEntry.terms" as TranslationKey) as unknown as string[]
                ).map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </section>
            </div>
          </div>
        </div>

        <div className="mt-10 text-center">
          <GoldOutlineButton size="lg" asChild>
            <Link href="/competitions">{t("staticPages.freePostalEntry.browseCompetitions")}</Link>
          </GoldOutlineButton>
        </div>
      </div>
    </div>
  );
}
