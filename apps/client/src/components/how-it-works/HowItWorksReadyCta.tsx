import { ArrowRight } from "@oc/icons";
import { GoldOutlineButton } from "@/components/buttons";
import { Link } from "@/components/Link";
import { useTranslation } from "@/lib/i18n";

export function HowItWorksReadyCta() {
  const { t } = useTranslation();

  return (
    <section
      aria-labelledby="how-it-works-ready-heading"
      className="relative py-16 sm:py-20 -mx-[clamp(1rem,2.5vw,4rem)] px-[clamp(1rem,2.5vw,4rem)] overflow-hidden rounded-[2rem]"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-gold/10 via-background to-gold/5" />
      <div
        className="absolute top-0 left-1/4 h-48 w-48 sm:h-64 sm:w-64 bg-gold/15 rounded-full blur-3xl"
        aria-hidden
      />
      <div
        className="absolute bottom-0 right-1/4 h-48 w-48 sm:h-64 sm:w-64 bg-gold/15 rounded-full blur-3xl"
        aria-hidden
      />

      <div className="relative text-center space-y-6 sm:space-y-8 max-w-2xl mx-auto">
        <h2
          id="how-it-works-ready-heading"
          className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground text-balance"
        >
          {t("staticPages.howItWorks.readyToStart")}
        </h2>
        <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
          {t("staticPages.howItWorks.readyToStartDesc")}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-2">
          <GoldOutlineButton asChild size="lg" className="w-full sm:w-auto">
            <Link href="/competitions" data-umami-event="how-it-works:cta-click">
              {t("staticPages.howItWorks.browseCompetitions")}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </GoldOutlineButton>
          <GoldOutlineButton asChild size="lg" className="w-full sm:w-auto">
            <Link href="/auth/sign-up" data-umami-event="how-it-works:cta-click">
              {t("staticPages.howItWorks.createAccount")}
            </Link>
          </GoldOutlineButton>
        </div>
      </div>
    </section>
  );
}
