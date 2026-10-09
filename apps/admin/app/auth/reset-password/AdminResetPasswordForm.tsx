"use client";

import { authClient, TurnstileWidget } from "@oc/api-admin";
import { Eye, EyeOff } from "@oc/icons";
import Link from "next/link";
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

const schema = z
  .object({
    email: z.string().email("Enter a valid email address"),
    code: z.string().min(1, "Enter the reset code from your email"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export interface AdminResetPasswordFormProps {
  initialEmail?: string;
  initialToken?: string;
}

export function AdminResetPasswordForm({
  initialEmail = "",
  initialToken = "",
}: AdminResetPasswordFormProps) {
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [tokenReady, setTokenReady] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  const form = useForm<FormValues>({
    resolver: createZodResolver(schema),
    defaultValues: {
      email: initialEmail,
      code: initialToken,
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      const result = await authClient.emailOtp.resetPassword({
        email: values.email.trim(),
        otp: values.code.trim(),
        password: values.newPassword,
        ...(turnstileToken
          ? { fetchOptions: { headers: { "x-captcha-response": turnstileToken } } }
          : {}),
      });
      if (result.error) {
        setRefreshKey((k) => k + 1);
        setTokenReady(false);
        setServerError(result.error.message ?? "Failed to reset password. Please try again.");
        return;
      }
      setSuccess(true);
    } catch {
      setRefreshKey((k) => k + 1);
      setTokenReady(false);
      setServerError("Something went wrong. Please try again.");
    }
  });

  if (success) {
    return (
      <AuthCard
        showBrand
        title="Password updated"
        description="Your password has been reset. You can now sign in with your new password."
      >
        <div className="flex flex-col gap-4">
          <Alert variant="default">
            <AlertDescription>Your password has been reset successfully.</AlertDescription>
          </Alert>
          <Button asChild className="w-full">
            <Link href="/auth/login" data-umami-event="auth:back-to-login">
              Go to admin login
            </Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      showBrand
      title="Choose a new password"
      description="Enter the reset code from your email and choose a new password."
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

          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reset code</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="Enter the code from your email"
                    autoComplete="one-time-code"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Min. 8 characters"
                      autoComplete="new-password"
                      {...field}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={-1}
                      data-umami-event="auth:password-visibility-toggle"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Repeat your password"
                    autoComplete="new-password"
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
            data-umami-event="auth:reset-password-submit"
          >
            {form.formState.isSubmitting ? "Resetting..." : "Reset password"}
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

export default function AdminResetPasswordPageWrapper({
  initialEmail,
  initialToken,
}: AdminResetPasswordFormProps) {
  return (
    <AuthShell>
      <AdminResetPasswordForm initialEmail={initialEmail} initialToken={initialToken} />
    </AuthShell>
  );
}
