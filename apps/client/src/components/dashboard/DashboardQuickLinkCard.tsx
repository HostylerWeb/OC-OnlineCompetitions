"use client";

import type { LucideIcon } from "@oc/icons";
import { cn } from "@oc/utils";

interface DashboardQuickLinkCardProps {
  href: string;
  label: string;
  icon: LucideIcon;
}

export function DashboardQuickLinkCard({ href, label, icon: Icon }: DashboardQuickLinkCardProps) {
  return (
    <a
      href={href}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-3",
        "h-auto w-full justify-start gap-2 border-border/50 bg-transparent px-3 py-2 shadow-none",
        "transition-[color,border-color] duration-200",
        "hover:border-primary/35 hover:bg-transparent hover:text-foreground",
        "active:bg-transparent"
      )}
    >
      <Icon data-icon="inline-start" aria-hidden="true" />
      <span className="truncate text-sm font-medium">{label}</span>
    </a>
  );
}
