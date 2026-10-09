import { cn } from "./cn";
import { formatOrderNumber } from "./format";

export interface OrderNumberCellProps {
  value: number | string | null | undefined;
  className?: string;
}

function renderDisplay(value: number | string | null | undefined): string {
  if (value == null || value === "") return "-";
  if (typeof value === "number") {
    return Number.isFinite(value) ? formatOrderNumber(value) : "-";
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) && value.trim() !== "" ? formatOrderNumber(numeric) : "-";
}

export function OrderNumberCell({ value, className }: OrderNumberCellProps) {
  return (
    <span
      className={cn("inline text-sm text-muted-foreground tabular-nums", className)}
      title={renderDisplay(value)}
    >
      {renderDisplay(value)}
    </span>
  );
}
