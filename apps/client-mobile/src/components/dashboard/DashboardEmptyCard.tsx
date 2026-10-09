"use client";

import type { LucideIcon } from "@oc/icons";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface DashboardEmptyCardProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  footer?: ReactNode;
  umamiEvent?: string;
}

export function DashboardEmptyCard({
  icon,
  title,
  description,
  action,
  footer,
  umamiEvent,
}: DashboardEmptyCardProps) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="flex flex-col items-center gap-4 py-8">
        <EmptyState
          icon={icon}
          title={title}
          description={description}
          variant="embedded"
          className="border-0 py-4"
        />
        {action ? (
          action.href ? (
            <a
              href={action.href}
              data-umami-event={umamiEvent}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
            >
              {action.label}
            </a>
          ) : (
            <Button variant="outline" onClick={action.onClick} data-umami-event={umamiEvent}>
              {action.label}
            </Button>
          )
        ) : null}
        {footer}
      </CardContent>
    </Card>
  );
}
