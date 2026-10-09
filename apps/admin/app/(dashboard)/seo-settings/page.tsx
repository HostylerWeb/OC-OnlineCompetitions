"use client";

import { useAdminSeoSettings, useAdminSeoSettingsMutations } from "@oc/api-admin";
import { Search, Settings, Share2 } from "@oc/icons";
import { AssetImage } from "@/components/AssetImage";
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
import { Textarea } from "@/components/ui/textarea";
import { handleFormError } from "@/lib/handle-form-error";
import { createZodResolver } from "@/lib/zod-resolver";

const seoSettingsSchema = z.object({
  defaultOgImageUrl: z.string().optional().or(z.literal("")),
  referralOgImageUrl: z.string().optional().or(z.literal("")),
  defaultTitle: z.string().min(1, "Title is required"),
  defaultDescription: z.string().min(1, "Description is required"),
});
type SeoSettingsFormValues = z.infer<typeof seoSettingsSchema>;

const DEFAULTS: SeoSettingsFormValues = {
  defaultOgImageUrl: "",
  referralOgImageUrl: "",
  defaultTitle: "Online Competitions — Win Amazing Prizes",
  defaultDescription: "Enter competitions to win luxury prizes.",
};

export default function SeoSettingsAdminPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data } = useAdminSeoSettings();
  const { saveSettingsMutation } = useAdminSeoSettingsMutations();

  const settings = (data?.data as Partial<SeoSettingsFormValues>) ?? {};
  const display: SeoSettingsFormValues = {
    defaultOgImageUrl: settings.defaultOgImageUrl ?? DEFAULTS.defaultOgImageUrl,
    referralOgImageUrl: settings.referralOgImageUrl ?? DEFAULTS.referralOgImageUrl,
    defaultTitle: settings.defaultTitle ?? DEFAULTS.defaultTitle,
    defaultDescription: settings.defaultDescription ?? DEFAULTS.defaultDescription,
  };

  const form = useForm<SeoSettingsFormValues>({
    resolver: createZodResolver(seoSettingsSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (sheetOpen) {
      form.reset(display);
      setError(null);
    }
  }, [sheetOpen]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await saveSettingsMutation.mutateAsync(values);
      toast.success("SEO settings saved");
      setSheetOpen(false);
    } catch (err) {
      const msg = handleFormError(form, err);
      if (msg) setError(msg);
      if (!msg) toast.error("Please check the highlighted fields");
    }
  });

  return (
    <PageShell
      title="SEO Settings"
      description="Configure default Open Graph metadata used across the customer-facing app."
      actions={
        <Button
          variant="outline"
          onClick={() => setSheetOpen(true)}
          data-umami-event="seo:edit-open"
        >
          <Settings className="size-4" />
          Edit settings
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col gap-2 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Search className="size-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Default OG Image</span>
            </div>
            {display.defaultOgImageUrl ? (
              <div className="relative mt-1 aspect-[1200/630] w-full overflow-hidden rounded-md bg-muted">
                <AssetImage
                  src={display.defaultOgImageUrl}
                  alt="Default OG image preview"
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">No default image set</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-2 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Search className="size-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Default Title</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{display.defaultTitle}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-2 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Search className="size-4" />
              <span className="text-xs font-medium uppercase tracking-wide">
                Default Description
              </span>
            </div>
            <p className="text-sm text-foreground">{display.defaultDescription}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-2 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Share2 className="size-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Referral OG Image</span>
            </div>
            {display.referralOgImageUrl ? (
              <div className="relative mt-1 aspect-[1200/630] w-full overflow-hidden rounded-md bg-muted">
                <AssetImage
                  src={display.referralOgImageUrl}
                  alt="Referral OG image preview"
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">No referral image set</p>
            )}
          </CardContent>
        </Card>
      </div>

      <FormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="SEO settings"
        description="Configure default Open Graph metadata used across the customer-facing app."
        onSubmit={onSubmit}
        isSubmitting={saveSettingsMutation.isPending}
        error={error}
        submitButtonUmami="seo:settings-save"
      >
        <Form {...form}>
          <div className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="defaultTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default title</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>
                    Used as og:title when no page-specific title is set.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="defaultDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default description</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormDescription>
                    Used as og:description when no page-specific description is set.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="defaultOgImageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default OG image URL</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://assets.onlinecompetitions.co.uk/og-images/..." />
                  </FormControl>
                  <FormDescription>
                    Upload an image via{" "}
                    <a
                      href="/media"
                      className="font-medium underline underline-offset-2 hover:text-primary"
                    >
                      Media Library
                    </a>{" "}
                    and paste the URL here. Recommended size: 1200×630px.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="referralOgImageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Referral OG image URL</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://assets.onlinecompetitions.co.uk/og-images/..." />
                  </FormControl>
                  <FormDescription>
                    Used as og:image when the URL contains <code>?ref=...</code>. Falls back to the
                    default OG image if not set. Upload via{" "}
                    <a
                      href="/media"
                      className="font-medium underline underline-offset-2 hover:text-primary"
                    >
                      Media Library
                    </a>
                    .
                  </FormDescription>
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
