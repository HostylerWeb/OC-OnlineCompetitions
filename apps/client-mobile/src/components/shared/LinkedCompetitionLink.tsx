"use client";

import { cn } from "@oc/utils";
import { Link } from "@/components/Link";
import { useTranslation } from "@/lib/i18n";

export function getLinkedCompetitionPath(slug?: string, id?: string): string | undefined {
  if (slug) return `/competitions/${slug}`;
  if (id) return `/competitions/${id}`;
  return undefined;
}

export interface LinkedCompetitionLinkProps {
  title?: string;
  slug?: string;
  id?: string;
  className?: string;
  label?: string;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

export function LinkedCompetitionLink({
  title,
  slug,
  id,
  className,
  label,
  onClick,
}: LinkedCompetitionLinkProps) {
  const { t } = useTranslation();
  const href = getLinkedCompetitionPath(slug, id);
  if (!href) return null;

  const linkLabel =
    label ?? (title ? t("ticketCard.viewTitle", { title }) : t("ticketCard.viewCompetition"));

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "inline-flex max-w-full items-center truncate font-medium text-gold transition-colors hover:text-gold/80 hover:underline",
        className
      )}
    >
      {linkLabel}
    </Link>
  );
}
