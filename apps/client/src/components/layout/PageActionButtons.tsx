"use client";

import type { LucideIcon } from "@oc/icons";
import { cn } from "@oc/utils";
import { GoldButton, GoldOutlineButton } from "@/components/buttons";

export interface PageAction {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  iconPosition?: "start" | "end";
  variant?: "gold" | "outline";
  "data-umami-event"?: string;
}

interface PageActionButtonsProps {
  actions: PageAction[];
  className?: string;
}

export function PageActionButtons({ actions, className }: PageActionButtonsProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3",
        className
      )}
    >
      {actions.map((action) => {
        const Icon = action.icon;
        const isGold = action.variant === "gold";
        const ButtonComponent = isGold ? GoldButton : GoldOutlineButton;
        const umamiEvent = action["data-umami-event"];
        const content = (
          <>
            {Icon && action.iconPosition !== "end" ? <Icon className="size-4" aria-hidden /> : null}
            {action.label}
            {Icon && action.iconPosition === "end" ? <Icon className="size-4" aria-hidden /> : null}
          </>
        );

        if (action.href) {
          return (
            <ButtonComponent
              key={action.label}
              asChild
              size="lg"
              className="w-full sm:w-auto whitespace-nowrap"
              {...(umamiEvent ? { "data-umami-event": umamiEvent } : {})}
            >
              <a href={action.href}>{content}</a>
            </ButtonComponent>
          );
        }

        return (
          <ButtonComponent
            key={action.label}
            type="button"
            size="lg"
            className="w-full sm:w-auto whitespace-nowrap"
            onClick={action.onClick}
            {...(umamiEvent ? { "data-umami-event": umamiEvent } : {})}
          >
            {content}
          </ButtonComponent>
        );
      })}
    </div>
  );
}
