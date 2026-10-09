"use client";

import {
  authClient,
  normalizeAuthClientError,
  TurnstileWidget,
  useAuth,
  useReturnToSearchParam,
} from "@oc/api-admin";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthCard, AuthShell } from "@/components/auth/AuthShell";
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
import { Spinner } from "@/components/ui/spinner";
import { createZodResolver } from "@/lib/zod-resolver";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

function AdminLoginForm() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { returnTo, callbackURL } = useReturnToSearchParam("/");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [tokenReady, setTokenReady] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  const form = useForm<FormValues>({
    resolver: createZodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (isLoading) return;
    if (user?.isAdmin) {
      router.replace(returnTo ?? "/");
    } else if (user && !user.isAdmin) {
      router.replace("/auth/access-denied");
    }
  }, [user, isLoading, router, returnTo]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const { error } = await authClient.signIn.email({
        email: values.email,
        password: values.password,
        callbackURL: callbackURL ?? "/",
        ...(turnstileToken
          ? { fetchOptions: { headers: { "x-captcha-response": turnstileToken } } }
          : {}),
      });
      if (error) {
        setRefreshKey((k) => k + 1);
        setTokenReady(false);
        form.setError("root", { message: error.message ?? "Sign in failed" });
        return;
      }
      router.replace(returnTo ?? "/");
    } catch (err) {
      const normalized = normalizeAuthClientError(err);
      setRefreshKey((k) => k + 1);
      setTokenReady(false);
      form.setError("root", { message: normalized.message });
    }
  });

  return (
    <AuthCard
      showBrand
      brandSubtitle="Sign in to the admin dashboard"
      title={
        <>
          <span className="text-primary">Admin</span> Login
        </>
      }
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
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {form.formState.errors.root ? (
            <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
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
            data-umami-event="auth:login-submit"
          >
            {form.formState.isSubmitting ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
      </Form>

      <div className="mt-4 flex justify-center">
        <Button asChild variant="link" className="h-auto p-0 text-sm text-muted-foreground">
          <Link href="/auth/forgot-password" data-umami-event="auth:forgot-password-link">
            Forgot password?
          </Link>
        </Button>
      </div>
    </AuthCard>
  );
}

export default function AdminLoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <AdminLoginForm />
      </Suspense>
    </AuthShell>
  );
}
