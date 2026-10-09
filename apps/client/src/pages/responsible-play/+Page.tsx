"use client";

import { deriveComplianceFeatures, isResponsiblePlaySectionVisible } from "@oc/api-client";
import {
  RESPONSIBLE_PLAY_SECTIONS as RESPONSIBLE_PLAY_SECTIONS_EN,
  SUPPORT_ORGANISATIONS as SUPPORT_ORGANISATIONS_EN,
} from "@oc/content";
import {
  Calendar,
  CreditCard,
  LifeBuoy,
  type LucideIcon,
  Mail,
  Shield,
  TrendingDown,
  Trophy,
  Users,
  Zap,
} from "@oc/icons";
import { usePageContext } from "vike-react/usePageContext";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/lib/i18n";
import { useRouter } from "@/lib/navigation";

const SECTION_ICONS: Record<string, LucideIcon> = {
  age: Shield,
  "credit-cap": CreditCard,
  "instant-win": Zap,
  "spend-limits": TrendingDown,
  "self-exclusion": LifeBuoy,
  postal: Mail,
  draws: Trophy,
};

export default function ResponsiblePlayPage() {
  const { t, locale } = useTranslation();
  const pageContext = usePageContext();
  const features = deriveComplianceFeatures(
    pageContext.complianceFeaturesData?.data,
    !pageContext.complianceFeaturesData
  );
  const router = useRouter();

  const sections = RESPONSIBLE_PLAY_SECTIONS_EN;
  const orgs = SUPPORT_ORGANISATIONS_EN;

  if (features.isLoading) {
    return (
      <div className="oc-container-narrow pb-12">
        <div className="py-8 lg:py-12 space-y-6">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-14 w-14 rounded-2xl" shimmer />
            <Skeleton className="h-10 w-64" shimmer />
            <Skeleton className="h-5 w-96 max-w-full" shimmer />
          </div>
          <Skeleton className="h-32 w-full rounded-2xl" shimmer />
          <Skeleton className="h-32 w-full rounded-2xl" shimmer />
          <Skeleton className="h-32 w-full rounded-2xl" shimmer />
        </div>
      </div>
    );
  }

  if (!features.publicResponsiblePlayPage) {
    router.replace("/");
    return null;
  }

  const visibleSections = sections.filter((section) =>
    isResponsiblePlaySectionVisible(section.id, features)
  );

  return (
    <div className="oc-container-narrow pb-12">
      <div className="py-8 lg:py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gold/15 mb-4">
            <Shield className="w-7 h-7 text-gold" />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-3 text-balance">
            {t("staticPages.responsiblePlay.heading")}
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {t("staticPages.responsiblePlay.subtitle")}
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {visibleSections.map((section) => {
            const Icon = SECTION_ICONS[section.id] ?? Calendar;
            return (
              <section
                key={section.id}
                className="rounded-2xl border border-gold/10 bg-card/50 p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10">
                    <Icon className="h-5 w-5 text-gold" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold mb-2 text-foreground">{section.title}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {section.content}
                    </p>
                  </div>
                </div>
              </section>
            );
          })}

          <section className="rounded-2xl border border-gold/20 bg-gold/5 p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15">
                <Users className="h-5 w-5 text-gold" aria-hidden />
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                {t("staticPages.responsiblePlay.supportOrgs")}
              </h2>
            </div>
            <ul className="space-y-4">
              {orgs.map((org) => (
                <li key={org.name}>
                  <a
                    href={org.url}
                    className="font-medium text-gold hover:underline"
                    {...(org.url.startsWith("http")
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                  >
                    {org.name}
                  </a>
                  <p className="text-sm text-muted-foreground mt-0.5">{org.description}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
