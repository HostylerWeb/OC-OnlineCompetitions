import { ArrowDown, ArrowUp, ArrowUpDown } from "@oc/icons";
import { cn } from "@/lib/utils";

interface SortIndicatorProps {
  dir: "asc" | "desc" | false;
  className?: string;
}

function SortIndicator({ dir, className }: SortIndicatorProps) {
  return (
    <span className={cn("inline-flex shrink-0", className)}>
      {dir === "asc" ? (
        <ArrowUp className="size-3 text-foreground" />
      ) : dir === "desc" ? (
        <ArrowDown className="size-3 text-foreground" />
      ) : (
        <ArrowUpDown className="size-3 text-muted-foreground/30" />
      )}
    </span>
  );
}

export type { SortIndicatorProps };
export { SortIndicator };
