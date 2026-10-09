import type { ContentFeature } from "@oc/content";
import { Shield } from "@oc/icons";
import { useTranslation } from "@/lib/i18n";
import { getHowItWorksIcon } from "./icon-map";

interface HowItWorksFeaturesProps {
  features: ContentFeature[];
}

function FeatureCard({ feature, large = false }: { feature: ContentFeature; large?: boolean }) {
  const Icon = getHowItWorksIcon(feature.icon, Shield);

  return (
    <div
      className={
        large
          ? "h-full rounded-2xl border border-gold/10 bg-card p-6 sm:p-8 md:p-10 shadow-sm transition-colors duration-300 hover:border-gold/30"
          : "h-full rounded-2xl border border-gold/10 bg-card p-5 sm:p-6 shadow-sm transition-colors duration-300 hover:border-gold/30"
      }
    >
      <div className="flex items-start gap-4 sm:gap-5">
        <div
          className={
            large
              ? "flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl bg-gold/10"
              : "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold/10"
          }
        >
          <Icon
            className={large ? "h-7 w-7 sm:h-8 sm:w-8 text-gold" : "h-5 w-5 text-gold"}
            aria-hidden
          />
        </div>
        <div className="min-w-0 space-y-1.5 sm:space-y-2">
          <h3
            className={
              large
                ? "text-xl sm:text-2xl font-bold tracking-tight text-foreground"
                : "text-base font-semibold tracking-tight text-foreground"
            }
          >
            {feature.title}
          </h3>
          <p
            className={
              large
                ? "text-sm sm:text-base text-muted-foreground leading-relaxed"
                : "text-sm text-muted-foreground leading-relaxed"
            }
          >
            {feature.description}
          </p>
        </div>
      </div>
    </div>
  );
}

export function HowItWorksFeatures({ features }: HowItWorksFeaturesProps) {
  const { t } = useTranslation();
  const [featured, ...rest] = features;

  return (
    <section
      aria-labelledby="how-it-works-features-heading"
      className="relative py-16 sm:py-20 lg:py-24 -mx-[clamp(1rem,2.5vw,4rem)] px-[clamp(1rem,2.5vw,4rem)] mb-20 sm:mb-24 overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-card/40 via-card/20 to-transparent" />
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" aria-hidden />

      <div className="relative">
        <div className="text-center mb-12 sm:mb-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold mb-2">
            {t("staticPages.howItWorks.whyOnlineCompetitions")}
          </p>
          <h2
            id="how-it-works-features-heading"
            className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground text-balance"
          >
            {t("staticPages.howItWorks.whyChooseOnlineCompetitions")} <span className="text-gold">Online Competitions</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
          {featured && (
            <div className="lg:col-span-2 lg:row-span-2">
              <FeatureCard feature={featured} large />
            </div>
          )}
          {rest.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  );
}
