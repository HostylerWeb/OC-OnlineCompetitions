import type { HowItWorksStep } from "@oc/content";
import { Trophy } from "@oc/icons";
import { cn } from "@oc/utils";
import { useTranslation } from "@/lib/i18n";
import { getHowItWorksIcon } from "./icon-map";

interface HowItWorksStepsProps {
  steps: HowItWorksStep[];
}

export function HowItWorksSteps({ steps }: HowItWorksStepsProps) {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="how-it-works-steps-heading" className="mb-20 sm:mb-24 lg:mb-28">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10 sm:mb-12">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold mb-2">
            {t("staticPages.howItWorks.yourJourney")}
          </p>
          <h2
            id="how-it-works-steps-heading"
            className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground text-balance"
          >
            {t("staticPages.howItWorks.fromBrowseToWin")}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground sm:max-w-xs sm:text-right leading-relaxed">
          {t("staticPages.howItWorks.stepDescription")}
        </p>
      </div>

      <ol className="relative animate-fade-in-stagger">
        {steps.map((step, index) => {
          const Icon = getHowItWorksIcon(step.icon, Trophy);
          const isLast = index === steps.length - 1;

          return (
            <li key={step.stepNumber} className={cn("relative", !isLast && "pb-8 sm:pb-10")}>
              {!isLast && (
                <span
                  className="absolute left-[1.125rem] sm:left-[1.375rem] top-11 sm:top-12 bottom-0 w-px bg-gradient-to-b from-gold/50 via-gold/20 to-transparent"
                  aria-hidden
                />
              )}

              <div className="relative flex gap-5 sm:gap-6">
                <div
                  className="relative z-10 flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10 shadow-[0_0_20px_rgb(var(--gold-rgb)/0.12)]"
                  aria-hidden
                >
                  <span className="text-sm font-bold tabular-nums text-gold">
                    {step.stepNumber}
                  </span>
                </div>

                <article className="min-w-0 flex-1 rounded-2xl border border-gold/10 bg-card p-5 sm:p-6 md:p-7 shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-gold/25 hover:shadow-[0_8px_30px_rgb(0_0_0/0.08)]">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold/10 sm:h-14 sm:w-14 sm:rounded-2xl">
                      <Icon className="h-6 w-6 text-gold sm:h-7 sm:w-7" aria-hidden />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <h3 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
                        {step.title}
                      </h3>
                      <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </article>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
