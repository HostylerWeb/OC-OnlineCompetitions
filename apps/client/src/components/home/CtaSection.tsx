import { HOME_CTA as HOME_CTA_EN } from "@oc/content/home";
import { ArrowRight, Shield, Users, Zap } from "@oc/icons";
import { GoldOutlineButton } from "@/components/buttons";
import { Link } from "@/components/Link";
import { useTranslation } from "@/lib/i18n";

const iconMap = { Shield, Zap, Users } as const;

export function CtaSection() {
  const { t } = useTranslation();
  const ctaContent = HOME_CTA_EN;
  return (
    <section className="py-20 sm:py-24 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-gold/10 via-background to-gold/10" />
      <div className="absolute top-0 left-1/4 w-48 h-48 sm:w-64 sm:h-64 md:w-96 md:h-96 bg-gold/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-48 h-48 sm:w-64 sm:h-64 md:w-96 md:h-96 bg-gold/20 rounded-full blur-3xl" />

      <div className="oc-container-wide relative z-10">
        <div className="text-center space-y-6 sm:space-y-8">
          <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tighter leading-none">
            <span className="text-gold">{ctaContent.title}</span>
          </h2>

          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-2xl mx-auto px-4">
            {ctaContent.subtitle}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-4 sm:pt-6 md:pt-8 px-4">
            <GoldOutlineButton asChild size="lg" className="w-full sm:w-auto">
              <Link href="/competitions" data-umami-event="home:cta-browse-click">
                {t("home.cta.browseCompetitions")}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </GoldOutlineButton>

            <GoldOutlineButton asChild size="lg" className="w-full sm:w-auto">
              <Link href="/auth/sign-up" data-umami-event="home:cta-sign-up-click">
                {t("home.cta.createAccount")}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </GoldOutlineButton>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 md:gap-8 text-xs sm:text-sm text-muted-foreground pt-4 sm:pt-6 md:pt-8 px-4">
            {ctaContent.trustBadges.map((badge: { icon: keyof typeof iconMap; label: string }) => {
              const BadgeIcon = iconMap[badge.icon];
              return (
                <div key={badge.label} className="flex items-center gap-2">
                  <BadgeIcon className="w-3 h-3 sm:w-4 sm:h-4 text-gold" />
                  <span>{badge.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
