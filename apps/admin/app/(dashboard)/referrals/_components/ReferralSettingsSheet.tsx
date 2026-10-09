"use client";

import { Info } from "@oc/icons";
import { useEffect, useMemo } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { FormSheet } from "@/components/FormSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { createZodResolver } from "@/lib/zod-resolver";

function HelpTooltip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
        >
          <Info className="size-3.5" />
          <span className="sr-only">Help</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-80 text-xs leading-relaxed">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

const tierSchema = z.object({
  threshold: z.coerce.number().int().min(0, "Must be 0 or more"),
  tickets: z.coerce.number().int().min(0, "Must be 0 or more"),
  label: z.string().optional(),
});

const referralSettingsFormSchema = z.object({
  tiers: z.array(tierSchema).min(1, "At least one milestone is required"),
  activityWindowDays: z.coerce.number().int().min(1, "Window must be at least 1 day"),
  gracePeriodEnabled: z.boolean(),
  gracePeriodDays: z.coerce.number().int().min(1).max(28).optional(),
  gracePeriodCountsToward: z.enum(["current_tier", "next_tier"]),
  minFirstOrderSpend: z.coerce.number().min(0, "Cannot be negative"),
  refereeRewardEnabled: z.boolean(),
  refereeRewardDiscountPercent: z.coerce.number().min(0).max(100),
  refereeRewardMinOrderValue: z.coerce.number().min(0),
  distributionMode: z.enum(["wallet", "all_competitions"]),
  activityWindowMode: z.enum(["rolling", "fixed_day_of_month"]),
  monthlyCutoffDay: z.coerce.number().int().min(1).max(28).optional(),
  calculusMethod: z.enum(["net", "gross"]),
  guardrailsMaxPerDay: z.coerce.number().int().min(0),
  guardrailsRequireEmailVerification: z.boolean(),
});

type ReferralSettingsFormValues = z.infer<typeof referralSettingsFormSchema>;

const defaultFormValues: ReferralSettingsFormValues = {
  tiers: [
    { threshold: 5, tickets: 2 },
    { threshold: 10, tickets: 5 },
    { threshold: 15, tickets: 10 },
  ],
  activityWindowMode: "rolling",
  monthlyCutoffDay: 25,
  activityWindowDays: 30,
  gracePeriodEnabled: false,
  gracePeriodDays: 3,
  gracePeriodCountsToward: "current_tier",
  minFirstOrderSpend: 1,
  refereeRewardEnabled: true,
  refereeRewardDiscountPercent: 20,
  refereeRewardMinOrderValue: 0,
  distributionMode: "wallet",
  calculusMethod: "gross",
  guardrailsMaxPerDay: 0,
  guardrailsRequireEmailVerification: false,
};

function TierPreviewPanel({
  tiers,
  calculusMethod,
}: {
  tiers: ReferralSettingsFormValues["tiers"];
  calculusMethod?: "net" | "gross";
}) {
  const sorted = [...tiers].sort((a, b) => a.threshold - b.threshold);

  const previews = useMemo(() => {
    const examples = [
      0,
      ...sorted.map((t) => t.threshold),
      Math.max(...sorted.map((t) => t.threshold)) + 5,
    ];
    const unique = [...new Set(examples)].sort((a, b) => a - b);
    return unique.map((count) => {
      let currentTier: (typeof sorted)[number] | null = null;
      for (const t of sorted) {
        if (count >= t.threshold) currentTier = t;
        else break;
      }
      const nextTier = sorted.find((t) => count < t.threshold) ?? null;
      let displayTickets: number;
      if (!currentTier) {
        displayTickets = 0;
      } else if (calculusMethod === "gross") {
        const idx = sorted.findIndex((t) => t.threshold === currentTier.threshold);
        const prevTickets = idx > 0 ? sorted[idx - 1].tickets : 0;
        displayTickets = currentTier.tickets - prevTickets;
      } else {
        displayTickets = currentTier.tickets;
      }
      return {
        count,
        label: currentTier?.label ?? (currentTier ? `${displayTickets} tickets` : "No reward"),
        isReached: currentTier !== null,
        isCurrent: currentTier !== null && nextTier === null,
        displayTickets,
        referralsToReach: nextTier ? nextTier.threshold - count : null,
      };
    });
  }, [sorted]);

  return (
    <div className="rounded-lg border p-3 space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground">Preview</div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-center text-xs px-2">
        <span className="text-muted-foreground/60 text-[10px] uppercase tracking-wide">Count</span>
        <span className="text-muted-foreground/60 text-[10px] uppercase tracking-wide">Reward</span>
        <span className="text-muted-foreground/60 text-[10px] uppercase tracking-wide min-w-[80px] text-right">
          Next
        </span>
      </div>
      {previews.map((p) => {
        const ticketLabel = p.displayTickets === 1 ? "ticket" : "tickets";
        return (
          <div
            key={p.count}
            className="grid grid-cols-[1fr_auto_auto] gap-3 items-center text-xs py-1 px-2 rounded bg-muted/30"
          >
            <span className="text-muted-foreground tabular-nums">{p.count} active</span>
            <span
              className={`tabular-nums ${p.isReached ? "font-medium text-foreground" : "text-muted-foreground/60"}`}
            >
              {p.isReached ? `${p.displayTickets} ${ticketLabel}` : "—"}
            </span>
            <div className="flex items-center justify-end gap-2 min-w-[80px]">
              {p.isCurrent && (
                <Badge variant="outline" className="text-[10px] h-4">
                  Current max
                </Badge>
              )}
              {p.referralsToReach !== null && p.referralsToReach > 0 ? (
                <span className="text-muted-foreground/60 tabular-nums">
                  {p.referralsToReach} more →
                </span>
              ) : (
                <span className="text-muted-foreground/40">—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ReferralSettingsSheet({
  open,
  onOpenChange,
  initialData,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Record<string, unknown> | null;
  onSave: (data: Record<string, unknown>) => Promise<void>;
}) {
  const form = useForm<ReferralSettingsFormValues>({
    resolver: createZodResolver(referralSettingsFormSchema),
    defaultValues: defaultFormValues,
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "tiers" });
  const tiers = form.watch("tiers");
  const graceEnabled = form.watch("gracePeriodEnabled");
  const calculusMethod = form.watch("calculusMethod");
  const refereeReward = form.watch("refereeRewardEnabled");
  const windowMode = form.watch("activityWindowMode");

  useEffect(() => {
    if (initialData) {
      const d = initialData as Record<string, unknown>;
      form.reset({
        tiers:
          (d.tiers as Array<Record<string, unknown>>)?.map((t: Record<string, unknown>) => ({
            threshold: Number(t.threshold),
            tickets: Number(t.tickets),
            label: String(t.label ?? ""),
          })) ?? defaultFormValues.tiers,
        activityWindowMode: (d.activityWindowMode as "rolling" | "fixed_day_of_month") ?? "rolling",
        monthlyCutoffDay: Number(d.monthlyCutoffDay ?? 25),
        activityWindowDays: Number(d.activityWindowDays ?? 30),
        gracePeriodEnabled: Boolean((d.gracePeriod as Record<string, unknown>)?.enabled ?? false),
        gracePeriodDays: Number((d.gracePeriod as Record<string, unknown>)?.days ?? 3),
        gracePeriodCountsToward: ((d.gracePeriod as Record<string, unknown>)?.countsToward ??
          "current_tier") as "current_tier" | "next_tier",
        minFirstOrderSpend: Number(d.minFirstOrderSpend ?? 1),
        refereeRewardEnabled: Boolean(
          (d.refereeReward as Record<string, unknown>)?.enabled ?? true
        ),
        refereeRewardDiscountPercent: Number(
          (d.refereeReward as Record<string, unknown>)?.discountPercent ?? 20
        ),
        refereeRewardMinOrderValue: Number(
          (d.refereeReward as Record<string, unknown>)?.minOrderValue ?? 0
        ),
        distributionMode:
          ((d.distribution as Record<string, unknown>)?.mode as "wallet" | "all_competitions") ??
          "wallet",
        calculusMethod: (d.calculusMethod as "net" | "gross") ?? "gross",
        guardrailsMaxPerDay: Number(
          (d.guardrails as Record<string, unknown>)?.maxReferralsPerRefereePerDay ?? 0
        ),
        guardrailsRequireEmailVerification: Boolean(
          (d.guardrails as Record<string, unknown>)?.requireEmailVerification ?? false
        ),
      });
    }
  }, [initialData, form]);

  async function onSubmit(values: ReferralSettingsFormValues) {
    await onSave({
      tiers: values.tiers,
      activityWindowDays: values.activityWindowDays,
      activityWindowMode: values.activityWindowMode,
      monthlyCutoffDay: values.monthlyCutoffDay,
      gracePeriod: {
        enabled: values.gracePeriodEnabled,
        days: values.gracePeriodDays ?? 3,
        countsToward: values.gracePeriodCountsToward,
      },
      minFirstOrderSpend: values.minFirstOrderSpend,
      calculusMethod: values.calculusMethod,
      refereeReward: {
        enabled: values.refereeRewardEnabled,
        discountPercent: values.refereeRewardDiscountPercent,
        minOrderValue: values.refereeRewardMinOrderValue,
      },
      distribution: { mode: values.distributionMode },
      guardrails: {
        maxReferralsPerRefereePerDay: values.guardrailsMaxPerDay,
        blockSelfReferral: true,
        requireEmailVerification: values.guardrailsRequireEmailVerification,
      },
    });
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Referral program settings"
      description="Configure milestones, qualification rules, rewards, and distribution."
      size="xl"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <Form {...form}>
        <div className="space-y-6">
          {/* Milestones */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Milestones</h3>
              <p className="text-xs text-muted-foreground">
                Define the referral milestones. Each milestone grants tickets per qualifying
                purchase once reached.
              </p>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_80px_80px_32px] gap-2 text-xs font-medium text-muted-foreground items-center px-1">
              <span>Label</span>
              <span className="text-center">Threshold</span>
              <span className="text-center">Tickets</span>
              <span />
            </div>
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-[minmax(0,1fr)_80px_80px_32px] gap-2 items-center"
              >
                <FormField
                  control={form.control}
                  name={`tiers.${index}.label`}
                  render={({ field: f }) => (
                    <FormItem className="space-y-0">
                      <FormControl>
                        <Input {...f} placeholder="e.g. Bronze" className="h-8 text-xs" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`tiers.${index}.threshold`}
                  render={({ field: f }) => (
                    <FormItem className="space-y-0">
                      <FormControl>
                        <Input
                          {...f}
                          type="number"
                          min={0}
                          placeholder="5"
                          className="h-8 text-xs text-center"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`tiers.${index}.tickets`}
                  render={({ field: f }) => (
                    <FormItem className="space-y-0">
                      <FormControl>
                        <Input
                          {...f}
                          type="number"
                          min={0}
                          placeholder="2"
                          className="h-8 text-xs text-center"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 justify-self-center"
                  onClick={() => remove(index)}
                >
                  <span className="sr-only">Remove</span>✕
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ threshold: 0, tickets: 0, label: "" })}
            >
              + Add milestone
            </Button>

            <FormField
              control={form.control}
              name="calculusMethod"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-1.5">
                    <FormLabel className="text-xs">Ticket calculus</FormLabel>
                    <HelpTooltip>
                      Net: each milestone uses its ticket value directly (e.g. [2, 5, 10]). Gross:
                      milestone values are cumulative targets — the award is the difference from the
                      previous milestone (e.g. [2, 5, 10] → 2, 3, 5).
                    </HelpTooltip>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={field.value === "net" ? "default" : "outline"}
                      size="sm"
                      onClick={() => field.onChange("net")}
                    >
                      Net
                    </Button>
                    <Button
                      type="button"
                      variant={field.value === "gross" ? "default" : "outline"}
                      size="sm"
                      onClick={() => field.onChange("gross")}
                    >
                      Gross
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <TierPreviewPanel tiers={tiers} calculusMethod={calculusMethod} />
          </div>

          <Separator />

          {/* Qualification window */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Qualification window</h3>
              <p className="text-xs text-muted-foreground">
                How purchases count toward a referrer's milestones.
              </p>
            </div>

            <FormField
              control={form.control}
              name="activityWindowMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Window mode</FormLabel>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={field.value === "rolling" ? "default" : "outline"}
                      size="sm"
                      onClick={() => field.onChange("rolling")}
                    >
                      Rolling
                    </Button>
                    <Button
                      type="button"
                      variant={field.value === "fixed_day_of_month" ? "default" : "outline"}
                      size="sm"
                      onClick={() => field.onChange("fixed_day_of_month")}
                    >
                      Fixed day
                    </Button>
                  </div>
                  <FormDescription className="text-xs">
                    {field.value === "rolling"
                      ? "Purchases count within N days of the referee's signup."
                      : "Purchases count each month up to the chosen day."}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {windowMode === "rolling" && (
              <FormField
                control={form.control}
                name="activityWindowDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Window length (days)</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} className="w-24" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {windowMode === "fixed_day_of_month" && (
              <FormField
                control={form.control}
                name="monthlyCutoffDay"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-1.5">
                      <FormLabel>Cutoff day</FormLabel>
                      <HelpTooltip>
                        Purchases on or before this day count toward the current month. After this
                        day they roll to the next window (or grace period). Set 28 to include most
                        days.
                      </HelpTooltip>
                    </div>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={28}
                        className="w-24"
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? undefined : Number(e.target.value);
                          field.onChange(val);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="gracePeriodEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded border p-3">
                  <div className="flex items-center gap-1.5">
                    <FormLabel className="text-sm font-normal">Grace period</FormLabel>
                    <HelpTooltip>
                      Extra days past the window during which late purchases still qualify.
                    </HelpTooltip>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            {graceEnabled && (
              <div className="flex gap-3">
                <FormField
                  control={form.control}
                  name="gracePeriodDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Days</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min={1} max={28} className="w-24" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gracePeriodCountsToward"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Counts toward</FormLabel>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={field.value === "current_tier" ? "default" : "outline"}
                          size="sm"
                          onClick={() => field.onChange("current_tier")}
                        >
                          Current
                        </Button>
                        <Button
                          type="button"
                          variant={field.value === "next_tier" ? "default" : "outline"}
                          size="sm"
                          onClick={() => field.onChange("next_tier")}
                        >
                          Next
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <FormField
              control={form.control}
              name="minFirstOrderSpend"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-1.5">
                    <FormLabel>Min first-order spend (£)</FormLabel>
                    <HelpTooltip>
                      Minimum order total for a referee's qualifying purchase. Set 0 to accept any
                      amount.
                    </HelpTooltip>
                  </div>
                  <FormControl>
                    <Input {...field} type="number" min={0} step={0.01} className="w-24" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Separator />

          {/* Referee reward */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Referee reward</h3>
              <p className="text-xs text-muted-foreground">
                Discount offered to the referred user on their first order.
              </p>
            </div>

            <FormField
              control={form.control}
              name="refereeRewardEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded border p-3">
                  <FormLabel className="text-sm font-normal">Enable first-order discount</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            {refereeReward && (
              <div className="flex gap-3">
                <FormField
                  control={form.control}
                  name="refereeRewardDiscountPercent"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-1.5">
                        <FormLabel>Discount (%)</FormLabel>
                        <HelpTooltip>
                          Percentage off the referee's first order subtotal.
                        </HelpTooltip>
                      </div>
                      <FormControl>
                        <Input {...field} type="number" min={0} max={100} className="w-24" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="refereeRewardMinOrderValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min order (£)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min={0} step={0.01} className="w-24" />
                      </FormControl>
                      <FormDescription className="text-xs">0 = no minimum</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>

          <Separator />

          {/* Distribution & safety */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Distribution & safety</h3>
              <p className="text-xs text-muted-foreground">
                How tickets are awarded and abuse prevention.
              </p>
            </div>

            <FormField
              control={form.control}
              name="distributionMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Award mode</FormLabel>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={field.value === "wallet" ? "default" : "outline"}
                      size="sm"
                      onClick={() => field.onChange("wallet")}
                    >
                      Wallet
                    </Button>
                    <Button
                      type="button"
                      variant={field.value === "all_competitions" ? "default" : "outline"}
                      size="sm"
                      onClick={() => field.onChange("all_competitions")}
                    >
                      All competitions
                    </Button>
                  </div>
                  <FormDescription className="text-xs">
                    Wallet = tickets credited to user's wallet for manual redeem. All competitions =
                    tickets auto-distributed to every active competition, capped by per-user and
                    per-competition availability. Leftovers are discarded if no comps are eligible.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="guardrailsMaxPerDay"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-1.5">
                    <FormLabel>Max referrals per referee per day</FormLabel>
                    <HelpTooltip>
                      Hard cap on qualifying referrals from the same referee in 24 hours. 0 =
                      unlimited.
                    </HelpTooltip>
                  </div>
                  <FormControl>
                    <Input {...field} type="number" min={0} className="w-24" />
                  </FormControl>
                  <FormDescription className="text-xs">0 = unlimited</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="guardrailsRequireEmailVerification"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded border p-3">
                  <div className="flex items-center gap-1.5">
                    <FormLabel className="text-sm font-normal">
                      Require email verification
                    </FormLabel>
                    <HelpTooltip>
                      If on, only purchases by referees with verified emails count toward
                      milestones.
                    </HelpTooltip>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
            {form.formState.isSubmitting ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </Form>
    </FormSheet>
  );
}
