import { Check, Clock, X } from "@oc/icons";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";

const variantClasses: Record<string, string> = {
  active: "bg-success/10 border-success/30 text-success",
  draft: "bg-warning/10 border-warning/30 text-warning",
  ended: "bg-muted/20 border-muted/30 text-muted-foreground",
  drawn: "bg-gold/10 border-gold/30 text-gold",
  cancelled: "bg-destructive/10 border-destructive/30 text-destructive",
  pending_draw: "bg-gold/10 border-gold/30 text-gold",
  paid: "bg-success/10 border-success/30 text-success",
  pending: "bg-warning/10 border-warning/30 text-warning",
  processing: "bg-info/10 border-info/30 text-info",
  refunded: "bg-muted/20 border-muted/30 text-muted-foreground",
  failed: "bg-destructive/10 border-destructive/30 text-destructive",
  success: "bg-success/10 border-success/30 text-success",
  warning: "bg-warning/10 border-warning/30 text-warning",
  error: "bg-destructive/10 border-destructive/30 text-destructive",
  info: "bg-gold/10 border-gold/30 text-gold",
};

const statusIcons = {
  active: Check,
  draft: Clock,
  ended: Clock,
  drawn: Check,
  cancelled: X,
  pending_draw: Clock,
  paid: Check,
  pending: Clock,
  processing: Clock,
  refunded: Clock,
  failed: X,
  success: Check,
  warning: Clock,
  error: X,
  info: Check,
} as const;

type StatusVariant = keyof typeof statusIcons;

interface StatusBadgeProps {
  variant: StatusVariant;
  showIcon?: boolean;
  className?: string;
  children?: React.ReactNode;
}

function StatusBadge({
  variant,
  showIcon = true,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  const Icon = statusIcons[variant as keyof typeof statusIcons];

  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border",
        variantClasses[variant] || variantClasses.draft,
        className
      )}
      {...props}
    >
      {showIcon && Icon && <Icon className="w-3 h-3" />}
      {children}
    </Badge>
  );
}

export type { StatusBadgeProps, StatusVariant };
export { StatusBadge };
