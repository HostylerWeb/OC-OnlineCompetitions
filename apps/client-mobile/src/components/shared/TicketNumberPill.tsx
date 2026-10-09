import { formatTicketNumber } from "@oc/utils";
import { cn } from "@/lib/utils";

interface TicketNumberPillProps {
  value: number;
  className?: string;
}

export function TicketNumberPill({ value, className }: TicketNumberPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-bold tabular-nums bg-gold/10 text-gold border border-gold/20 px-2.5 py-1 rounded-md",
        className
      )}
    >
      {formatTicketNumber(value)}
    </span>
  );
}
