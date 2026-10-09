"use client";

import type { Competition } from "@oc/types";
import { Link } from "@/components/Link";
import { useTranslation } from "@/lib/i18n";

export default function CompetitionInfo({ competition }: { competition: Competition }) {
  const { t } = useTranslation();

  return (
    <nav className="flex items-center gap-1.5 lg:gap-2 text-xs lg:text-sm text-muted-foreground mb-4 lg:mb-6">
      <Link href="/" className="hover:text-foreground transition-colors">
        {t("competitions.detail.breadcrumbHome")}
      </Link>
      <span>/</span>
      <Link href="/competitions" className="hover:text-foreground transition-colors">
        {t("competitions.detail.breadcrumbCompetitions")}
      </Link>
      <span>/</span>
      <span className="text-foreground truncate">{competition.title}</span>
    </nav>
  );
}
