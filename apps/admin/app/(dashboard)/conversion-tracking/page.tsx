"use client";

import { useAdminConversionSettings } from "@oc/api-admin";
import { Link2, Settings } from "@oc/icons";
import { useMemo, useState } from "react";
import { ConversionSettingsDialog } from "@/components/conversion-tracking/ConversionSettingsDialog";
import {
  type ConversionSettingsFormValues,
  EVENT_KEYS,
  EVENT_LABELS,
  mergeWithDefaults,
} from "@/components/conversion-tracking/settings-schema";
import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default function ConversionTrackingAdminPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data } = useAdminConversionSettings();

  const dbSettings = (data?.data ?? {}) as Partial<ConversionSettingsFormValues>;
  const display = useMemo(() => mergeWithDefaults(dbSettings), [dbSettings]);

  return (
    <PageShell
      title="Conversion Tracking"
      description="CPA affiliate network postbacks and analytics tracking."
      actions={
        <Button
          variant="outline"
          onClick={() => setDialogOpen(true)}
          data-umami-event="conversion:edit-open"
        >
          <Settings className="size-4" />
          Edit settings
        </Button>
      }
    >
      <div className="mb-8 flex items-center gap-3 rounded-lg border p-4">
        <span className="text-sm text-muted-foreground">Master toggle:</span>
        <Badge variant={display.enabled ? "default" : "outline"}>
          {display.enabled ? "Enabled" : "Disabled"}
        </Badge>
        {!display.enabled ? (
          <span className="text-xs text-muted-foreground">
            No postbacks or analytics events will fire.
          </span>
        ) : null}
      </div>

      <Section title="Default Payouts">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {EVENT_KEYS.map((event) => (
            <Card key={event}>
              <CardContent className="p-3">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {EVENT_LABELS[event]}
                </span>
                <p className="mt-1 text-lg font-bold">
                  {display.defaultPayouts[event] > 0 ? (
                    <>&pound;{display.defaultPayouts[event]}</>
                  ) : (
                    <span className="text-muted-foreground">&mdash;</span>
                  )}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Trackers">
        {display.trackers.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Link2 className="size-4" />
            </EmptyMedia>
            <EmptyTitle>No trackers configured</EmptyTitle>
          </Empty>
        ) : (
          <div className="flex flex-col gap-3">
            {display.trackers.map((tracker) => (
              <Card key={tracker.id}>
                <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
                  <div className="flex items-center gap-2">
                    <Link2 className="size-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-semibold">{tracker.name}</CardTitle>
                    <Badge variant={tracker.enabled ? "default" : "outline"}>
                      {tracker.enabled ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2 pb-3">
                  {EVENT_KEYS.map((event) => {
                    const cfg = tracker.events?.[event];
                    if (!cfg?.enabled) return null;
                    return (
                      <Badge key={event} variant="secondary">
                        {EVENT_LABELS[event]}
                        {cfg.payoutOverride != null ? ` · £${cfg.payoutOverride}` : ""}
                      </Badge>
                    );
                  })}
                  {!EVENT_KEYS.some((e) => tracker.events?.[e]?.enabled) ? (
                    <span className="text-xs text-muted-foreground">No events enabled</span>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section title="Analytics">
        <div className="flex flex-col gap-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-3">
              <span className="text-sm text-muted-foreground">Google Analytics:</span>
              <span className="font-mono text-sm">
                {display.googleAnalytics.measurementId || "Not set"}
              </span>
              <Badge variant={display.googleAnalytics.enabled ? "default" : "outline"}>
                {display.googleAnalytics.enabled ? "Enabled" : "Disabled"}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-3">
              <span className="text-sm text-muted-foreground">Facebook Pixel:</span>
              <span className="font-mono text-sm">
                {display.facebookPixel.pixelId || "Not set"}
              </span>
              <Badge variant={display.facebookPixel.enabled ? "default" : "outline"}>
                {display.facebookPixel.enabled ? "Enabled" : "Disabled"}
              </Badge>
            </CardContent>
          </Card>
        </div>
      </Section>

      <ConversionSettingsDialog open={dialogOpen} onOpenChange={setDialogOpen} data={dbSettings} />
    </PageShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}
