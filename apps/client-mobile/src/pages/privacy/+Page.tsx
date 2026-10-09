import {
  privacyIntro as privacyIntroEN,
  privacySections as privacySectionsEN,
} from "@oc/content/legal";
import { Hash } from "@oc/icons";
import { GoldOutlineButton } from "@/components/buttons";
import { Link } from "@/components/Link";
import { useTranslation } from "@/lib/i18n";

export default function PrivacyPage() {
  const { t, locale } = useTranslation();
  const intro = privacyIntroEN;
  const sections = privacySectionsEN;

  return (
    <div className="oc-container-content pb-8">
      <div className="py-8 lg:py-16">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4 text-balance">
            {t("staticPages.privacy.heading")}
          </h1>
          <p className="text-muted-foreground">
            {t("staticPages.privacy.lastUpdated", { date: intro.lastUpdated })}
          </p>
        </div>

        <div className="relative overflow-hidden rounded-[1.5rem] mb-8">
          <div className="p-1.5 rounded-[1.5rem] bg-white/5 ring-1 ring-white/10">
            <div className="rounded-[calc(1.5rem-0.375rem)] bg-card p-6">
              <h2 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
                {t("staticPages.privacy.contents")}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-gold transition-colors py-1"
                  >
                    <Hash className="w-3.5 h-3.5 text-gold/50 flex-shrink-0" />
                    <span>{section.title.replace(/^\d+\.\s*/, "")}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {sections.map((section) => (
            <div
              key={section.id}
              id={section.id}
              className="relative overflow-hidden rounded-[1.5rem]"
            >
              <div className="p-1.5 rounded-[1.5rem] bg-white/5 ring-1 ring-white/10">
                <div className="rounded-[calc(1.5rem-0.375rem)] bg-card p-6 sm:p-8">
                  <h2 className="text-lg font-semibold text-foreground mb-4">{section.title}</h2>
                  {section.content}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            {t("staticPages.privacy.haveQuestions")}
          </p>
          <GoldOutlineButton asChild>
            <Link href="/contact">{t("staticPages.privacy.contactUs")}</Link>
          </GoldOutlineButton>
        </div>
      </div>
    </div>
  );
}
