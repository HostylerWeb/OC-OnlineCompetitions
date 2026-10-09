"use client";

import {
  NOTIFICATION_TYPE_DESCRIPTIONS,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPES,
  usePushPreferences,
} from "@oc/api-admin";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import { Spinner } from "../ui/spinner";
import { Switch } from "../ui/switch";

interface PushNotificationPreferencesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PushNotificationPreferences({
  open,
  onOpenChange,
}: PushNotificationPreferencesProps) {
  const { preferences, isLoading, isUpdating, updatePreference } = usePushPreferences();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Notification Preferences</SheetTitle>
          <SheetDescription>
            Choose which types of push notifications you want to receive.
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="mt-12 flex justify-center">
            <Spinner />
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {NOTIFICATION_TYPES.map((type) => (
              <div key={type}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 space-y-0.5">
                    <Label htmlFor={`pref-${type}`}>{NOTIFICATION_TYPE_LABELS[type]}</Label>
                    <p className="text-sm text-muted-foreground">
                      {NOTIFICATION_TYPE_DESCRIPTIONS[type]}
                    </p>
                  </div>
                  <Switch
                    id={`pref-${type}`}
                    checked={preferences[type]}
                    disabled={isUpdating}
                    onCheckedChange={(checked) => updatePreference(type, checked)}
                  />
                </div>
                <Separator className="mt-4" />
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
