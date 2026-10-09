"use client";

import { authClient, TurnstileWidget } from "@oc/api-admin";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthCard, AuthShell } from "@/components/auth/AuthShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { createZodResolver } from "@/lib/zod-resolver";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
});

type FormValues = z.infer<typeof schema>;

export interface AdminForgotPasswordFormProps {
  initialEmail?: string;
}

export function AdminForgotPasswordForm({ initialEmail = "" }: AdminForgotPasswordFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [tokenReady, setTokenReady] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  const form = useForm<FormValues>({
    resolver: createZodResolver(schema),
    defaultValues: { email: initialEmail },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      const result = await authClient.emailOtp.requestPasswordReset({
        email: values.email.trim(),
        ...(turnstileToken
          ? { fetchOptions: { headers: { "x-captcha-response": turnstileToken } } }
          : {}),
      });
      if (result.error) {
        setRefreshKey((k) => k + 1);
        setTokenReady(false);
        setServerError(result.error.message ?? "Failed to send reset code. Please try again.");
        return;
      }
      router.replace(`/auth/reset-password?email=${encodeURIComponent(values.email.trim())}`);
    } catch {
      setRefreshKey((k) => k + 1);
      setTokenReady(false);
      setServerError("Something went wrong. Please try again.");
    }
  });

  return (
    <AuthCard
      showBrand
      brandSubtitle="Enter your email and we'll send you a reset code."
      title="Reset admin password"
    >
      <Form {...form}>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="admin@example.com"
                    autoComplete="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {serverError ? (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          ) : null}

          {turnstileSiteKey && (
            <div className="flex justify-center">
              <TurnstileWidget
                siteKey={turnstileSiteKey}
                onToken={(token) => {
                  setTurnstileToken(token);
                  setTokenReady(token !== null);
                }}
                refreshKey={refreshKey}
              />
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={form.formState.isSubmitting || (!!turnstileSiteKey && !tokenReady)}
            data-umami-event="auth:forgot-password-submit"
          >
            {form.formState.isSubmitting ? "Sending..." : "Send reset code"}
          </Button>
        </form>
      </Form>

      <div className="mt-4 flex justify-center">
        <Button asChild variant="link" className="h-auto p-0 text-sm text-muted-foreground">
          <Link href="/auth/login" data-umami-event="auth:back-to-login">
            Back to admin login
          </Link>
        </Button>
      </div>
    </AuthCard>
  );
}

export default function AdminForgotPasswordPageWrapper({
  initialEmail,
}: AdminForgotPasswordFormProps) {
  return (
    <AuthShell>
      <AdminForgotPasswordForm initialEmail={initialEmail} />
    </AuthShell>
  );
}
