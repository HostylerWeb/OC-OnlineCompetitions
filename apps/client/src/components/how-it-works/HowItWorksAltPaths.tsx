import type { HowItWorksAltPath } from "@oc/content";
import { ArrowRight, Mail } from "@oc/icons";
import { Link } from "@/components/Link";
import { useTranslation } from "@/lib/i18n";
import { getHowItWorksIcon } from "./icon-map";

interface HowItWorksAltPathsProps {
  paths: HowItWorksAltPath[];
}

export function HowItWorksAltPaths({ paths }: HowItWorksAltPathsProps) {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="how-it-works-alt-heading" className="mb-20 sm:mb-24">
      <div className="mb-8 sm:mb-10 max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold mb-2">
          {t("staticPages.howItWorks.altPaths.kicker")}
        </p>
        <h2
          id="how-it-works-alt-heading"
          className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground text-balance"
        >
          {t("staticPages.howItWorks.altPaths.heading")}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        {paths.map((path) => {
          const Icon = getHowItWorksIcon(path.icon, Mail);
          return (
            <Link
              key={path.href}
              href={path.href}
              className="group flex h-full items-start gap-4 sm:gap-5 rounded-2xl border border-gold/10 bg-card p-5 sm:p-6 md:p-7 shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-gold/25 hover:shadow-[0_8px_30px_rgb(0_0_0/0.08)]"
              data-umami-event="how-it-works:alt-path-click"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold/10 sm:h-14 sm:w-14 sm:rounded-2xl">
                <Icon className="h-6 w-6 text-gold sm:h-7 sm:w-7" aria-hidden />
              </div>
              <div className="min-w-0 space-y-2">
                <h3 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground group-hover:text-gold transition-colors">
                  {path.title}
                </h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                  {path.description}
                </p>
                <span className="inline-flex items-center text-sm font-medium text-gold pt-1">
                  {t("staticPages.howItWorks.altPaths.learnMore")}
                  <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
