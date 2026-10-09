"use client";

import {
  useAdminComplianceSettings,
  useAdminUserBalance,
  useAdminUserComplianceMutations,
} from "@oc/api-admin";
import { AlertTriangle, Save, Wallet } from "@oc/icons";
import type { Balance, Profile } from "@oc/types";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AdminCompactCard } from "@/components/admin/AdminCompactCard";
import { AdminTextarea } from "@/components/admin/AdminTextarea";
import { DatePicker } from "@/components/DatePicker";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildProfileFormFromProfile,
  buildProfilePatchFromDiff,
  EMPTY_PROFILE_FORM,
  PROFILE_FIELD_LABELS,
  type ProfileFormState,
} from "./customer-profile-edit-shared";

function showValidationError(setError: (message: string) => void, message: string) {
  setError(message);
  toast.error(message);
}

interface CustomerProfileEditPanelProps {
  userId: string;
  profile: Profile;
  balance: Balance | null;
  balanceLoading: boolean;
}

export function CustomerProfileEditPanel({
  userId,
  profile,
  balance,
  balanceLoading,
}: CustomerProfileEditPanelProps) {
  const { profilePatchMutation, balanceAdjustMutation } = useAdminUserComplianceMutations(userId);
  const { data: complianceSettingsResponse } = useAdminComplianceSettings();
  const ageVerificationMinAge = complianceSettingsResponse?.data?.ageVerificationMinAge ?? 18;

  const [profileForm, setProfileForm] = useState<ProfileFormState>(EMPTY_PROFILE_FORM);
  const initialProfileFormRef = useRef<ProfileFormState>(EMPTY_PROFILE_FORM);
  const [profileReason, setProfileReason] = useState("");
  const [profileError, setProfileError] = useState("");

  const [balanceAmount, setBalanceAmount] = useState("");
  const [targetBalance, setTargetBalance] = useState("");
  const [balanceNote, setBalanceNote] = useState("");
  const [balanceError, setBalanceError] = useState("");

  useEffect(() => {
    const seeded = buildProfileFormFromProfile(profile);
    setProfileForm(seeded);
    initialProfileFormRef.current = seeded;
    setProfileReason("");
    setProfileError("");
  }, [profile]);

  useEffect(() => {
    if (!balance || targetBalance === "") return;
    const target = Number.parseFloat(targetBalance);
    if (Number.isNaN(target)) return;
    const delta = target - balance.available;
    setBalanceAmount(delta === 0 ? "" : delta.toFixed(2));
  }, [targetBalance, balance?.available]);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileError("");

    if (profileReason.trim().length < 10) {
      showValidationError(
        setProfileError,
        "Reason must be at least 10 characters for audit purposes."
      );
      return;
    }

    const patch = buildProfilePatchFromDiff(profileForm, initialProfileFormRef.current);
    if (Object.keys(patch).length === 0) {
      showValidationError(setProfileError, "Change at least one field before saving.");
      return;
    }

    try {
      await profilePatchMutation.mutateAsync({
        reason: profileReason.trim(),
        ...patch,
      });
      toast.success("Profile updated.");
      setProfileReason("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Profile update failed";
      setProfileError(message);
      toast.error(message);
    }
  }

  async function handleBalanceSave(e: React.FormEvent) {
    e.preventDefault();
    setBalanceError("");

    const amount = Number.parseFloat(balanceAmount);
    if (Number.isNaN(amount) || amount === 0) {
      showValidationError(setBalanceError, "Enter a non-zero adjustment amount.");
      return;
    }
    if (balanceNote.trim().length === 0) {
      showValidationError(setBalanceError, "A note explaining the adjustment is required.");
      return;
    }

    try {
      await balanceAdjustMutation.mutateAsync({ amount, note: balanceNote.trim() });
      toast.success(`Site credit adjusted by £${amount.toFixed(2)}.`);
      setBalanceAmount("");
      setTargetBalance("");
      setBalanceNote("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Balance adjustment failed";
      setBalanceError(message);
      toast.error(message);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={(e) => void handleProfileSave(e)} className="flex flex-col gap-4">
        <AdminCompactCard
          title="Account"
          description="Name, email, and contact details. Changes are audited."
          accent
        >
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="cust-email">{PROFILE_FIELD_LABELS.email}</FieldLabel>
              <Input
                id="cust-email"
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
                autoComplete="off"
              />
            </Field>
            {(["firstName", "lastName", "phone"] as const).map((field) => (
              <Field key={field}>
                <FieldLabel htmlFor={`cust-${field}`}>{PROFILE_FIELD_LABELS[field]}</FieldLabel>
                <Input
                  id={`cust-${field}`}
                  value={profileForm[field]}
                  onChange={(e) => setProfileForm((f) => ({ ...f, [field]: e.target.value }))}
                  autoComplete="off"
                />
              </Field>
            ))}
            <Field>
              <FieldLabel htmlFor="cust-dob">{PROFILE_FIELD_LABELS.dateOfBirth}</FieldLabel>
              <DatePicker
                id="cust-dob"
                value={profileForm.dateOfBirth}
                onChange={(value) => setProfileForm((f) => ({ ...f, dateOfBirth: value }))}
                minAge={ageVerificationMinAge}
                defaultToMinAge
                placeholder="Select date of birth"
              />
            </Field>
            <Field orientation="horizontal" className="items-center gap-2">
              <Checkbox
                id="cust-marketing"
                checked={profileForm.marketingConsent}
                onCheckedChange={(v) =>
                  setProfileForm((f) => ({ ...f, marketingConsent: v === true }))
                }
              />
              <FieldLabel htmlFor="cust-marketing" className="font-normal">
                Marketing consent
              </FieldLabel>
            </Field>
          </FieldGroup>
        </AdminCompactCard>

        <AdminCompactCard title="Billing address" description="Shipping and checkout address fields.">
          <FieldGroup className="gap-4">
            {(["addressLine1", "addressLine2", "city", "postcode", "country"] as const).map(
              (field) => (
                <Field key={field}>
                  <FieldLabel htmlFor={`cust-${field}`}>{PROFILE_FIELD_LABELS[field]}</FieldLabel>
                  <Input
                    id={`cust-${field}`}
                    value={profileForm[field]}
                    onChange={(e) => setProfileForm((f) => ({ ...f, [field]: e.target.value }))}
                    autoComplete="off"
                    maxLength={field === "country" ? 2 : undefined}
                    placeholder={field === "country" ? "GB" : undefined}
                  />
                </Field>
              )
            )}
          </FieldGroup>
        </AdminCompactCard>

        <Field>
          <FieldLabel htmlFor="cust-profile-reason">
            Reason for profile changes
            <span className="text-destructive"> *</span>
          </FieldLabel>
          <FieldDescription>Minimum 10 characters — stored in the compliance audit log.</FieldDescription>
          <AdminTextarea
            id="cust-profile-reason"
            value={profileReason}
            onChange={(e) => setProfileReason(e.target.value)}
            placeholder="e.g. Customer requested billing address update via support."
            rows={3}
          />
        </Field>

        {profileError ? (
          <Alert variant="destructive">
            <AlertDescription>{profileError}</AlertDescription>
          </Alert>
        ) : null}

        <Button
          type="submit"
          variant="gold"
          disabled={profilePatchMutation.isPending}
          className="w-full sm:w-auto"
        >
          <Save data-icon="inline-start" />
          {profilePatchMutation.isPending ? "Saving…" : "Save profile"}
        </Button>
      </form>

      <Separator />

      <form onSubmit={(e) => void handleBalanceSave(e)} className="flex flex-col gap-4">
        <AdminCompactCard
          icon={Wallet}
          title="Site credit wallet"
          description="Adjust GBP site credit balance. Use a target balance or a +/- adjustment."
          accent
        >
          <FieldGroup className="gap-4">
            <FieldSet className="gap-2 rounded-lg border border-border/60 bg-muted/15 p-3">
              <FieldLegend variant="label" className="text-xs uppercase tracking-wide">
                Current balance
              </FieldLegend>
              {balanceLoading ? (
                <Skeleton className="h-7 w-32" />
              ) : balance ? (
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  £{Number(balance.available).toFixed(2)}
                  {balance.pending > 0 ? (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      (£{balance.pending.toFixed(2)} pending)
                    </span>
                  ) : null}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No wallet record yet — first credit creates one.</p>
              )}
            </FieldSet>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="cust-target-balance">Set balance to (£)</FieldLabel>
                <FieldDescription>Optional — we calculate the adjustment for you.</FieldDescription>
                <Input
                  id="cust-target-balance"
                  type="number"
                  step="0.01"
                  min="0"
                  value={targetBalance}
                  onChange={(e) => setTargetBalance(e.target.value)}
                  placeholder="e.g. 25.00"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="cust-balance-amount">Adjustment (£)</FieldLabel>
                <FieldDescription>Positive = credit, negative = debit.</FieldDescription>
                <Input
                  id="cust-balance-amount"
                  type="number"
                  step="0.01"
                  value={balanceAmount}
                  onChange={(e) => {
                    setBalanceAmount(e.target.value);
                    setTargetBalance("");
                  }}
                  placeholder="e.g. 10.00 or -5.00"
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="cust-balance-note">
                Note
                <span className="text-destructive"> *</span>
              </FieldLabel>
              <AdminTextarea
                id="cust-balance-note"
                value={balanceNote}
                onChange={(e) => setBalanceNote(e.target.value)}
                placeholder="e.g. Manual goodwill credit per manager approval."
                rows={2}
              />
            </Field>

            {Number.parseFloat(balanceAmount) < 0 ? (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" aria-hidden="true" />
                <AlertDescription>
                  This will debit the customer&apos;s site credit wallet.
                </AlertDescription>
              </Alert>
            ) : null}
          </FieldGroup>
        </AdminCompactCard>

        {balanceError ? (
          <Alert variant="destructive">
            <AlertDescription>{balanceError}</AlertDescription>
          </Alert>
        ) : null}

        <Button
          type="submit"
          variant="outline"
          disabled={balanceAdjustMutation.isPending}
          className="w-full sm:w-auto"
        >
          <Wallet data-icon="inline-start" />
          {balanceAdjustMutation.isPending ? "Applying…" : "Apply balance change"}
        </Button>
      </form>
    </div>
  );
}
