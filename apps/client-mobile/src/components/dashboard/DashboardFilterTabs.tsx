"use client";

import { cn } from "@oc/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface DashboardFilterOption<T extends string> {
  value: T;
  label: string;
}

interface DashboardFilterTabsProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly DashboardFilterOption<T>[];
  fullWidth?: boolean;
  className?: string;
  umamiEvent?: string;
}

export function DashboardFilterTabs<T extends string>({
  value,
  onValueChange,
  options,
  fullWidth = true,
  className,
  umamiEvent,
}: DashboardFilterTabsProps<T>) {
  return (
    <Tabs
      value={value}
      onValueChange={(nextValue) => nextValue && onValueChange(nextValue as T)}
      className={cn("gap-0", className)}
    >
      <TabsList className={cn("h-9 justify-start", fullWidth ? "w-full" : "w-fit max-w-full")}>
        {options.map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            data-umami-event={umamiEvent}
            data-umami-event-filter={option.value}
          >
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
