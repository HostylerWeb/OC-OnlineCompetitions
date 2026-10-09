"use client";

import { useAdminPaymentMethodMutations, useAdminPaymentMethods } from "@oc/api-admin";
import type { AdminPaymentMethodRecord } from "@oc/types";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageShell } from "@/components/PageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

type Environment = "sandbox" | "live";

function EnvironmentBadge({ env }: { env: Environment }) {
  return (
    <Badge
      variant="outline"
      className={
        env === "sandbox"
          ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
      }
    >
      {env === "sandbox" ? "Sandbox" : "Live"}
    </Badge>
  );
}

function getProviderAvatar(provider: string): string {
  switch (provider) {
    case "local":
      return "LC";
    case "paytriot":
      return "PT";
    case "site_credit":
      return "SC";
    default:
      return provider.slice(0, 2).toUpperCase();
  }
}

interface PaymentMethodCardProps {
  method: AdminPaymentMethodRecord;
  onToggleRequest: (provider: string, enabled: boolean) => void;
  onEnvironmentChangeRequest: (provider: string, env: Environment) => void;
  onCheckoutModeChangeRequest: (provider: string, mode: "hosted" | "popup") => void;
}

function PaymentMethodCard({
  method,
  onToggleRequest,
  onEnvironmentChangeRequest,
  onCheckoutModeChangeRequest,
}: PaymentMethodCardProps) {
  const { testMutation } = useAdminPaymentMethodMutations();
  const [environment, setEnvironment] = useState<Environment>(method.environment);
  const [checkoutMode, setCheckoutMode] = useState<"hosted" | "popup">(
    method.checkoutMode ?? "hosted"
  );
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  useEffect(() => {
    setEnvironment(method.environment);
  }, [method.environment]);

  const capabilityBadges = useMemo(() => {
    if (method.provider === "paytriot") {
      return [
        { label: "Hosted Redirect", enabled: true },
        { label: "3-D Secure", enabled: true },
        { label: "Refund", enabled: false },
      ];
    }
    if (!method.capabilities) return [];
    return [
      { label: "Capture", enabled: method.capabilities.canCapture ?? true },
      { label: "Buttons", enabled: method.capabilities.canUseButtons ?? true },
      { label: "Card Fields", enabled: method.capabilities.canUseCardFields ?? true },
    ];
  }, [method.capabilities, method.enabledMethods, method.provider]);

  const isTesting = testMutation.isPending;

  function handleTest() {
    setTestResult(null);
    testMutation.mutate(
      { provider: method.provider, environment },
      {
        onSuccess: (res) => {
          setTestResult(res.data);
          if (res.data.success) toast.success(`${method.name} test succeeded`);
          else toast.error(`${method.name} test failed`);
        },
      }
    );
  }

  if (method.provider === "site_credit") {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                {getProviderAvatar(method.provider)}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">{method.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Lets customers pay with GBP site credit at checkout. Any shortfall is charged via
                  your active card gateway.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {method.enabled ? "Enabled" : "Disabled"}
              </span>
              <Switch
                checked={method.enabled}
                onCheckedChange={(enabled) => {
                  onToggleRequest(method.provider, enabled);
                }}
                data-umami-event="payment:toggle-enabled"
                data-umami-event-provider={method.provider}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
              {getProviderAvatar(method.provider)}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">{method.name}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <EnvironmentBadge env={environment} />
                {!method.hasCredentials ? (
                  <Badge
                    variant="outline"
                    className="border-amber-500/40 bg-amber-500/10 text-amber-500"
                  >
                    No credentials
                  </Badge>
                ) : null}
                {method.isDefault ? (
                  <StatusBadge variant="info" showIcon={false}>
                    Default
                  </StatusBadge>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {method.enabled ? "Enabled" : "Disabled"}
            </span>
            <Switch
              checked={method.enabled}
              onCheckedChange={(enabled) => {
                setTestResult(null);
                onToggleRequest(method.provider, enabled);
              }}
              data-umami-event="payment:toggle-enabled"
              data-umami-event-provider={method.provider}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="flex flex-col gap-1">
            <span className="text-[11px font-semibold uppercase tracking-wide text-muted-foreground">
              Runtime environment
            </span>
            <Select
              value={environment}
              onValueChange={(value) => {
                setEnvironment(value as Environment);
                setTestResult(null);
                onEnvironmentChangeRequest(method.provider, value as Environment);
              }}
              data-umami-event="payment:environment-change"
            >
              <SelectTrigger className="h-9 w-full md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox</SelectItem>
                <SelectItem value="live">Live</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleTest}
            disabled={isTesting || !method.hasCredentials}
            data-umami-event="payment:test-credentials"
          >
            {isTesting ? "Testing…" : "Test credentials"}
          </Button>
        </div>

        {method.credentialDiagnostics ? (
          <div className="flex flex-wrap items-center gap-2">
            {method.provider === "paytriot" ? (
              <>
                <Badge variant="outline">
                  Merchant ID: {method.credentialDiagnostics?.hasClientId ? "set" : "missing"}
                </Badge>
                <Badge variant="outline">
                  Secret: {method.credentialDiagnostics?.hasSecret ? "set" : "missing"}
                </Badge>
              </>
            ) : null}
          </div>
        ) : method.provider === "paytriot" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Merchant ID: env-managed</Badge>
            <Badge variant="outline">Secret: env-managed</Badge>
          </div>
        ) : null}

        {capabilityBadges.length > 0 && !(method.provider === "paytriot") ? (
          <div className="flex flex-wrap items-center gap-2">
            {capabilityBadges.map((capability) => (
              <Badge key={capability.label} variant={capability.enabled ? "secondary" : "outline"}>
                {capability.label}: {capability.enabled ? "Yes" : "No"}
              </Badge>
            ))}
          </div>
        ) : null}
        {method.provider === "paytriot" ? (
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Checkout Mode
              </span>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {checkoutMode === "popup"
                  ? "Opens Paytriot in a popup overlay on your site"
                  : "Redirects customers to a hosted payment page"}
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
              <button
                type="button"
                onClick={() => {
                  setCheckoutMode("hosted");
                  onCheckoutModeChangeRequest(method.provider, "hosted");
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  checkoutMode === "hosted"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-umami-event="payment:checkout-mode-redirect"
              >
                Redirect
              </button>
              <button
                type="button"
                onClick={() => {
                  setCheckoutMode("popup");
                  onCheckoutModeChangeRequest(method.provider, "popup");
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  checkoutMode === "popup"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-umami-event="payment:checkout-mode-popup"
              >
                Popup
              </button>
            </div>
          </div>
        ) : null}

        {testResult ? (
          <Alert variant={testResult.success ? "default" : "destructive"}>
            <AlertDescription>
              {testResult.success
                ? "Credentials test succeeded."
                : testResult.error || "Credentials test failed."}
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

type ProviderConfirmState = {
  provider: string;
  enable?: boolean;
  env?: Environment;
} | null;

export default function PaymentMethodsAdminPage() {
  const { data: methodsResponse, isLoading } = useAdminPaymentMethods();
  const { updateMutation } = useAdminPaymentMethodMutations();
  const methods = methodsResponse?.data ?? [];
  const [providerConfirm, setProviderConfirm] = useState<ProviderConfirmState>(null);

  function handleCheckoutModeChange(provider: string, mode: "hosted" | "popup") {
    updateMutation.mutate(
      {
        provider,
        enabled: methods.find((m) => m.provider === provider)?.enabled ?? false,
        environment: methods.find((m) => m.provider === provider)?.environment ?? "sandbox",
        checkoutMode: mode,
      },
      {
        onSuccess: () => {
          toast.success(`Switched ${provider} to ${mode} checkout`);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
      }
    );
  }

  function handleConfirm() {
    if (!providerConfirm) return;
    const method = methods.find((m) => m.provider === providerConfirm.provider);
    if (providerConfirm.env) {
      updateMutation.mutate(
        {
          provider: providerConfirm.provider,
          enabled: method?.enabled ?? false,
          environment: providerConfirm.env,
        },
        {
          onSuccess: () => {
            toast.success(`Switched ${providerConfirm.provider} to ${providerConfirm.env}`);
            setProviderConfirm(null);
          },
          onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
        }
      );
    } else if (providerConfirm.enable !== undefined) {
      updateMutation.mutate(
        {
          provider: providerConfirm.provider,
          enabled: providerConfirm.enable,
          environment: method?.environment ?? "sandbox",
        },
        {
          onSuccess: () => {
            toast.success(
              `${providerConfirm.enable ? "Enabled" : "Disabled"} ${providerConfirm.provider}`
            );
            setProviderConfirm(null);
          },
          onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
        }
      );
    }
  }

  const isEnvSwitch = providerConfirm?.env !== undefined;
  const dialogTitle = isEnvSwitch ? "Switch environment" : "Update payment provider";
  const dialogDescription = providerConfirm
    ? isEnvSwitch
      ? `Switch ${providerConfirm.provider} to ${providerConfirm.env}? Ensure your ${providerConfirm.env} credentials are configured.`
      : `${providerConfirm.enable ? "Enable" : "Disable"} the ${providerConfirm.provider} payment provider?`
    : "";

  return (
    <PageShell
      title="Payment Methods"
      description="Configure provider settings and test credentials."
    >
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {methods.map((method) => (
            <PaymentMethodCard
              key={method.provider}
              method={method}
              onToggleRequest={(provider, enable) => setProviderConfirm({ provider, enable })}
              onEnvironmentChangeRequest={(provider, env) => setProviderConfirm({ provider, env })}
              onCheckoutModeChangeRequest={handleCheckoutModeChange}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={providerConfirm !== null}
        onOpenChange={(open) => !open && setProviderConfirm(null)}
        title={dialogTitle}
        description={dialogDescription}
        confirmLabel="Confirm"
        isLoading={updateMutation.isPending}
        onConfirm={handleConfirm}
        confirmButtonUmami="payment:change-confirm"
      />
    </PageShell>
  );
}
