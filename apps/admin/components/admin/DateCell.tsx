import { formatDate } from "@oc/utils";
import { cn } from "@/lib/utils";

const variantClasses = {
  default: "text-foreground",
  relative: "text-muted-foreground",
  compact: "text-sm text-foreground",
} as const;

interface DateCellProps extends React.ComponentProps<"span"> {
  value: Date | string | null | undefined;
  relative?: boolean;
  variant?: "default" | "relative" | "compact";
}

function DateCell({
  value,
  relative = false,
  variant = "default",
  className,
  ...props
}: DateCellProps) {
  if (!value) {
    return (
      <span className={cn(variantClasses[variant], "text-muted-foreground", className)} {...props}>
        --
      </span>
    );
  }

  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return (
      <span className={cn(variantClasses[variant], "text-muted-foreground", className)} {...props}>
        --
      </span>
    );
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const isFuture = diffMs < 0;
  const showRelative = relative || Math.abs(diffDays) <= 7;

  let formatted: string;

  if (showRelative) {
    if (isFuture) {
      const absDiffDays = Math.abs(diffDays);
      if (absDiffDays === 0) {
        const diffHours = Math.abs(Math.floor(diffMs / (1000 * 60 * 60)));
        if (diffHours === 0) {
          const diffMinutes = Math.abs(Math.floor(diffMs / (1000 * 60)));
          formatted = diffMinutes <= 1 ? "in less than a minute" : `in ${diffMinutes} min`;
        } else {
          formatted = diffHours === 1 ? "in 1 hour" : `in ${diffHours} hours`;
        }
      } else if (absDiffDays === 1) {
        formatted = "tomorrow";
      } else if (absDiffDays < 7) {
        formatted = `in ${absDiffDays} days`;
      } else {
        formatted = formatDate(date);
      }
    } else if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        formatted = diffMinutes <= 1 ? "just now" : `${diffMinutes} min ago`;
      } else {
        formatted = diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
      }
    } else if (diffDays === 1) {
      formatted = "yesterday";
    } else if (diffDays < 7) {
      formatted = `${diffDays} days ago`;
    } else {
      formatted = formatDate(date);
    }
  } else {
    formatted = formatDate(date);
  }

  return (
    <span
      className={cn(variantClasses[showRelative ? "relative" : variant], className)}
      title={formatDate(date)}
      {...props}
    >
      {formatted}
    </span>
  );
}

export type { DateCellProps };
export { DateCell };
