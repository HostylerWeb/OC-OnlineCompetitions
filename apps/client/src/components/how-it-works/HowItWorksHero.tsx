import { HelpCircle } from "@oc/icons";
import { useTranslation } from "@/lib/i18n";

export function HowItWorksHero() {
  const { t } = useTranslation();

  return (
    <header className="text-center mb-14 sm:mb-16 lg:mb-20">
      <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-5 ring-1 ring-gold/15">
        <HelpCircle className="w-8 h-8 text-gold" aria-hidden />
      </div>
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-4 text-balance">
        {t("staticPages.howItWorks.heading")}
      </h1>
      <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed text-pretty">
        {t("staticPages.howItWorks.subtitle")}
      </p>
      <p className="mt-5 text-sm sm:text-base font-medium text-foreground/90 max-w-xl mx-auto">
        {t("staticPages.howItWorks.glance")}
      </p>
    </header>
  );
}
