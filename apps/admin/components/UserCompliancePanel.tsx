"use client";

import {
  useAdminComplianceAudit,
  useAdminComplianceSettings,
  useAdminUser,
  useAdminUserBalance,
  useAdminUserCompliance,
  useAdminUserComplianceMutations,
} from "@oc/api-admin";
import {
  AlertTriangle,
  ArrowRight,
  History,
  Pencil,
  Shield,
  ShieldAlert,
  Wallet,
} from "@oc/icons";
import {
  buildProfileFormFromProfile,
  buildProfilePatchFromDiff,
  EMPTY_PROFILE_FORM,
  PROFILE_FIELD_LABELS,
  type ProfileFormState,
} from "@/components/customer/customer-profile-edit-shared";
import type {
  AdminComplianceOverrideAction,
  AdminUserComplianceState,
  AdminUserProfilePatch,
  Profile,
  SelfExclusionDuration,
} from "@oc/types";
import { formatDateTime } from "@oc/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AdminCompactCard,
  AdminCrudSheetForm,
  AdminSelect,
  AdminTextarea,
  EmptyState,
  StatusBadge,
} from "@/components/admin";
import { DatePicker } from "@/components/DatePicker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const EXCLUSION_OPTIONS: { value: SelfExclusionDuration; label: string }[] = [
  { value: "6months", label: "6 months" },
  { value: "1year", label: "1 year" },
  { value: "5years", label: "5 years" },
  { value: "permanent", label: "Permanent" },
];

const OVERRIDE_ACTIONS: {
  value: AdminComplianceOverrideAction;
  label: string;
  group: "spend" | "exclusion" | "age";
  destructive?: boolean;
}[] = [
  { value: "set_spend_limit", label: "Set monthly spend limit", group: "spend" },
  { value: "clear_pending_spend_limit", label: "Clear pending limit increase", group: "spend" },
  {
    value: "impose_self_exclusion",
    label: "Impose self-exclusion",
    group: "exclusion",
    destructive: true,
  },
  {
    value: "lift_self_exclusion",
    label: "Lift self-exclusion",
    group: "exclusion",
    destructive: true,
  },
  { value: "set_age_verified", label: "Change age verification", group: "age", destructive: true },
];

const ACTION_LABELS: Record<string, string> = Object.fromEntries(
  OVERRIDE_ACTIONS.map(({ value, label }) => [value, label])
);

function showFormValidationError(setError: (message: string) => void, message: string) {
  setError(message);
  toast.error(message);
}

function seedSpendLimitFromCompliance(compliance: AdminUserComplianceState): string {
  return compliance.monthlySpendLimit != null ? compliance.monthlySpendLimit.toFixed(2) : "";
}

interface UserCompliancePanelProps {
  userId: string;
  /** Hide profile/balance shortcut buttons when editing is on the customer sheet. */
  hideQuickActions?: boolean;
}

function formatAuditValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function summarizeAuditChanges(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): string | null {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const parts: string[] = [];

  for (const key of keys) {
    const prev = before?.[key];
    const next = after?.[key];
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      parts.push(`${key}: ${formatAuditValue(prev)} → ${formatAuditValue(next)}`);
    }
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

function isDestructiveOverrideAction(action: AdminComplianceOverrideAction): boolean {
  return OVERRIDE_ACTIONS.some((item) => item.value === action && item.destructive);
}

function ComplianceMetric({
  label,
  value,
  hint,
  variant = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  variant?: "default" | "warning" | "danger" | "success";
}) {
  const valueClassName = {
    default: "text-foreground",
    warning: "text-warning",
    danger: "text-destructive",
    success: "text-success",
  }[variant];

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={cn("text-sm font-semibold", valueClassName)}>{value}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

function AuditTimelineSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-28 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function UserCompliancePanel({ userId, hideQuickActions }: UserCompliancePanelProps) {
  const { data: complianceResponse, isLoading } = useAdminUserCompliance(userId);
  const { data: auditResponse, isLoading: auditLoading } = useAdminComplianceAudit(userId);
  const { data: profileResponse } = useAdminUser(userId);
  const { overrideMutation, profilePatchMutation, balanceAdjustMutation } =
    useAdminUserComplianceMutations(userId);

  const compliance = complianceResponse?.data;
  const auditEntries = auditResponse?.data ?? [];
  const profile = profileResponse?.data ?? null;

  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideAction, setOverrideAction] =
    useState<AdminComplianceOverrideAction>("set_spend_limit");
  const [reason, setReason] = useState("");
  const [spendLimit, setSpendLimit] = useState("");
  const [bypassCooldown, setBypassCooldown] = useState(false);
  const [exclusionDuration, setExclusionDuration] = useState<SelfExclusionDuration>("6months");
  const [acknowledgePermanent, setAcknowledgePermanent] = useState(false);
  const [ageVerifiedTarget, setAgeVerifiedTarget] = useState(true);
  const [overrideError, setOverrideError] = useState("");

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileReason, setProfileReason] = useState("");
  const [profileForm, setProfileForm] = useState<ProfileFormState>(EMPTY_PROFILE_FORM);
  const initialProfileFormRef = useRef<ProfileFormState>(EMPTY_PROFILE_FORM);
  const [profileError, setProfileError] = useState("");

  const [balanceOpen, setBalanceOpen] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceNote, setBalanceNote] = useState("");
  const [balanceError, setBalanceError] = useState("");
  const { data: balanceResponse, isLoading: balanceLoading } = useAdminUserBalance(userId, {
    enabled: balanceOpen,
  });
  const { data: complianceSettingsResponse } = useAdminComplianceSettings();
  const walletBalance = balanceResponse?.data;
  const ageVerificationMinAge = complianceSettingsResponse?.data?.ageVerificationMinAge ?? 18;

  const destructiveAction = isDestructiveOverrideAction(overrideAction);
  const overrideActionMeta = OVERRIDE_ACTIONS.find((item) => item.value === overrideAction);

  const spendProgress = useMemo(() => {
    if (!compliance?.monthlySpendLimit || compliance.monthlySpendLimit <= 0) return 0;
    return Math.min(100, (compliance.monthlySpendThisMonth / compliance.monthlySpendLimit) * 100);
  }, [compliance?.monthlySpendLimit, compliance?.monthlySpendThisMonth]);

  const creditProgress = useMemo(() => {
    if (!compliance?.creditCardMonthlyLimitGBP || compliance.creditCardMonthlyLimitGBP <= 0) {
      return 0;
    }
    return Math.min(
      100,
      (compliance.creditCardSpendThisMonth / compliance.creditCardMonthlyLimitGBP) * 100
    );
  }, [compliance?.creditCardMonthlyLimitGBP, compliance?.creditCardSpendThisMonth]);

  function seedOverrideFormFromCompliance(action: AdminComplianceOverrideAction = overrideAction) {
    if (!compliance) return;

    setReason("");
    setBypassCooldown(false);
    setAcknowledgePermanent(false);
    setExclusionDuration("6months");
    setAgeVerifiedTarget(compliance.isAgeVerified);
    setSpendLimit(action === "set_spend_limit" ? seedSpendLimitFromCompliance(compliance) : "");
    setOverrideError("");
  }

  function resetOverrideForm() {
    seedOverrideFormFromCompliance();
  }

  function resetProfileForm() {
    setProfileForm(EMPTY_PROFILE_FORM);
    initialProfileFormRef.current = EMPTY_PROFILE_FORM;
    setProfileReason("");
    setProfileError("");
  }

  function resetBalanceForm() {
    setBalanceAmount("");
    setBalanceNote("");
    setBalanceError("");
  }

  useEffect(() => {
    if (overrideOpen && compliance) {
      seedOverrideFormFromCompliance(overrideAction);
    }
  }, [overrideOpen, compliance]);

  useEffect(() => {
    if (!overrideOpen || !compliance) return;

    if (overrideAction === "set_spend_limit") {
      setSpendLimit(seedSpendLimitFromCompliance(compliance));
    } else if (overrideAction === "set_age_verified") {
      setAgeVerifiedTarget(compliance.isAgeVerified);
    }
  }, [overrideAction, overrideOpen, compliance]);

  useEffect(() => {
    if (!profileOpen || !profile) return;

    const seeded = buildProfileFormFromProfile(profile);
    setProfileForm(seeded);
    initialProfileFormRef.current = seeded;
    setProfileReason("");
    setProfileError("");
  }, [profileOpen, profile?._id]);

  async function handleOverrideSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOverrideError("");

    if (reason.trim().length < 10) {
      showFormValidationError(
        setOverrideError,
        "Reason must be at least 10 characters for audit purposes."
      );
      return;
    }

    if (
      overrideAction === "lift_self_exclusion" &&
      compliance?.selfExcludedPermanent &&
      !acknowledgePermanent
    ) {
      showFormValidationError(
        setOverrideError,
        "Confirm lifting the permanent self-exclusion before continuing."
      );
      return;
    }

    try {
      switch (overrideAction) {
        case "set_spend_limit": {
          const limit = Number.parseFloat(spendLimit);
          if (Number.isNaN(limit) || limit < 0) {
            showFormValidationError(
              setOverrideError,
              "Enter a valid spend limit (0 blocks all purchases)."
            );
            return;
          }
          await overrideMutation.mutateAsync({
            action: "set_spend_limit",
            reason: reason.trim(),
            monthlySpendLimit: limit,
            bypassCooldown,
          });
          break;
        }
        case "clear_pending_spend_limit":
          await overrideMutation.mutateAsync({
            action: "clear_pending_spend_limit",
            reason: reason.trim(),
          });
          break;
        case "impose_self_exclusion":
          await overrideMutation.mutateAsync({
            action: "impose_self_exclusion",
            reason: reason.trim(),
            duration: exclusionDuration,
          });
          break;
        case "lift_self_exclusion":
          await overrideMutation.mutateAsync({
            action: "lift_self_exclusion",
            reason: reason.trim(),
            acknowledgePermanent: compliance?.selfExcludedPermanent
              ? acknowledgePermanent
              : undefined,
          });
          break;
        case "set_age_verified":
          await overrideMutation.mutateAsync({
            action: "set_age_verified",
            reason: reason.trim(),
            isAgeVerified: ageVerifiedTarget,
          });
          break;
      }
      toast.success("Compliance override applied.");
      setOverrideOpen(false);
      resetOverrideForm();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Override failed";
      setOverrideError(message);
      toast.error(message);
    }
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileError("");

    if (profileReason.trim().length < 10) {
      showFormValidationError(
        setProfileError,
        "Reason must be at least 10 characters for audit purposes."
      );
      return;
    }

    const patch = buildProfilePatchFromDiff(profileForm, initialProfileFormRef.current);
    if (Object.keys(patch).length === 0) {
      showFormValidationError(
        setProfileError,
        "Change at least one profile field before submitting."
      );
      return;
    }

    try {
      await profilePatchMutation.mutateAsync({
        reason: profileReason.trim(),
        ...patch,
      });
      toast.success("Profile updated.");
      setProfileOpen(false);
      resetProfileForm();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Profile update failed";
      setProfileError(message);
      toast.error(message);
    }
  }

  async function handleBalanceSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBalanceError("");

    const amount = Number.parseFloat(balanceAmount);
    if (Number.isNaN(amount) || amount === 0) {
      showFormValidationError(setBalanceError, "Enter a non-zero amount (negative to debit).");
      return;
    }
    if (balanceNote.trim().length === 0) {
      showFormValidationError(setBalanceError, "A note explaining the adjustment is required.");
      return;
    }

    try {
      await balanceAdjustMutation.mutateAsync({ amount, note: balanceNote.trim() });
      toast.success(`Balance adjusted by £${amount.toFixed(2)}.`);
      resetBalanceForm();
      setBalanceOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Balance adjustment failed";
      setBalanceError(message);
      toast.error(message);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-11 w-full rounded-lg" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-28 rounded-xl sm:col-span-2" />
        </div>
      </div>
    );
  }

  if (!compliance) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Compliance unavailable"
        description="We couldn't load compliance data for this customer."
      />
    );
  }

  const exclusionLabel = compliance.effectiveSelfExcluded
    ? compliance.selfExcludedPermanent
      ? "Permanent exclusion"
      : `Excluded until ${formatDateTime(compliance.selfExcludedUntil ?? "")}`
    : compliance.selfExcluded
      ? "Expired (pending reconcile)"
      : "Not excluded";

  return (
    <div className="min-w-0 flex flex-col gap-4">
      {!hideQuickActions ? (
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
          <Button
            type="button"
            variant="gold"
            className="w-full sm:w-auto"
            onClick={() => setOverrideOpen(true)}
          >
            <Shield data-icon="inline-start" />
            Edit Compliance Override
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setProfileOpen(true)}
          >
            <Pencil data-icon="inline-start" />
            Edit profile
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setBalanceOpen(true)}
          >
            <Wallet data-icon="inline-start" />
            Adjust balance
          </Button>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button type="button" variant="gold" onClick={() => setOverrideOpen(true)}>
            <Shield data-icon="inline-start" />
            Compliance override
          </Button>
        </div>
      )}

      <Tabs defaultValue="overview" className="min-w-0">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1">
          <TabsTrigger
            value="overview"
            className="min-w-0 gap-1.5 py-2 text-xs whitespace-normal sm:text-sm"
          >
            <Shield className="size-3.5 shrink-0" aria-hidden="true" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="audit"
            className="min-w-0 gap-1.5 py-2 text-xs whitespace-normal sm:text-sm"
          >
            <History className="size-3.5 shrink-0" aria-hidden="true" />
            Audit log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 min-w-0 flex flex-col gap-3">
          {!compliance.featureFlags.enforcementActive ? (
            <Alert className="border-gold/30 bg-gold/5">
              <Shield className="size-4 text-gold" aria-hidden="true" />
              <AlertDescription className="text-sm">
                Global compliance enforcement is off — rules may not block checkout.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid items-stretch gap-3 sm:grid-cols-2">
            <AdminCompactCard>
              <ComplianceMetric
                label="Spent this month"
                value={`£${compliance.monthlySpendThisMonth.toFixed(2)}`}
              />
              <ComplianceMetric
                label="Current limit"
                value={
                  compliance.monthlySpendLimit != null
                    ? `£${compliance.monthlySpendLimit.toFixed(2)}`
                    : "Not set"
                }
                hint={
                  compliance.spendLimitRequired ? "Limit required before next purchase" : undefined
                }
                variant={compliance.spendLimitRequired ? "warning" : "default"}
              />
              {compliance.monthlySpendLimit != null && compliance.monthlySpendLimit > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <Progress value={spendProgress} className="h-1.5" />
                  <span className="text-[11px] text-muted-foreground">
                    {spendProgress.toFixed(0)}% of monthly limit used
                  </span>
                </div>
              ) : null}
              {compliance.pendingMonthlySpendLimit != null ? (
                <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs">
                  Pending increase to £{compliance.pendingMonthlySpendLimit.toFixed(2)} effective{" "}
                  {formatDateTime(compliance.monthlySpendLimitEffectiveAt ?? "")}
                </div>
              ) : null}
            </AdminCompactCard>

            {compliance.creditCardMonthlyLimitGBP != null ? (
              <AdminCompactCard>
                <ComplianceMetric
                  label="Spent this month"
                  value={`£${compliance.creditCardSpendThisMonth.toFixed(2)}`}
                />
                <ComplianceMetric
                  label="Cap"
                  value={`£${compliance.creditCardMonthlyLimitGBP.toFixed(2)}`}
                />
                <div className="flex flex-col gap-1.5">
                  <Progress value={creditProgress} className="h-1.5" />
                  <span className="text-[11px] text-muted-foreground">
                    {creditProgress.toFixed(0)}% of cap used
                  </span>
                </div>
              </AdminCompactCard>
            ) : null}

            <AdminCompactCard>
              <StatusBadge
                variant={compliance.effectiveSelfExcluded ? "error" : "success"}
                className="w-fit"
              >
                {exclusionLabel}
              </StatusBadge>
              {compliance.selfExcludedAt ? (
                <p className="text-xs text-muted-foreground">
                  Since {formatDateTime(compliance.selfExcludedAt)}
                </p>
              ) : null}
            </AdminCompactCard>

            <AdminCompactCard>
              <StatusBadge
                variant={compliance.isAgeVerified ? "success" : "warning"}
                className="w-fit"
              >
                {compliance.isAgeVerified ? "Verified" : "Not verified"}
              </StatusBadge>
              {compliance.ageVerifiedAt ? (
                <p className="text-xs text-muted-foreground">
                  Verified {formatDateTime(compliance.ageVerifiedAt)}
                </p>
              ) : null}
            </AdminCompactCard>
          </div>
        </TabsContent>

        <TabsContent value="audit" className="mt-4 min-w-0">
          {auditLoading ? (
            <AuditTimelineSkeleton />
          ) : auditEntries.length === 0 ? (
            <EmptyState
              icon={History}
              title="No audit entries"
              description="Compliance overrides and profile changes will appear here."
            />
          ) : (
            <ul className="flex max-h-[min(24rem,50vh)] min-w-0 flex-col gap-3 overflow-y-auto pr-1">
              {auditEntries.map((entry) => {
                const changeSummary = summarizeAuditChanges(entry.before, entry.after);
                const actorLabel =
                  entry.source === "user"
                    ? "Customer"
                    : entry.actorId
                      ? `Admin · ${entry.actorId.slice(-6)}`
                      : "Admin";

                return (
                  <li key={entry._id} className="rounded-xl border border-border/70 bg-card/50 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Badge variant="outline" className="max-w-full break-words font-medium">
                          {ACTION_LABELS[entry.action] ?? entry.action.replaceAll("_", " ")}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="max-w-full text-[10px] uppercase tracking-wide"
                        >
                          {entry.source}
                        </Badge>
                      </div>
                      <time
                        dateTime={entry.createdAt}
                        className="shrink-0 text-xs text-muted-foreground"
                      >
                        {formatDateTime(entry.createdAt)}
                      </time>
                    </div>

                    <dl className="mt-3 grid min-w-0 gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Actor
                        </dt>
                        <dd className="mt-0.5 break-all font-medium">{actorLabel}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Reason
                        </dt>
                        <dd className="mt-0.5 break-words text-foreground">{entry.reason}</dd>
                      </div>
                      {changeSummary ? (
                        <div className="sm:col-span-2">
                          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Changes
                          </dt>
                          <dd className="mt-0.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                            <ArrowRight
                              className="mt-0.5 size-3 shrink-0 text-gold"
                              aria-hidden="true"
                            />
                            <span className="break-words">{changeSummary}</span>
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <AdminCrudSheetForm
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
        editingId={userId}
        formId={`compliance-override-form-${userId}`}
        title="Compliance Override"
        description="Apply a manual override. Destructive actions are logged and require a detailed reason."
        isPending={overrideMutation.isPending}
        error={overrideError}
        size="wide"
        onClose={resetOverrideForm}
        onSubmit={(e) => void handleOverrideSubmit(e)}
      >
        <FieldGroup>
          <FieldSet className="gap-4 rounded-xl border border-border/70 bg-muted/10 p-4">
            <FieldLegend variant="label">Action</FieldLegend>
            <Field>
              <FieldLabel htmlFor="override-action">Override type</FieldLabel>
              <AdminSelect
                value={overrideAction}
                onValueChange={(v) => setOverrideAction(v as AdminComplianceOverrideAction)}
                options={OVERRIDE_ACTIONS.map(({ value, label }) => ({ value, label }))}
              />
              {overrideActionMeta?.destructive ? (
                <FieldDescription className="text-destructive">
                  This action affects player protections and will be permanently audited.
                </FieldDescription>
              ) : null}
            </Field>
          </FieldSet>

          {destructiveAction ? (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" aria-hidden="true" />
              <AlertDescription>
                You are about to apply a sensitive compliance override. Provide a clear reason below
                before submitting.
              </AlertDescription>
            </Alert>
          ) : null}

          {overrideAction === "set_spend_limit" ||
          overrideAction === "clear_pending_spend_limit" ? (
            <FieldSet className="gap-4 rounded-xl border border-border/70 p-4">
              <FieldLegend variant="label">Spend limits</FieldLegend>
              {overrideAction === "set_spend_limit" ? (
                <>
                  <Field>
                    <FieldLabel htmlFor="spend-limit">Monthly limit (£)</FieldLabel>
                    <FieldDescription>
                      Set to 0 to block all purchases for the current month.
                    </FieldDescription>
                    <Input
                      id="spend-limit"
                      type="number"
                      min={0}
                      step="0.01"
                      value={spendLimit}
                      onChange={(e) => setSpendLimit(e.target.value)}
                      placeholder="e.g. 250"
                    />
                  </Field>
                  <Field orientation="horizontal">
                    <Checkbox
                      id="bypass-cooldown"
                      checked={bypassCooldown}
                      onCheckedChange={(v) => setBypassCooldown(v === true)}
                    />
                    <div className="flex flex-col gap-1">
                      <FieldLabel htmlFor="bypass-cooldown">Apply immediately</FieldLabel>
                      <FieldDescription>Bypass the cooldown on limit increases.</FieldDescription>
                    </div>
                  </Field>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Cancels a pending spend limit increase before it takes effect.
                </p>
              )}
            </FieldSet>
          ) : null}

          {overrideAction === "impose_self_exclusion" ||
          overrideAction === "lift_self_exclusion" ? (
            <FieldSet className="gap-4 rounded-xl border border-border/70 p-4">
              <FieldLegend variant="label">Self-exclusion</FieldLegend>
              {overrideAction === "impose_self_exclusion" ? (
                <Field>
                  <FieldLabel htmlFor="exclusion-duration">Duration</FieldLabel>
                  <AdminSelect
                    value={exclusionDuration}
                    onValueChange={(v) => setExclusionDuration(v as SelfExclusionDuration)}
                    options={EXCLUSION_OPTIONS}
                  />
                </Field>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Removes the active self-exclusion and restores account access.
                  </p>
                  {compliance.selfExcludedPermanent ? (
                    <Alert variant="destructive">
                      <AlertTriangle className="size-4" aria-hidden="true" />
                      <AlertDescription>
                        <div className="flex items-start gap-2">
                          <Checkbox
                            id="ack-permanent"
                            checked={acknowledgePermanent}
                            onCheckedChange={(v) => setAcknowledgePermanent(v === true)}
                            aria-describedby="ack-permanent-desc"
                            className="mt-0.5"
                          />
                          <label htmlFor="ack-permanent" id="ack-permanent-desc">
                            I confirm lifting a permanent self-exclusion for this customer.
                          </label>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </>
              )}
            </FieldSet>
          ) : null}

          {overrideAction === "set_age_verified" ? (
            <FieldSet className="gap-4 rounded-xl border border-border/70 p-4">
              <FieldLegend variant="label">Age verification</FieldLegend>
              <Field>
                <FieldLabel htmlFor="age-verified-status">Verification status</FieldLabel>
                <AdminSelect
                  value={ageVerifiedTarget ? "true" : "false"}
                  onValueChange={(v) => setAgeVerifiedTarget(v === "true")}
                  options={[
                    { value: "true", label: "Mark as verified" },
                    { value: "false", label: "Revoke verification" },
                  ]}
                />
              </Field>
            </FieldSet>
          ) : null}

          <Separator />

          <FieldSet className="gap-3">
            <FieldLegend variant="label">Audit reason</FieldLegend>
            <Field>
              <FieldLabel htmlFor="override-reason">
                Reason for override
                <span className="text-destructive"> *</span>
              </FieldLabel>
              <FieldDescription>
                Required for all overrides. Minimum 10 characters — visible in the audit log.
              </FieldDescription>
              <AdminTextarea
                id="override-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Customer verified via support ticket #1234; manual age check completed."
                rows={4}
                aria-required="true"
              />
            </Field>
          </FieldSet>
        </FieldGroup>
      </AdminCrudSheetForm>

      <AdminCrudSheetForm
        open={profileOpen}
        onOpenChange={setProfileOpen}
        editingId={userId}
        formId={`profile-edit-form-${userId}`}
        title="Profile"
        description="Update whitelisted profile fields. All changes are audited."
        isPending={profilePatchMutation.isPending}
        error={profileError}
        size="wide"
        onClose={resetProfileForm}
        onSubmit={(e) => void handleProfileSubmit(e)}
      >
        <FieldGroup>
          <FieldSet className="gap-4 rounded-xl border border-border/70 p-4">
            <FieldLegend variant="label">Personal details</FieldLegend>
            <Field>
              <FieldLabel htmlFor="profile-email">{PROFILE_FIELD_LABELS.email}</FieldLabel>
              <Input
                id="profile-email"
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
                autoComplete="off"
              />
            </Field>
            {(["firstName", "lastName", "phone"] as const).map((field) => (
              <Field key={field}>
                <FieldLabel htmlFor={`profile-${field}`}>{PROFILE_FIELD_LABELS[field]}</FieldLabel>
                <Input
                  id={`profile-${field}`}
                  value={profileForm[field]}
                  onChange={(e) => setProfileForm((f) => ({ ...f, [field]: e.target.value }))}
                  autoComplete="off"
                />
              </Field>
            ))}
            <Field>
              <FieldLabel htmlFor="profile-dateOfBirth">
                {PROFILE_FIELD_LABELS.dateOfBirth}
              </FieldLabel>
              <DatePicker
                id="profile-dateOfBirth"
                value={profileForm.dateOfBirth}
                onChange={(value) => setProfileForm((f) => ({ ...f, dateOfBirth: value }))}
                minAge={ageVerificationMinAge}
                defaultToMinAge
                placeholder="Select date of birth"
              />
            </Field>
          </FieldSet>

          <FieldSet className="gap-4 rounded-xl border border-border/70 p-4">
            <FieldLegend variant="label">Address</FieldLegend>
            {(["addressLine1", "addressLine2", "city", "postcode", "country"] as const).map(
              (field) => (
                <Field key={field}>
                  <FieldLabel htmlFor={`profile-${field}`}>
                    {PROFILE_FIELD_LABELS[field]}
                  </FieldLabel>
                  <Input
                    id={`profile-${field}`}
                    value={profileForm[field]}
                    onChange={(e) => setProfileForm((f) => ({ ...f, [field]: e.target.value }))}
                    autoComplete="off"
                    maxLength={field === "country" ? 2 : undefined}
                  />
                </Field>
              )
            )}
          </FieldSet>

          <FieldSet className="gap-4 rounded-xl border border-border/70 p-4">
            <FieldLegend variant="label">Preferences</FieldLegend>
            <Field orientation="horizontal">
              <Checkbox
                id="profile-marketing"
                checked={profileForm.marketingConsent}
                onCheckedChange={(v) =>
                  setProfileForm((f) => ({ ...f, marketingConsent: v === true }))
                }
              />
              <FieldLabel htmlFor="profile-marketing">Marketing consent</FieldLabel>
            </Field>
          </FieldSet>

          <Separator />

          <Field>
            <FieldLabel htmlFor="profile-reason">
              Reason for change
              <span className="text-destructive"> *</span>
            </FieldLabel>
            <FieldDescription>
              Explain why these profile fields are being updated (min 10 characters).
            </FieldDescription>
            <AdminTextarea
              id="profile-reason"
              value={profileReason}
              onChange={(e) => setProfileReason(e.target.value)}
              placeholder="e.g. Customer requested address correction via email."
              rows={3}
              aria-required="true"
            />
          </Field>
        </FieldGroup>
      </AdminCrudSheetForm>

      <AdminCrudSheetForm
        open={balanceOpen}
        onOpenChange={setBalanceOpen}
        editingId={userId}
        formId={`balance-adjust-form-${userId}`}
        title="Balance Adjustment"
        description="Credit (positive) or debit (negative) the customer's wallet balance."
        isPending={balanceAdjustMutation.isPending}
        error={balanceError}
        onClose={resetBalanceForm}
        onSubmit={(e) => void handleBalanceSubmit(e)}
      >
        <FieldGroup>
          <FieldSet className="gap-4 rounded-xl border border-border/70 bg-muted/10 p-4">
            <FieldLegend variant="label">Current balance</FieldLegend>
            {balanceLoading ? (
              <Skeleton className="h-5 w-48" />
            ) : walletBalance ? (
              <p className="text-sm text-foreground">
                Current balance: £{walletBalance.available.toFixed(2)}
                {walletBalance.pending > 0
                  ? ` (pending: £${walletBalance.pending.toFixed(2)})`
                  : null}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Balance unavailable.</p>
            )}
          </FieldSet>

          <FieldSet className="gap-4 rounded-xl border border-border/70 p-4">
            <FieldLegend variant="label">Adjustment</FieldLegend>
            <Field>
              <FieldLabel htmlFor="balance-amount">Amount (£)</FieldLabel>
              <FieldDescription>
                Use a positive value to credit, negative to debit the wallet.
              </FieldDescription>
              <Input
                id="balance-amount"
                type="number"
                step="0.01"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
                placeholder="e.g. 10.00 or -5.00"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="balance-note">
                Note
                <span className="text-destructive"> *</span>
              </FieldLabel>
              <FieldDescription>
                Required explanation for finance and support records.
              </FieldDescription>
              <AdminTextarea
                id="balance-note"
                value={balanceNote}
                onChange={(e) => setBalanceNote(e.target.value)}
                placeholder="e.g. Goodwill credit for delayed prize delivery."
                rows={3}
                aria-required="true"
              />
            </Field>
          </FieldSet>

          {Number.parseFloat(balanceAmount) < 0 ? (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" aria-hidden="true" />
              <AlertDescription>
                You are debiting this customer's balance. Double-check the amount before submitting.
              </AlertDescription>
            </Alert>
          ) : null}
        </FieldGroup>
      </AdminCrudSheetForm>
    </div>
  );
}
