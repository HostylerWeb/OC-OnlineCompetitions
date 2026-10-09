import {
  FAQ_CATEGORIES as FAQ_CATEGORIES_EN,
  FAQS_BY_CATEGORY as FAQS_BY_CATEGORY_EN,
} from "@oc/content/faqs";
import { resolveContent } from "@oc/content/locales";
import {
  FAQ_CATEGORIES as FAQ_CATEGORIES_RO,
  FAQS_BY_CATEGORY as FAQS_BY_CATEGORY_RO,
} from "@oc/content/ro";
import { ArrowRight, HelpCircle } from "@oc/icons";
import { GoldGhostButton, GoldOutlineButton } from "@/components/buttons";
import FaqTabs from "@/components/faq/FaqTabs";
import { Link } from "@/components/Link";
import { useTranslation } from "@/lib/i18n";

export default function FaqPage() {
  const { t, locale } = useTranslation();
  const faqCategories = resolveContent(locale, FAQ_CATEGORIES_EN, FAQ_CATEGORIES_RO);
  const faqsByCategory = resolveContent(locale, FAQS_BY_CATEGORY_EN, FAQS_BY_CATEGORY_RO);
  const filteredCategories = faqCategories.filter(
    (cat) => (faqsByCategory[cat.id]?.length ?? 0) > 0
  );

  return (
    <div className="oc-container-content pb-8">
      <div className="py-8 lg:py-16">
        <div className="text-center mb-12">
          <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-4">
            <HelpCircle className="w-8 h-8 text-gold" />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4 text-balance">
            {t("staticPages.faq.heading")}
          </h1>
          <p className="text-lg text-muted-foreground">{t("staticPages.faq.subtitle")}</p>
        </div>

        <FaqTabs categories={filteredCategories} faqsByCategory={faqsByCategory} />

        <div className="relative overflow-hidden rounded-[2rem]">
          <div className="p-1.5 rounded-[2rem] bg-gold/5 ring-1 ring-gold/20">
            <div className="rounded-[calc(2rem-0.375rem)] bg-card p-8 text-center">
              <h3 className="text-xl font-bold text-foreground mb-2">
                {t("staticPages.faq.ctaHeading")}
              </h3>
              <p className="text-muted-foreground mb-6">
                {t("staticPages.faq.ctaBody", { email: t("staticPages.faq.contactEmail") })}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <GoldGhostButton asChild>
                  <Link href="/contact" data-umami-event="faq:get-in-touch">
                    {t("staticPages.faq.getInTouch")}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </GoldGhostButton>
                <GoldOutlineButton asChild>
                  <Link href="/how-it-works" data-umami-event="faq:how-it-works">
                    {t("staticPages.faq.howItWorks")}
                    <HelpCircle className="w-4 h-4 ml-2" />
                  </Link>
                </GoldOutlineButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
