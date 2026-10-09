"use client";

import { ApiResponseError, api } from "@oc/api-admin";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthCard, AuthShell } from "@/components/auth/AuthShell";
import { CredentialField } from "@/components/auth/CredentialField";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { createZodResolver } from "@/lib/zod-resolver";

type SetupStatus = {
  available: boolean;
  requiresSecret: boolean;
  defaultEmail: string | null;
};

type SetupCredentials = {
  email: string;
  password: string;
};

const setupSchema = z.object({
  email: z.string().email("Must be a valid email").optional().or(z.literal("")),
  setupSecret: z.string().optional().or(z.literal("")),
});
type SetupFormValues = z.infer<typeof setupSchema>;

function AdminSetupContent() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<SetupCredentials | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  const form = useForm<SetupFormValues>({
    resolver: createZodResolver(setupSchema),
    defaultValues: { email: "", setupSecret: "" },
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoadingStatus(true);
      setStatusError(null);
      try {
        const response = await api.get<SetupStatus>("/api/auth-setup");
        if (cancelled) return;
        setStatus(response.data);
        if (response.data.defaultEmail) form.setValue("email", response.data.defaultEmail);
      } catch (err: unknown) {
        if (cancelled) return;
        setStatusError(
          err instanceof ApiResponseError ? err.message : "Failed to load setup status."
        );
      } finally {
        if (!cancelled) setIsLoadingStatus(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const response = await api.post<SetupCredentials>(
        "/api/auth-setup",
        values.email?.trim() ? { email: values.email.trim() } : {},
        values.setupSecret?.trim()
          ? { headers: { "X-Setup-Secret": values.setupSecret.trim() } }
          : undefined
      );
      setCredentials(response.data);
    } catch (err: unknown) {
      form.setError("root", {
        message: err instanceof ApiResponseError ? err.message : "Failed to create admin account.",
      });
    }
  });

  if (isLoadingStatus) {
    return (
      <AuthShell maxWidth="md">
        <AuthCard
          showBrand
          title="Bootstrap admin"
          description="Checking whether first-time setup is available…"
        >
          <div className="flex justify-center py-3">
            <Spinner size="md" />
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  if (statusError) {
    return (
      <AuthShell maxWidth="md">
        <AuthCard showBrand title="Bootstrap admin">
          <Alert variant="destructive">
            <AlertTitle>Failed to load setup status</AlertTitle>
            <AlertDescription>{statusError}</AlertDescription>
          </Alert>
        </AuthCard>
      </AuthShell>
    );
  }

  if (credentials) {
    return (
      <AuthShell maxWidth="md">
        <AuthCard
          showBrand
          title="Admin account created"
          description="Save these credentials now. The password is shown only once."
          footer={
            <Button asChild className="w-full">
              <Link href="/auth/login" data-umami-event="auth:setup-login-redirect">
                Continue to admin login
              </Link>
            </Button>
          }
        >
          <div className="flex flex-col gap-3">
            <CredentialField label="Email" value={credentials.email} />
            <CredentialField label="Password" value={credentials.password} variant="primary" />
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  if (!status?.available) {
    return (
      <AuthShell maxWidth="md">
        <AuthCard
          showBrand
          title="Bootstrap admin"
          description="An admin account already exists. Setup is disabled for security."
          footer={
            <Button asChild variant="outline">
              <Link href="/auth/login" data-umami-event="auth:go-to-login">
                Go to admin login
              </Link>
            </Button>
          }
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell maxWidth="md">
      <AuthCard
        showBrand
        title="Bootstrap admin"
        description="Create the first admin account. This page only works while no admin exists."
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {!status.defaultEmail && (
            <Field>
              <FieldLabel htmlFor="email">Admin email</FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                autoComplete="email"
                {...form.register("email")}
              />
              <FieldError
                errors={
                  form.formState.errors.email?.message
                    ? [{ message: form.formState.errors.email.message }]
                    : []
                }
              />
            </Field>
          )}

          {status.defaultEmail ? (
            <p className="text-sm text-muted-foreground">
              Admin email: <span className="text-foreground">{status.defaultEmail}</span>
            </p>
          ) : null}

          {status.requiresSecret ? (
            <Field>
              <FieldLabel htmlFor="setupSecret">Setup secret</FieldLabel>
              <Input
                id="setupSecret"
                type="password"
                placeholder="Value from SETUP_SECRET"
                {...form.register("setupSecret")}
              />
              <FieldDescription>
                From your server's <code>SETUP_SECRET</code> env var.
              </FieldDescription>
              <FieldError
                errors={
                  form.formState.errors.setupSecret?.message
                    ? [{ message: form.formState.errors.setupSecret.message }]
                    : []
                }
              />
            </Field>
          ) : null}

          {form.formState.errors.root ? (
            <Alert variant="destructive">
              <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
            </Alert>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={form.formState.isSubmitting}
            data-umami-event="auth:setup-submit"
          >
            {form.formState.isSubmitting ? "Creating admin…" : "Create admin account"}
          </Button>
        </form>
      </AuthCard>
    </AuthShell>
  );
}

export default function AdminSetupPage() {
  return (
    <Suspense fallback={null}>
      <AdminSetupContent />
    </Suspense>
  );
}
