"use client";

import { useAdminConversionSettingsMutations } from "@oc/api-admin";
import { Link2, Loader2, Plus, Settings2, Trash2 } from "@oc/icons";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { handleFormError } from "@/lib/handle-form-error";
import { createZodResolver } from "@/lib/zod-resolver";
import { PostbackLogsTab } from "./PostbackLogsTab";
import {
  type ConversionSettingsFormValues,
  conversionSettingsSchema,
  DEFAULTS,
  EVENT_KEYS,
  EVENT_LABELS,
  emptyEvent,
  mergeWithDefaults,
  newTracker,
  TRAFFIC_SOURCES,
} from "./settings-schema";

interface ConversionSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data?: Partial<ConversionSettingsFormValues>;
}

export function ConversionSettingsDialog({
  open,
  onOpenChange,
  data,
}: ConversionSettingsDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const { saveSettingsMutation } = useAdminConversionSettingsMutations();

  const display = useMemo(() => mergeWithDefaults(data ?? {}), [data]);

  const form = useForm<ConversionSettingsFormValues>({
    resolver: createZodResolver(conversionSettingsSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (open) {
      form.reset(display);
      setError(null);
      setActiveTab("overview");
    }
  }, [open, display, form]);

  const trackers = form.watch("trackers");

  const onSubmit = form.handleSubmit(async (raw) => {
    const values = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
    if (Array.isArray(values.trackers)) {
      for (const tracker of values.trackers as Array<Record<string, unknown>>) {
        const events = tracker.events as Record<string, unknown>;
        for (const eventKey of Object.keys(events)) {
          const ev = events[eventKey] as Record<string, unknown> | null;
          if (ev && typeof ev.extraParams === "string" && ev.extraParams) {
            const parsed: Record<string, string> = {};
            (ev.extraParams as string).split("&").forEach((pair) => {
              const eqIdx = pair.indexOf("=");
              if (eqIdx > 0) {
                parsed[decodeURIComponent(pair.slice(0, eqIdx))] = decodeURIComponent(
                  pair.slice(eqIdx + 1)
                );
              } else if (pair) {
                parsed[decodeURIComponent(pair)] = "";
              }
            });
            ev.extraParams = parsed;
          }
        }
      }
    }
    try {
      await saveSettingsMutation.mutateAsync(values);
      toast.success("Conversion settings saved");
      onOpenChange(false);
    } catch (err) {
      const msg = handleFormError(form, err);
      if (msg) setError(msg);
      if (!msg) toast.error("Please check the highlighted fields");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-0 p-0">
        <Form {...form}>
          <form onSubmit={onSubmit} className="flex h-full flex-col">
            <DialogHeader className="border-b border-border/60 px-6 py-4">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Settings2 className="size-5" />
                Conversion tracking settings
              </DialogTitle>
              <DialogDescription>
                Configure CPA affiliate network postbacks and analytics tracking.
              </DialogDescription>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden">
              <TabsList className="mx-6 mt-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="trackers">Trackers</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
                <TabsTrigger value="logs">Logs</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                {error && (
                  <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                <TabsContent value="overview" className="mt-0 space-y-6">
                  <OverviewTab form={form} />
                </TabsContent>
                <TabsContent value="trackers" className="mt-0 space-y-6">
                  <TrackersTab
                    form={form}
                    trackers={trackers}
                    onAdd={() => {
                      const current = form.getValues("trackers");
                      form.setValue("trackers", [...current, newTracker()]);
                    }}
                    onRemove={(index) => {
                      const current = form.getValues("trackers");
                      form.setValue(
                        "trackers",
                        current.filter((_, i) => i !== index)
                      );
                    }}
                  />
                </TabsContent>
                <TabsContent value="analytics" className="mt-0 space-y-6">
                  <AnalyticsTab form={form} />
                </TabsContent>
                <TabsContent value="logs" className="mt-0">
                  <PostbackLogsTab />
                </TabsContent>
              </div>
            </Tabs>

            <DialogFooter className="border-t border-border/60 bg-muted/20 px-6 py-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saveSettingsMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveSettingsMutation.isPending}
                data-umami-event="conversion:settings-save"
              >
                {saveSettingsMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

type TabForm = ReturnType<typeof useForm<ConversionSettingsFormValues>>;

function OverviewTab({ form }: { form: TabForm }) {
  return (
    <>
      <FormField
        control={form.control}
        name="enabled"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div>
              <FormLabel className="text-base">Enable conversion tracking</FormLabel>
              <FormDescription>
                Master toggle for all postbacks and analytics events.
              </FormDescription>
            </div>
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                data-umami-event="conversion:toggle-master"
              />
            </FormControl>
          </FormItem>
        )}
      />

      <div>
        <h4 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Default payouts
        </h4>
        <Card>
          <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
            {EVENT_KEYS.map((event) => (
              <FormField
                key={event}
                control={form.control}
                name={`defaultPayouts.${event}`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{EVENT_LABELS[event]}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                          &pound;
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          className="pl-7"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>Fallback payout when no override is set.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </CardContent>
        </Card>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Traffic sources
        </h4>
        <Card>
          <CardContent className="flex flex-col gap-2 p-4">
            <p className="text-sm text-muted-foreground">
              Append <code className="rounded bg-muted px-1 font-mono text-xs">source=XX</code> to
              each ad network's landing URL. The code is captured and stored per user, so revenue
              can be attributed to the source of traffic.
            </p>
            {TRAFFIC_SOURCES.map((s) => (
              <div
                key={s.code}
                className="flex flex-col gap-1 rounded-md border border-border/60 p-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{s.code}</span>
                  <span className="text-sm">{s.name}</span>
                </div>
                <code className="break-all rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                  {s.landingParamHint}
                </code>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function TrackersTab({
  form,
  trackers,
  onAdd,
  onRemove,
}: {
  form: TabForm;
  trackers: ConversionSettingsFormValues["trackers"];
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Trackers
        </h4>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onAdd}
          data-umami-event="conversion:add-tracker"
        >
          <Plus className="mr-1 size-3" />
          Add tracker
        </Button>
      </div>

      {trackers.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <Link2 className="size-4" />
          </EmptyMedia>
          <EmptyTitle>No trackers configured</EmptyTitle>
        </Empty>
      ) : (
        <div className="flex flex-col gap-4">
          {trackers.map((tracker, i) => (
            <Card key={tracker.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
                <FormField
                  control={form.control}
                  name={`trackers.${i}.name`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input {...field} placeholder="Tracker name" className="max-w-xs" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-center gap-2">
                  <FormField
                    control={form.control}
                    name={`trackers.${i}.enabled`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 text-destructive"
                    onClick={() => onRemove(i)}
                    data-umami-event="conversion:remove-tracker"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {EVENT_KEYS.map((event) => (
                  <EventRow key={event} form={form} trackerIndex={i} event={event} />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function EventRow({
  form,
  trackerIndex,
  event,
}: {
  form: TabForm;
  trackerIndex: number;
  event: (typeof EVENT_KEYS)[number];
}) {
  return (
    <div className="rounded-md border p-3">
      <FormField
        control={form.control}
        name={`trackers.${trackerIndex}.events.${event}`}
        render={({ field }) => (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <FormLabel className="mb-0 text-xs font-medium">{EVENT_LABELS[event]}</FormLabel>
              <FormControl>
                <Switch
                  checked={field.value?.enabled ?? false}
                  onCheckedChange={(checked) => {
                    field.onChange(checked ? { ...emptyEvent(), enabled: true } : null);
                  }}
                />
              </FormControl>
            </div>

            {field.value?.enabled && (
              <div className="flex flex-col gap-3">
                <FormField
                  control={form.control}
                  name={`trackers.${trackerIndex}.events.${event}.urlTemplate`}
                  render={(sub) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          {...sub.field}
                          placeholder="https://network.example/conv/?clickid={clickid}&payout={payout}"
                          className="font-mono text-xs"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name={`trackers.${trackerIndex}.events.${event}.method`}
                    render={(sub) => (
                      <FormItem>
                        <FormLabel className="text-xs">Method</FormLabel>
                        <Select value={sub.field.value ?? "GET"} onValueChange={sub.field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GET">GET</SelectItem>
                            <SelectItem value="POST">POST</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`trackers.${trackerIndex}.events.${event}.payoutOverride`}
                    render={(sub) => (
                      <FormItem>
                        <FormLabel className="text-xs">Payout override (&pound;)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="Empty = default payout"
                            {...sub.field}
                            value={sub.field.value ?? ""}
                            onChange={(e) =>
                              sub.field.onChange(e.target.value ? Number(e.target.value) : null)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name={`trackers.${trackerIndex}.events.${event}.extraParams`}
                  render={(sub) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          {...sub.field}
                          placeholder="Static params (key=value&key2=value2)"
                          className="font-mono text-xs"
                        />
                      </FormControl>
                      <FormDescription>Static params appended to the URL.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>
        )}
      />
    </div>
  );
}

function AnalyticsTab({ form }: { form: TabForm }) {
  return (
    <>
      <div>
        <h4 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Google Analytics (GA4)
        </h4>
        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <FormField
              control={form.control}
              name="googleAnalytics.enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between">
                  <FormLabel className="mb-0">Enable GA4 tracking</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-umami-event="conversion:toggle-ga4"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="googleAnalytics.measurementId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Measurement ID</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="G-XXXXXXXXXX" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="googleAnalytics.apiSecret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API secret</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="From GA4 Admin → Streams → Measurement Protocol"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <AnalyticsEvents form={form} prefix="googleAnalytics.events" />
          </CardContent>
        </Card>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Facebook Pixel (Meta CAPI)
        </h4>
        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <FormField
              control={form.control}
              name="facebookPixel.enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between">
                  <FormLabel className="mb-0">Enable Facebook Pixel</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-umami-event="conversion:toggle-facebook"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="facebookPixel.pixelId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pixel ID</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="123456789012345" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="facebookPixel.accessToken"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Access token</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="From Facebook Business Manager"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <AnalyticsEvents form={form} prefix="facebookPixel.events" />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function AnalyticsEvents({ form, prefix }: { form: TabForm; prefix: string }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {EVENT_KEYS.map((event) => (
        <FormField
          key={event}
          control={form.control}
          name={`${prefix}.${event}` as never}
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-md border p-2">
              <FormLabel className="mb-0 text-xs">{EVENT_LABELS[event]}</FormLabel>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
      ))}
    </div>
  );
}
