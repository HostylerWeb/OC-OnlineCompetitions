"use client";

import { useAdminComplianceSettings, useComplianceSettingsMutations } from "@oc/api-admin";
import { Settings, Shield } from "@oc/icons";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { SelfExcludedUsersTable } from "@/components/compliance";
import { FormSheet } from "@/components/FormSheet";
import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { LEGAL_POSTAL_ADDRESS } from "@oc/utils";
import { handleFormError } from "@/lib/handle-form-error";
import { createZodResolver } from "@/lib/zod-resolver";

const reasonSchema = z.string().trim().min(10, "Reason must be at least 10 characters");

const complianceSchema = z.object({
  reason: reasonSchema,
  masterEnabled: z.boolean(),
  ageVerificationEnabled: z.boolean(),
  ageVerificationMinAge: z.coerce.number().int().min(18, "Must be 18+"),
  ageVerificationProvider: z.string().optional().or(z.literal("")),
  creditCardMonthlyLimitEnabled: z.boolean(),
  creditCardMonthlyLimitGBP: z.coerce.number().min(0),
  instantWinCreditCardBanEnabled: z.boolean(),
  personalSpendLimitsEnabled: z.boolean(),
  spendLimitIncreaseCooldownHours: z.coerce.number().int().min(1),
  selfExclusionEnabled: z.boolean(),
  selfExclusionMinMonths: z.coerce.number().int().min(1),
  marketingWebhookUrl: z.string().optional().or(z.literal("")),
  postalEntryAddress: z.string().min(1, "Address required"),
  postalEntryProminenceEnabled: z.boolean(),
  compliancePageEnabled: z.boolean(),
  guestCheckoutEnabled: z.boolean(),
  allowZeroSubtotalOrders: z.boolean(),
  minimumOrderValue: z.coerce.number().min(0),
});
type ComplianceFormValues = z.infer<typeof complianceSchema>;

const DEFAULTS: ComplianceFormValues = {
  reason: "",
  masterEnabled: false,
  ageVerificationEnabled: false,
  ageVerificationMinAge: 18,
  ageVerificationProvider: "",
  creditCardMonthlyLimitEnabled: false,
  creditCardMonthlyLimitGBP: 250,
  instantWinCreditCardBanEnabled: false,
  personalSpendLimitsEnabled: false,
  spendLimitIncreaseCooldownHours: 24,
  selfExclusionEnabled: false,
  selfExclusionMinMonths: 6,
  marketingWebhookUrl: "",
  postalEntryAddress: LEGAL_POSTAL_ADDRESS,
  postalEntryProminenceEnabled: false,
  compliancePageEnabled: false,
  guestCheckoutEnabled: true,
  allowZeroSubtotalOrders: true,
  minimumOrderValue: 0,
};

function SummaryCard({
  label,
  enabled,
  description,
}: {
  label: string;
  enabled: boolean;
  description?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <Badge variant={enabled ? "default" : "secondary"}>{enabled ? "On" : "Off"}</Badge>
        </div>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
  disabled,
  "data-umami-event": umamiEvent,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  "data-umami-event"?: string;
}) {
  return (
    <div
      className="flex flex-row items-center justify-between rounded-lg border border-border p-3"
      data-umami-event={umamiEvent}
    >
      <div
        className="flex flex-col gap-0.5 cursor-pointer"
        onClick={() => {
          if (!disabled) onChange(!value);
        }}
      >
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description ? <span className="text-xs text-muted-foreground">{description}</span> : null}
      </div>
      <Switch checked={value} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

export default function ComplianceSettingsAdminPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data } = useAdminComplianceSettings();
  const { saveSettingsMutation } = useComplianceSettingsMutations();

  const display: ComplianceFormValues = data?.data
    ? { ...DEFAULTS, ...(data.data as Partial<ComplianceFormValues>) }
    : DEFAULTS;

  const form = useForm<ComplianceFormValues>({
    resolver: createZodResolver(complianceSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (sheetOpen) {
      form.reset(display);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await saveSettingsMutation.mutateAsync(values);
      toast.success("Compliance settings saved");
      setSheetOpen(false);
    } catch (err) {
      const msg = handleFormError(form, err);
      if (msg) setError(msg);
      if (!msg) toast.error("Please check the highlighted fields");
    }
  });

  const watchMaster = form.watch("masterEnabled");

  return (
    <PageShell
      title="Compliance Settings"
      description="UK Voluntary Code player protections — enable features individually."
      actions={
        <Button
          variant="outline"
          onClick={() => setSheetOpen(true)}
          data-umami-event="compliance:edit-open"
        >
          <Settings className="size-4" />
          Edit settings
        </Button>
      }
    >
      <Card className={display.masterEnabled ? "border-primary/40" : undefined}>
        <CardContent className="flex flex-col gap-2 p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Master switch</span>
          </div>
          <p className="text-sm font-semibold text-foreground">
            {display.masterEnabled ? "Enforcement on" : "Off"}
          </p>
          <p className="text-xs text-muted-foreground">
            When off, all compliance rules pass through without blocking checkout.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          label="Age verification"
          enabled={display.ageVerificationEnabled}
          description={`Min age ${display.ageVerificationMinAge}`}
        />
        <SummaryCard
          label="Credit card £250 cap"
          enabled={display.creditCardMonthlyLimitEnabled}
          description={`Limit £${display.creditCardMonthlyLimitGBP}`}
        />
        <SummaryCard
          label="Instant-win credit ban"
          enabled={display.instantWinCreditCardBanEnabled}
        />
        <SummaryCard
          label="Personal spend limits"
          enabled={display.personalSpendLimitsEnabled}
          description={`Cooldown ${display.spendLimitIncreaseCooldownHours}h`}
        />
        <SummaryCard
          label="Self-exclusion"
          enabled={display.selfExclusionEnabled}
          description={`Min ${display.selfExclusionMinMonths} months`}
        />
        <SummaryCard label="Compliance page" enabled={display.compliancePageEnabled} />
        <SummaryCard
          label="Postal entry prominence"
          enabled={display.postalEntryProminenceEnabled}
        />
        <SummaryCard
          label="Guest checkout"
          enabled={display.guestCheckoutEnabled}
          description="Allow checkout without an account"
        />
        <SummaryCard
          label="£0 checkouts"
          enabled={display.allowZeroSubtotalOrders}
          description="Allow free-entry / zero-payable orders"
        />
        <SummaryCard
          label="Minimum order"
          enabled={(display.minimumOrderValue ?? 0) > 0}
          description={
            (display.minimumOrderValue ?? 0) > 0
              ? `Minimum £${display.minimumOrderValue}`
              : "No minimum"
          }
        />
      </div>

      <SelfExcludedUsersTable />

      <FormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Compliance settings"
        description="Configure UK Voluntary Code protections. Ship with master switch off, then enable per feature in staging."
        onSubmit={onSubmit}
        isSubmitting={saveSettingsMutation.isPending}
        error={error}
        size="wide"
        submitButtonUmami="compliance:settings-save"
      >
        <Form {...form}>
          <div className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="masterEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-primary/40 bg-primary/5 p-3">
                  <div>
                    <FormLabel className="cursor-pointer">Master enforcement</FormLabel>
                    <FormDescription>Global kill switch for all compliance checks.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-umami-event="compliance:toggle-master"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className={`flex flex-col gap-3 ${!watchMaster ? "opacity-60" : ""}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Player protections
              </p>

              <FormField
                control={form.control}
                name="ageVerificationEnabled"
                render={({ field }) => (
                  <ToggleRow
                    label="Age verification"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={!watchMaster}
                    data-umami-event="compliance:toggle-age-verification"
                  />
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="ageVerificationMinAge"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum age</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={18}
                          {...field}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ageVerificationProvider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provider (future)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled
                          placeholder="Yoti / OneID — not yet integrated"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="creditCardMonthlyLimitEnabled"
                render={({ field }) => (
                  <ToggleRow
                    label="£250 credit card monthly cap"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={!watchMaster}
                    data-umami-event="compliance:toggle-credit-card-cap"
                  />
                )}
              />
              <FormField
                control={form.control}
                name="creditCardMonthlyLimitGBP"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Credit card limit (GBP)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="instantWinCreditCardBanEnabled"
                render={({ field }) => (
                  <ToggleRow
                    label="Instant-win credit card ban"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={!watchMaster}
                    data-umami-event="compliance:toggle-instant-win-ban"
                  />
                )}
              />

              <FormField
                control={form.control}
                name="personalSpendLimitsEnabled"
                render={({ field }) => (
                  <ToggleRow
                    label="Personal spend limits"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={!watchMaster}
                    data-umami-event="compliance:toggle-spend-limits"
                  />
                )}
              />
              <FormField
                control={form.control}
                name="spendLimitIncreaseCooldownHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Spend limit cooldown (hours)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="selfExclusionEnabled"
                render={({ field }) => (
                  <ToggleRow
                    label="Self-exclusion tools"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={!watchMaster}
                    data-umami-event="compliance:toggle-self-exclusion"
                  />
                )}
              />
              <FormField
                control={form.control}
                name="selfExclusionMinMonths"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum self-exclusion (months)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="marketingWebhookUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marketing webhook URL</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://…" />
                    </FormControl>
                    <FormDescription>
                      Notify your marketing platform when a user self-excludes.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="compliancePageEnabled"
                render={({ field }) => (
                  <ToggleRow
                    label="Publish /responsible-play page"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={!watchMaster}
                    data-umami-event="compliance:toggle-compliance-page"
                  />
                )}
              />

              <FormField
                control={form.control}
                name="guestCheckoutEnabled"
                render={({ field }) => (
                  <ToggleRow
                    label="Guest checkout"
                    description="Allow users to checkout without creating an account"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={!watchMaster}
                    data-umami-event="compliance:toggle-guest-checkout"
                  />
                )}
              />

              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">
                Order value
              </p>

              <FormField
                control={form.control}
                name="allowZeroSubtotalOrders"
                render={({ field }) => (
                  <ToggleRow
                    label="Allow £0 checkouts"
                    description="Permit orders where the payable amount is £0 (free entry or fully wallet-funded). When disabled, users must add a paid ticket to proceed."
                    value={field.value}
                    onChange={field.onChange}
                    disabled={!watchMaster}
                    data-umami-event="compliance:toggle-allow-zero-subtotal"
                  />
                )}
              />

              <FormField
                control={form.control}
                name="minimumOrderValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum order value (GBP)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value)}
                        disabled={!watchMaster}
                      />
                    </FormControl>
                    <FormDescription>
                      Orders below this payable amount are blocked at checkout. Set 0 to disable the
                      minimum.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for change</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Explain why these changes are being made..." />
                    </FormControl>
                    <FormDescription>
                      Required for audit trail. Minimum 10 characters.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="postalEntryProminenceEnabled"
                render={({ field }) => (
                  <ToggleRow
                    label="Postal entry prominence"
                    description="Show postal entry in header, support and FAQ"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={!watchMaster}
                    data-umami-event="compliance:toggle-postal-prominence"
                  />
                )}
              />

              <FormField
                control={form.control}
                name="postalEntryAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal entry address</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={4} disabled={!watchMaster} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </Form>
      </FormSheet>
    </PageShell>
  );
}
