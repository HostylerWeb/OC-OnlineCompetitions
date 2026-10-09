"use client";
import type { LucideIcon } from "@oc/icons";
import { Inbox } from "@oc/icons";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./ui/empty";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: "default" | "embedded";
  className?: string;
  umamiEvent?: string;
}

function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  variant = "default",
  className,
  umamiEvent,
}: EmptyStateProps) {
  return (
    <Empty
      className={cn(
        variant === "embedded" ? "rounded-none border-0 py-8" : "border-border/60 py-12",
        className
      )}
    >
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className="size-14 rounded-full border border-primary/20 bg-primary/5"
        >
          <Icon className="text-primary/70" />
        </EmptyMedia>
        <EmptyTitle className="text-base font-medium text-foreground">{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {action ? (
        <EmptyContent>
          <Button
            variant="outline"
            size="sm"
            onClick={action.onClick}
            data-umami-event={umamiEvent}
          >
            {action.label}
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}

export type { EmptyStateProps };
export { EmptyState };
