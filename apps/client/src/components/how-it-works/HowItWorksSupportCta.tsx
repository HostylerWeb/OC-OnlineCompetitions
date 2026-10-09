import { ArrowRight, HelpCircle } from "@oc/icons";
import { GoldGhostButton, GoldOutlineButton } from "@/components/buttons";
import { Link } from "@/components/Link";
import { useTranslation } from "@/lib/i18n";

export function HowItWorksSupportCta() {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="how-it-works-support-heading" className="mb-16 sm:mb-20">
      <div className="relative overflow-hidden rounded-[2rem]">
        <div className="p-1.5 rounded-[2rem] bg-gold/5 ring-1 ring-gold/20">
          <div className="rounded-[calc(2rem-0.375rem)] bg-card p-8 sm:p-10">
            <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gold/10 mx-auto lg:mx-0">
                <HelpCircle className="h-7 w-7 text-gold" aria-hidden />
              </div>
              <div className="flex-1 text-center lg:text-left">
                <h2
                  id="how-it-works-support-heading"
                  className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-2"
                >
                  {t("staticPages.howItWorks.haveQuestions")}
                </h2>
                <p className="text-muted-foreground mb-6 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                  {t("staticPages.howItWorks.haveQuestionsDesc")}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                  <GoldGhostButton asChild>
                    <Link href="/faq" data-umami-event="how-it-works:cta-click">
                      {t("staticPages.howItWorks.viewFaq")}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </GoldGhostButton>
                  <GoldOutlineButton asChild>
                    <Link href="/contact" data-umami-event="how-it-works:cta-click">
                      {t("staticPages.howItWorks.contactUs")}
                    </Link>
                  </GoldOutlineButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
