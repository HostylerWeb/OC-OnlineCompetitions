"use client";

import type { LucideIcon } from "@oc/icons";
import { Globe, Lock, MapPin, Shield, User } from "@oc/icons";
import { cn } from "@oc/utils";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/lib/i18n";

export type ProfileTab = "personal" | "address" | "social" | "privacy" | "security";

const PROFILE_TABS: { value: ProfileTab; labelKey: string; icon: LucideIcon }[] = [
  { value: "personal", labelKey: "profile.tabs.personal", icon: User },
  { value: "address", labelKey: "profile.tabs.address", icon: MapPin },
  { value: "social", labelKey: "profile.tabs.social", icon: Globe },
  { value: "privacy", labelKey: "profile.tabs.privacy", icon: Shield },
  { value: "security", labelKey: "profile.tabs.security", icon: Lock },
];

interface ProfileNavTabsProps {
  className?: string;
}

export function ProfileNavTabs({ className }: ProfileNavTabsProps) {
  const { t } = useTranslation();
  return (
    <TabsList
      className={cn(
        "h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-border/60 bg-muted/30 p-1 sm:flex-nowrap",
        "lg:flex-col lg:items-stretch lg:gap-0.5 lg:p-1.5",
        className
      )}
    >
      {PROFILE_TABS.map(({ value, labelKey, icon: Icon }) => (
        <TabsTrigger
          key={value}
          value={value}
          data-umami-event="profile:tab-switch"
          data-umami-event-tab={value}
          className={cn(
            "h-9 flex-1 gap-2 rounded-lg px-3 text-xs sm:flex-none sm:text-sm",
            "data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-gold",
            "lg:h-10 lg:w-full lg:flex-none lg:justify-start lg:px-3.5"
          )}
        >
          <Icon className="size-3.5 shrink-0" aria-hidden="true" />
          {t(labelKey as any)}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
