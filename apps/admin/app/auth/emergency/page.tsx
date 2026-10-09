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
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { createZodResolver } from "@/lib/zod-resolver";

type EmergencyStatus = {
  enabled: boolean;
  email: string;
};

type SetupCredentials = {
  email: string;
  password: string;
};

const requestOtpSchema = z.object({
  emergencySecret: z.string().min(1, "Emergency secret is required"),
});
type RequestOtpFormValues = z.infer<typeof requestOtpSchema>;

const repairSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, "Must be a 6-digit code"),
});
type RepairFormValues = z.infer<typeof repairSchema>;

function AdminEmergencyContent() {
  const [status, setStatus] = useState<EmergencyStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [credentials, setCredentials] = useState<SetupCredentials | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  const requestForm = useForm<RequestOtpFormValues>({
    resolver: createZodResolver(requestOtpSchema),
    defaultValues: { emergencySecret: "" },
  });

  const repairForm = useForm<RepairFormValues>({
    resolver: createZodResolver(repairSchema),
    defaultValues: { otp: "" },
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoadingStatus(true);
      setStatusError(null);
      try {
        const response = await api.get<EmergencyStatus>("/api/auth-emergency");
        if (cancelled) return;
        setStatus(response.data);
      } catch (err: unknown) {
        if (cancelled) return;
        setStatusError(
          err instanceof ApiResponseError ? err.message : "Failed to load emergency status."
        );
      } finally {
        if (!cancelled) setIsLoadingStatus(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const onRequestOtp = requestForm.handleSubmit(async (values) => {
    try {
      await api.post(
        "/api/auth-emergency/request",
        {},
        { headers: { "X-Emergency-Secret": values.emergencySecret.trim() } }
      );
      setOtpSent(true);
    } catch (err: unknown) {
      requestForm.setError("root", {
        message: err instanceof ApiResponseError ? err.message : "Failed to send emergency OTP.",
      });
    }
  });

  const onRepair = repairForm.handleSubmit(async (values) => {
    try {
      const response = await api.post<SetupCredentials>("/api/auth-emergency", {
        otp: values.otp.trim(),
      });
      setCredentials(response.data);
    } catch (err: unknown) {
      repairForm.setError("root", {
        message: err instanceof ApiResponseError ? err.message : "Failed to repair admin account.",
      });
    }
  });

  if (isLoadingStatus) {
    return (
      <AuthShell maxWidth="md">
        <AuthCard
          showBrand
          title="Emergency recovery"
          description="Checking whether emergency admin recovery is enabled…"
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
        <AuthCard showBrand title="Emergency recovery">
          <Alert variant="destructive">
            <AlertTitle>Failed to load emergency status</AlertTitle>
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
          title="Admin account repaired"
          description="Save these credentials now. The password is shown only once."
          className="border-primary/40"
        >
          <div className="flex flex-col gap-3">
            <CredentialField label="Email" value={credentials.email} />
            <CredentialField label="Password" value={credentials.password} variant="primary" />
          </div>
          <Separator className="my-4" />
          <Button asChild className="w-full">
            <Link href="/auth/login" data-umami-event="auth:emergency-login-redirect">
              Continue to admin login
            </Link>
          </Button>
        </AuthCard>
      </AuthShell>
    );
  }

  if (!status?.enabled) {
    return (
      <AuthShell maxWidth="md">
        <AuthCard
          showBrand
          title="Emergency recovery"
          description="Emergency admin recovery is disabled. Set ADMIN_EMERGENCY_SECRET on the API to enable it."
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
        title="Emergency recovery"
        description="Repair the admin account when locked out. A one-time code is sent to the configured admin email."
      >
        <div className="flex flex-col gap-6">
          <p className="text-sm text-muted-foreground">
            Recovery email: <span className="text-foreground">{status.email}</span>
          </p>

          {!otpSent ? (
            <form onSubmit={onRequestOtp} className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="emergencySecret">Emergency secret</FieldLabel>
                <Input
                  id="emergencySecret"
                  type="password"
                  placeholder="Value from ADMIN_EMERGENCY_SECRET"
                  {...requestForm.register("emergencySecret")}
                />
                <FieldDescription>
                  From your server's <code>ADMIN_EMERGENCY_SECRET</code> env var.
                </FieldDescription>
                <FieldError
                  errors={
                    requestForm.formState.errors.emergencySecret?.message
                      ? [{ message: requestForm.formState.errors.emergencySecret.message }]
                      : []
                  }
                />
              </Field>
              {requestForm.formState.errors.root ? (
                <Alert variant="destructive">
                  <AlertDescription>{requestForm.formState.errors.root.message}</AlertDescription>
                </Alert>
              ) : null}
              <Button
                type="submit"
                className="w-full"
                disabled={requestForm.formState.isSubmitting}
                data-umami-event="auth:emergency-request-otp"
              >
                {requestForm.formState.isSubmitting ? "Sending code…" : "Send emergency code"}
              </Button>
            </form>
          ) : (
            <form onSubmit={onRepair} className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code sent to {status.email}.
              </p>
              <Field>
                <FieldLabel htmlFor="otp">Emergency code</FieldLabel>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  {...repairForm.register("otp")}
                  onChange={(e) =>
                    repairForm.setValue("otp", e.target.value.replace(/\D/g, "").slice(0, 6), {
                      shouldValidate: true,
                    })
                  }
                />
                <FieldError
                  errors={
                    repairForm.formState.errors.otp?.message
                      ? [{ message: repairForm.formState.errors.otp.message }]
                      : []
                  }
                />
              </Field>
              {repairForm.formState.errors.root ? (
                <Alert variant="destructive">
                  <AlertDescription>{repairForm.formState.errors.root.message}</AlertDescription>
                </Alert>
              ) : null}
              <Button
                type="submit"
                className="w-full"
                disabled={repairForm.formState.isSubmitting}
                data-umami-event="auth:emergency-repair-submit"
              >
                {repairForm.formState.isSubmitting ? "Repairing admin…" : "Repair admin account"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setOtpSent(false);
                  repairForm.reset();
                }}
                data-umami-event="auth:emergency-request-new-code"
              >
                Request a new code
              </Button>
            </form>
          )}
        </div>
      </AuthCard>
    </AuthShell>
  );
}

export default function AdminEmergencyPage() {
  return (
    <Suspense fallback={null}>
      <AdminEmergencyContent />
    </Suspense>
  );
}
