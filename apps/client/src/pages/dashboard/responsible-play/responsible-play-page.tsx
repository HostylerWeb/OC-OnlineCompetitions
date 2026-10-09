"use client";

import {
  hasResponsiblePlayTools,
  resolveEffectiveSelfExcluded,
  useAuth,
  useComplianceFeatures,
  useSaferPlay,
  useSaferPlayMutations,
} from "@oc/api-client";
import { SUPPORT_ORGANISATIONS } from "@oc/content";
import { AlertTriangle, ExternalLink, Shield } from "@oc/icons";
import type { SelfExclusionDuration } from "@oc/types";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useData } from "vike-react/useData";
import { DashboardPageHeader } from "@/components/dashboard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { FocusReasonBanner, useFocusFromQuery } from "@/hooks/useFocusFromQuery";
import { formatCurrency, useTranslation } from "@/lib/i18n";
import { formatDateTime } from "@/lib/utils";
import type { Data } from "./+data";

const EXCLUSION_OPTIONS: { value: SelfExclusionDuration; labelKey: string }[] = [
  { value: "6months", labelKey: "dashboard.responsiblePlay.exclusionOptions.sixMonths" },
  { value: "1year", labelKey: "dashboard.responsiblePlay.exclusionOptions.oneYear" },
  { value: "5years", labelKey: "dashboard.responsiblePlay.exclusionOptions.fiveYears" },
  { value: "permanent", labelKey: "dashboard.responsiblePlay.exclusionOptions.permanent" },
];

export default function DashboardResponsiblePlayView() {
  const { t, locale } = useTranslation();
  const { logout } = useAuth();
  const data = useData<Data>();
  const features = useComplianceFeatures({
    initialData: data?.compliance ? { data: data.compliance } : undefined,
  });
  const { data: saferPlayResponse, isLoading } = useSaferPlay({
    initialData: data?.saferPlay ? { data: data.saferPlay } : undefined,
  });
  const { updateSpendLimitMutation, selfExcludeMutation, requestOverrideMutation } =
    useSaferPlayMutations();

  const state = saferPlayResponse?.data;
  const effectiveSelfExcluded = resolveEffectiveSelfExcluded(state);
  const [limitInput, setLimitInput] = useState("");
  const [selectedExclusion, setSelectedExclusion] = useState<SelfExclusionDuration>("6months");
  const [confirmExclusion, setConfirmExclusion] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const focusSections = useMemo(
    () => [
      { key: "spend-limit", autofocusSelector: "#spend-limit" },
      { key: "credit-card-limit" },
      { key: "self-exclusion" },
    ],
    []
  );

  const { reasonBanner, dismissReasonBanner } = useFocusFromQuery({
    sections: focusSections,
    isReady: !isLoading && !!state,
  });

  if (isLoading || features.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" shimmer />
        <Skeleton className="h-48 w-full rounded-xl" shimmer />
      </div>
    );
  }

  if (!hasResponsiblePlayTools(features) && !effectiveSelfExcluded) {
    return (
      <div className="flex flex-col gap-4">
        <DashboardPageHeader
          title={t("dashboard.responsiblePlay.heading")}
          subtitle={t("dashboard.responsiblePlay.saferPlayTools")}
        />
        <Card className="border-border/70">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t("dashboard.responsiblePlay.toolsNotEnabled")}
            {features.publicResponsiblePlayPage ? (
              <>
                {" "}
                {t("dashboard.responsiblePlay.seeOur" as any)}{" "}
                <a href="/responsible-play" className="text-gold hover:underline">
                  {t("staticPages.responsiblePlay.heading")}
                </a>{" "}
                {t("dashboard.responsiblePlay.pageForGuidance")}
              </>
            ) : (
              <> {t("dashboard.responsiblePlay.contactSupport")}</>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  async function handleSaveLimit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number.parseFloat(limitInput);
    if (Number.isNaN(value) || value < 0) {
      toast.error(t("dashboard.responsiblePlay.enterValidAmount"));
      return;
    }
    try {
      await updateSpendLimitMutation.mutateAsync(value);
      toast.success(t("dashboard.responsiblePlay.spendLimitUpdated"));
      setLimitInput("");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : t("dashboard.responsiblePlay.failedToUpdateLimit")
      );
    }
  }

  async function handleSelfExclude() {
    if (!confirmExclusion) return;
    try {
      const result = await selfExcludeMutation.mutateAsync(selectedExclusion);
      if (result.data?.logoutRequired) {
        await logout();
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : t("dashboard.responsiblePlay.selfExclusionFailed")
      );
    }
  }

  async function handleRequestOverride() {
    if (overrideReason.trim().length < 10) {
      toast.error(t("dashboard.responsiblePlay.provideReason"));
      return;
    }
    try {
      await requestOverrideMutation.mutateAsync(overrideReason);
      toast.success(t("dashboard.responsiblePlay.reviewSubmitted"));
      setOverrideReason("");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : t("dashboard.responsiblePlay.failedToSubmit")
      );
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHeader
        title={t("dashboard.responsiblePlay.headingWithTools")}
        subtitle={t("dashboard.responsiblePlay.subtitle")}
      />

      <FocusReasonBanner message={reasonBanner} onDismiss={dismissReasonBanner} />

      {features.personalSpendLimits && state?.spendLimitRequired && !effectiveSelfExcluded ? (
        <Alert className="border-amber-500/30 bg-amber-500/10">
          <AlertTriangle className="size-4" />
          <AlertTitle>{t("dashboard.responsiblePlay.spendLimitRequired")}</AlertTitle>
          <AlertDescription>
            {t("dashboard.responsiblePlay.spendLimitRequiredDesc")}
          </AlertDescription>
        </Alert>
      ) : null}

      {features.creditCardCap && state ? (
        <Card className="border-border/70 shadow-sm" data-focus="credit-card-limit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield />
              {t("dashboard.responsiblePlay.creditCardSpend")}
            </CardTitle>
            <CardDescription>{t("dashboard.responsiblePlay.creditCardSpendDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="break-words">
              {t("dashboard.responsiblePlay.spent")}{" "}
              <span className="font-semibold">
                {formatCurrency(state.creditCardSpendThisMonth, locale)}
              </span>
              {state.creditCardMonthlyLimitGBP != null ? (
                <>
                  {" "}
                  {t("dashboard.responsiblePlay.limit")}{" "}
                  <span className="font-semibold">
                    {formatCurrency(state.creditCardMonthlyLimitGBP, locale)}
                  </span>
                </>
              ) : (
                <>
                  {" "}
                  {t("dashboard.responsiblePlay.limit")}{" "}
                  <span className="font-semibold">
                    {formatCurrency(features.creditCardLimitGBP, locale)}
                  </span>
                </>
              )}
            </p>
            {state.creditCardMonthlyLimitGBP != null ? (
              <p className="text-muted-foreground">
                {t("dashboard.responsiblePlay.remainingAllowance")}
                {formatCurrency(
                  Math.max(0, state.creditCardMonthlyLimitGBP - state.creditCardSpendThisMonth),
                  locale
                )}
              </p>
            ) : (
              <p className="text-muted-foreground">
                {t("dashboard.responsiblePlay.remainingAllowance")}
                {formatCurrency(
                  Math.max(0, features.creditCardLimitGBP - state.creditCardSpendThisMonth),
                  locale
                )}
              </p>
            )}
            <p className="text-muted-foreground">{t("dashboard.responsiblePlay.debitAdvice")}</p>
          </CardContent>
        </Card>
      ) : null}

      {features.personalSpendLimits && state && !effectiveSelfExcluded ? (
        <Card className="border-border/70 shadow-sm" data-focus="spend-limit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield />
              {t("dashboard.responsiblePlay.monthlySpendLimit")}
            </CardTitle>
            <CardDescription>
              {t("dashboard.responsiblePlay.spentThisMonth")}
              {formatCurrency(state.monthlySpendThisMonth, locale)}
              {state.monthlySpendLimit != null
                ? ` ${t("dashboard.responsiblePlay.limit")} ${formatCurrency(state.monthlySpendLimit, locale)}`
                : ` ${t("dashboard.responsiblePlay.noLimitSet")}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {state.pendingMonthlySpendLimit != null && state.monthlySpendLimitEffectiveAt ? (
              <p className="mb-4 break-words text-sm text-muted-foreground">
                {t("dashboard.responsiblePlay.increaseTo")}
                {formatCurrency(state.pendingMonthlySpendLimit, locale)}{" "}
                {t("dashboard.responsiblePlay.effective")}
                {formatDateTime(state.monthlySpendLimitEffectiveAt)}
              </p>
            ) : null}
            <form
              onSubmit={(e) => void handleSaveLimit(e)}
              className="flex flex-col gap-4 sm:flex-row sm:items-end"
            >
              <Field className="flex-1">
                <FieldLabel htmlFor="spend-limit">
                  {t("dashboard.responsiblePlay.newMonthlyLimit")}
                </FieldLabel>
                <FieldDescription>{t("dashboard.responsiblePlay.coolingOff")}</FieldDescription>
                <Input
                  id="spend-limit"
                  type="number"
                  min={0}
                  step="1"
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  placeholder={state.monthlySpendLimit?.toString() ?? "250"}
                />
              </Field>
              <Button
                type="submit"
                disabled={updateSpendLimitMutation.isPending}
                data-umami-event="responsible-play:save-spend-limit"
                data-umami-event-amount={limitInput}
              >
                {updateSpendLimitMutation.isPending ? <Spinner data-icon="inline-start" /> : null}
                {t("dashboard.responsiblePlay.saveLimit")}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {features.selfExclusion && effectiveSelfExcluded ? (
        <Alert variant="destructive" data-focus="self-exclusion">
          <AlertTitle>{t("dashboard.responsiblePlay.accountExcluded")}</AlertTitle>
          <AlertDescription>
            {state?.selfExcludedUntil
              ? t("dashboard.responsiblePlay.excludedUntil", {
                  date: formatDateTime(state.selfExcludedUntil),
                })
              : t("dashboard.responsiblePlay.excludedPermanent")}
          </AlertDescription>
        </Alert>
      ) : null}

      {features.selfExclusion && effectiveSelfExcluded && state ? (
        <Card className="border-destructive/20 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">
              {t("dashboard.responsiblePlay.requestManualReview")}
            </CardTitle>
            <CardDescription>
              {t("dashboard.responsiblePlay.requestManualReviewDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {state.hasPendingOverrideRequest ? (
              <Alert className="border-amber-500/30 bg-amber-500/10">
                <AlertDescription>
                  {t("dashboard.responsiblePlay.pendingOverride")}
                </AlertDescription>
              </Alert>
            ) : (
              <div className="flex flex-col gap-3">
                <Textarea
                  placeholder={t("dashboard.responsiblePlay.explainReason")}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  rows={3}
                />
                <Button
                  variant="outline"
                  onClick={() => void handleRequestOverride()}
                  disabled={requestOverrideMutation.isPending || overrideReason.trim().length < 10}
                  className="self-start"
                  data-umami-event="responsible-play:submit-override-request"
                >
                  {requestOverrideMutation.isPending ? <Spinner data-icon="inline-start" /> : null}
                  {t("dashboard.responsiblePlay.submitReview")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {features.selfExclusion && !effectiveSelfExcluded && state ? (
        <Card className="border-destructive/20 shadow-sm" data-focus="self-exclusion">
          <CardHeader>
            <CardTitle className="text-base text-destructive">
              {t("dashboard.responsiblePlay.selfExclusion")}
            </CardTitle>
            <CardDescription>
              {t("dashboard.responsiblePlay.selfExclusionDesc")}
              {state.selfExclusionMinMonths}
              {t("dashboard.responsiblePlay.months")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:grid-cols-4">
              {EXCLUSION_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant={selectedExclusion === opt.value ? "default" : "outline"}
                  onClick={() => setSelectedExclusion(opt.value)}
                  disabled={effectiveSelfExcluded}
                  className="w-full"
                  data-umami-event="responsible-play:exclusion-duration-select"
                  data-umami-event-duration={opt.value}
                >
                  {t(opt.labelKey as any)}
                </Button>
              ))}
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmExclusion}
                onChange={(e) => setConfirmExclusion(e.target.checked)}
                className="mt-1"
                disabled={effectiveSelfExcluded}
                data-umami-event="responsible-play:exclusion-confirm"
              />
              <span>{t("dashboard.responsiblePlay.understandCheckbox")}</span>
            </label>
            <Button
              variant="destructive"
              disabled={effectiveSelfExcluded || !confirmExclusion || selfExcludeMutation.isPending}
              onClick={() => void handleSelfExclude()}
              data-umami-event="responsible-play:self-exclude"
            >
              {selfExcludeMutation.isPending ? <Spinner data-icon="inline-start" /> : null}
              {t("dashboard.responsiblePlay.confirmSelfExclusion")}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{t("dashboard.responsiblePlay.support")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {SUPPORT_ORGANISATIONS.map((org) => (
              <li key={org.name} className="text-sm">
                <a
                  href={org.url}
                  className="inline-flex items-center gap-1 font-medium text-gold hover:underline"
                  {...(org.url.startsWith("http")
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  data-umami-event="responsible-play:support-org-click"
                  data-umami-event-org={org.name}
                >
                  {org.name}
                  {org.url.startsWith("http") ? <ExternalLink className="size-3" /> : null}
                </a>
                <p className="text-muted-foreground">{org.description}</p>
              </li>
            ))}
          </ul>
          {features.publicResponsiblePlayPage ? (
            <p className="mt-4 text-sm text-muted-foreground">
              <a
                href="/responsible-play"
                className="text-gold hover:underline"
                data-umami-event="responsible-play:policy-link"
              >
                {t("dashboard.responsiblePlay.readPolicy")}
              </a>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
