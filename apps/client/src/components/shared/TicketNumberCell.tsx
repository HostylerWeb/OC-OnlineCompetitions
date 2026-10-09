"use client";

import { formatTicketNumber } from "@oc/utils";
import { useTranslation } from "@/lib/i18n";

interface TicketNumberCellProps {
  value: number | null | undefined;
  className?: string;
  prefix?: boolean;
}

export function TicketNumberCell({ value, className, prefix = true }: TicketNumberCellProps) {
  const { t } = useTranslation();
  if (value == null) {
    return (
      <span className={`text-base font-bold text-gold ${className ?? ""}`.trim()}>
        {t("dateFormat.fallback")}
      </span>
    );
  }
  return (
    <span className={`text-base font-bold text-gold tabular-nums ${className ?? ""}`.trim()}>
      {prefix ? "#" : ""}
      {formatTicketNumber(value)}
    </span>
  );
}
