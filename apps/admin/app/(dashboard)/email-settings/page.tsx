"use client";

import { useAdminEmailSettings, useAdminEmailSettingsMutations } from "@oc/api-admin";
import { Mail, Settings } from "@oc/icons";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { FormSheet } from "@/components/FormSheet";
import { PageShell } from "@/components/PageShell";
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
import { BRAND_NAME, LEGAL_CONTACT_EMAIL } from "@oc/utils";
import { handleFormError } from "@/lib/handle-form-error";
import { createZodResolver } from "@/lib/zod-resolver";

const emailSettingsSchema = z.object({
  fromName: z.string().min(1, "From name is required"),
  fromEmail: z.string().email("Must be a valid email"),
  supportAddress: z.string().email("Must be a valid email"),
});
type EmailSettingsFormValues = z.infer<typeof emailSettingsSchema>;

const DEFAULTS: EmailSettingsFormValues = {
  fromName: BRAND_NAME,
  fromEmail: LEGAL_CONTACT_EMAIL,
  supportAddress: LEGAL_CONTACT_EMAIL,
};

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Mail className="size-4" />
          <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        </div>
        <p className="text-sm font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function EmailSettingsAdminPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data } = useAdminEmailSettings();
  const { saveSettingsMutation } = useAdminEmailSettingsMutations();

  const settings = (data?.data as Partial<EmailSettingsFormValues>) ?? {};
  const display: EmailSettingsFormValues = {
    fromName: settings.fromName ?? DEFAULTS.fromName,
    fromEmail: settings.fromEmail ?? DEFAULTS.fromEmail,
    supportAddress: settings.supportAddress ?? DEFAULTS.supportAddress,
  };

  const form = useForm<EmailSettingsFormValues>({
    resolver: createZodResolver(emailSettingsSchema),
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
      toast.success("Email settings saved");
      setSheetOpen(false);
    } catch (err) {
      const msg = handleFormError(form, err);
      if (msg) setError(msg);
      if (!msg) toast.error("Please check the highlighted fields");
    }
  });

  return (
    <PageShell
      title="Email Settings"
      description="Configure the sender identity used in all transactional emails."
      actions={
        <Button
          variant="outline"
          onClick={() => setSheetOpen(true)}
          data-umami-event="email:edit-open"
        >
          <Settings className="size-4" />
          Edit settings
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <InfoCard label="From name" value={display.fromName} />
        <InfoCard label="From address" value={display.fromEmail} />
        <InfoCard label="Support address" value={display.supportAddress} />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2 p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Email provider</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Email delivery is configured via environment variables on the server. Provider
            credentials cannot be changed from the admin dashboard.
          </p>
        </CardContent>
      </Card>

      <FormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Email settings"
        description="Configure the sender identity used in outgoing emails."
        onSubmit={onSubmit}
        isSubmitting={saveSettingsMutation.isPending}
        error={error}
        submitButtonUmami="email:settings-save"
      >
        <Form {...form}>
          <div className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="fromName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>Displayed as the sender in customer inboxes.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fromEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From email</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="supportAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Support address</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormDescription>Where customers reply when they need help.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Form>
      </FormSheet>
    </PageShell>
  );
}
