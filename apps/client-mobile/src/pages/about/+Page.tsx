import {
  ABOUT_CTA as ABOUT_CTA_EN,
  ABOUT_HERO as ABOUT_HERO_EN,
  ABOUT_SECTIONS as ABOUT_SECTIONS_EN,
} from "@oc/content/about";
import { ArrowRight } from "@oc/icons";
import Accordion from "@/components/about/Accordion";
import { GoldOutlineButton } from "@/components/buttons";
import { Link } from "@/components/Link";
import { useTranslation } from "@/lib/i18n";

export default function AboutPage() {
  const { t, locale } = useTranslation();
  const hero = ABOUT_HERO_EN;
  const sections = ABOUT_SECTIONS_EN;
  const cta = ABOUT_CTA_EN;

  return (
    <div className="oc-container-content pb-8">
      <div className="py-8 lg:py-16">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4 text-foreground text-balance">
            {t("staticPages.about.heading")} <span className="text-gold">Online Competitions</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{hero.subtitle}</p>
        </div>

        <Accordion sections={sections} />

        <div className="text-center">
          <h3 className="text-2xl font-bold text-foreground mb-4">{cta.title}</h3>
          <p className="text-muted-foreground mb-6">{cta.subtitle}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <GoldOutlineButton asChild size="lg">
              <Link href="/competitions" data-umami-event="about:browse-competitions">
                {t("staticPages.about.browseCompetitions")}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </GoldOutlineButton>
            <GoldOutlineButton asChild size="lg">
              <Link href="/how-it-works" data-umami-event="about:how-it-works">
                {t("staticPages.about.howItWorks")}
              </Link>
            </GoldOutlineButton>
          </div>
        </div>
      </div>
    </div>
  );
}
