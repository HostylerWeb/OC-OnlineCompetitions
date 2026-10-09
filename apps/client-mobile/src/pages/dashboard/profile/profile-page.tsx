"use client";

import {
  ChangePasswordForm,
  useDeleteAvatar,
  useMyProfile,
  usePublicComplianceSettings,
  useUpdateProfile,
  useUploadAvatar,
} from "@oc/api-client";
import { Globe, Lock, MapPin, PoundSterling, Shield, Ticket, Trophy, User } from "@oc/icons";
import type { ProfileAddress } from "@oc/types";
import { formatDate, getProfileInitials } from "@oc/utils";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AvatarUpload } from "@/components/avatar-upload";
import { DashboardStatCard } from "@/components/DashboardStatCard";
import { DatePicker } from "@/components/DatePicker";
import {
  DashboardPageHeader,
  dashboardCardClass,
  dashboardCardContentClass,
  dashboardCardHeaderClass,
  dashboardStatsItemClass,
  dashboardStatsRowClass,
} from "@/components/dashboard";
import { ConnectedAccountsSection } from "@/components/profile/ConnectedAccountsSection";
import { ProfileHeroCard } from "@/components/profile/ProfileHeroCard";
import { ProfileNavTabs } from "@/components/profile/ProfileNavTabs";
import { ProfilePublicPreview } from "@/components/profile/ProfilePublicPreview";
import { AddressFormFields } from "@/components/shared/AddressFormFields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { FocusReasonBanner, useFocusFromQuery } from "@/hooks/useFocusFromQuery";
import { formatCurrency, useTranslation } from "@/lib/i18n";

interface ProfileData {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postcode?: string;
  country: string;
  marketingConsent?: boolean;
  instagram?: string;
  facebook?: string;
  twitter?: string;
  tiktok?: string;
  youtube?: string;
  websiteUrl?: string;
  showLastName?: boolean;
  showLocation?: boolean;
  showSocials?: boolean;
  totalEntries: number;
  totalSpent: number;
  winsCount: number;
  competitionWinsCount?: number;
  instantWinsCount?: number;
  bonusWinsCount?: number;
  isVerified?: boolean;
  isAgeVerified?: boolean;
}

const SOCIAL_FIELDS = [
  {
    name: "instagram",
    labelKey: "profile.socialLabels.instagram",
    placeholderKey: "profile.socialPlaceholders.instagram",
  },
  {
    name: "facebook",
    labelKey: "profile.socialLabels.facebook",
    placeholderKey: "profile.socialPlaceholders.facebook",
  },
  {
    name: "twitter",
    labelKey: "profile.socialLabels.twitter",
    placeholderKey: "profile.socialPlaceholders.twitter",
  },
  {
    name: "tiktok",
    labelKey: "profile.socialLabels.tiktok",
    placeholderKey: "profile.socialPlaceholders.tiktok",
  },
  {
    name: "youtube",
    labelKey: "profile.socialLabels.youtube",
    placeholderKey: "profile.socialPlaceholders.youtube",
  },
  {
    name: "websiteUrl",
    labelKey: "profile.socialLabels.website",
    placeholderKey: "profile.socialPlaceholders.website",
  },
] as const;

const PRIVACY_SETTINGS = [
  {
    key: "showLastName" as const,
    labelKey: "profile.privacySettings.showLastName",
    descKey: "profile.privacySettings.showLastNameDesc",
  },
  {
    key: "showLocation" as const,
    labelKey: "profile.privacySettings.showLocation",
    descKey: "profile.privacySettings.showLocationDesc",
  },
] as const;

function ProfileSaveBar({
  isPending,
  t,
}: {
  isPending: boolean;
  t: (key: string, params?: any) => string;
}) {
  return (
    <div className="sticky bottom-4 z-10">
      <div className="rounded-2xl border border-border/70 bg-background/90 p-3 shadow-lg backdrop-blur-md">
        <Button
          type="submit"
          className="h-11 w-full text-base font-medium"
          disabled={isPending}
          data-umami-event="profile:save-changes"
        >
          {isPending ? (
            <>
              <Spinner data-icon="inline-start" />
              {t("dashboard.profile.savingChanges")}
            </>
          ) : (
            t("dashboard.profile.saveChanges")
          )}
        </Button>
      </div>
    </div>
  );
}

export default function DashboardProfileView() {
  return (
    <Suspense fallback={null}>
      <DashboardProfilePageContent />
    </Suspense>
  );
}

function DashboardProfilePageContent() {
  const { t, locale } = useTranslation();
  const navigate = useNavigate();
  const searchParams =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  const [form, setForm] = useState<Partial<ProfileData>>({});
  const activeTab = searchParams.get("tab") ?? "personal";
  const [dobPickerOpen, setDobPickerOpen] = useState(false);
  const [returnToAfterSave, setReturnToAfterSave] = useState<string | null>(null);

  const focusSections = useMemo(
    () => [
      {
        key: "dateOfBirth",
        autofocusSelector: "#dateOfBirth",
        onFocus: () => setDobPickerOpen(true),
      },
    ],
    []
  );

  const { reasonBanner, returnTo, dismissReasonBanner } = useFocusFromQuery({
    sections: focusSections,
    isReady: true,
  });

  useEffect(() => {
    if (returnTo) setReturnToAfterSave(returnTo);
  }, [returnTo]);

  const { data: profileResponse, isLoading } = useMyProfile();
  const { data: complianceResponse } = usePublicComplianceSettings();
  const profile = profileResponse?.data;
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const deleteAvatar = useDeleteAvatar();
  const ageVerificationEnabled =
    complianceResponse?.data?.masterEnabled && complianceResponse?.data?.ageVerificationEnabled;

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  const handleTabChange = useCallback(
    (tab: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "personal") {
        params.delete("tab");
      } else {
        params.set("tab", tab);
      }
      navigate(`?${params.toString()}`, { replace: true });
    },
    [searchParams]
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  function handleSwitch(name: keyof ProfileData, checked: boolean) {
    setForm((prev) => ({ ...prev, [name]: checked }));
  }

  function handleAddressChange(field: keyof ProfileAddress, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const addressValue: ProfileAddress = {
    addressLine1: form.addressLine1 ?? "",
    addressLine2: form.addressLine2 ?? "",
    city: form.city ?? "",
    postcode: form.postcode ?? "",
    country: form.country ?? "GB",
  };

  const profileInitials = profile
    ? getProfileInitials({
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
      })
    : "?";

  async function handleAvatarUpload(file: File) {
    try {
      const res = await uploadAvatar.mutateAsync(file);
      setForm(res.data as Partial<ProfileData>);
      toast.success(t("dashboard.profile.pictureUpdated"));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("dashboard.profile.pictureUploadFailed"));
    }
  }

  async function handleAvatarRemove() {
    try {
      const res = await deleteAvatar.mutateAsync();
      setForm(res.data as Partial<ProfileData>);
      toast.success(t("dashboard.profile.pictureRemoved"));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("dashboard.profile.pictureRemoveFailed"));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await updateProfile.mutateAsync(form);
      setForm(res.data as Partial<ProfileData>);
      toast.success(t("dashboard.profile.profileUpdated"));
      if (returnToAfterSave) {
        window.location.href = returnToAfterSave;
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("dashboard.profile.profileUpdateFailed"));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <DashboardPageHeader
        title={t("dashboard.profile.heading")}
        subtitle={t("dashboard.profile.subtitle")}
      />

      {isLoading ? (
        <div className="flex w-full flex-col gap-5">
          <Skeleton className="h-36 rounded-2xl" shimmer />
          <div className={dashboardStatsRowClass}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={dashboardStatsItemClass}>
                <Skeleton className="h-20 rounded-xl" shimmer />
              </div>
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" shimmer />
        </div>
      ) : profile ? (
        <>
          <ProfileHeroCard
            firstName={profile.firstName}
            lastName={profile.lastName}
            email={profile.email}
            phone={profile.phone}
            avatarUrl={profile.avatarUrl}
            isVerified={profile.isVerified}
          />

          <div className={dashboardStatsRowClass}>
            <div className={dashboardStatsItemClass}>
              <DashboardStatCard
                title={t("dashboard.profile.entries")}
                value={(profile.totalEntries ?? 0).toLocaleString()}
                icon={Ticket}
                variant="gold"
                compact
              />
            </div>
            <div className={dashboardStatsItemClass}>
              <DashboardStatCard
                title={t("dashboard.profile.spent")}
                value={formatCurrency(profile.totalSpent ?? 0, locale)}
                icon={PoundSterling}
                variant="purple"
                compact
              />
            </div>
            <div className={dashboardStatsItemClass}>
              <DashboardStatCard
                title={t("dashboard.profile.competitionWins")}
                value={profile.competitionWinsCount ?? profile.winsCount ?? 0}
                icon={Trophy}
                variant="emerald"
                compact
              />
            </div>
          </div>

          <FocusReasonBanner message={reasonBanner} onDismiss={dismissReasonBanner} />

          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]"
          >
            <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
              <ProfileNavTabs />
              <ProfilePublicPreview
                firstName={form.firstName ?? profile.firstName}
                lastName={form.lastName ?? profile.lastName}
                email={profile.email}
                avatarUrl={form.avatarUrl ?? profile.avatarUrl}
                country={form.country ?? profile.country}
                showLocation={form.showLocation ?? profile.showLocation}
                showLastName={form.showLastName ?? profile.showLastName}
                showSocials={form.showSocials ?? profile.showSocials}
                instagram={form.instagram ?? profile.instagram}
                facebook={form.facebook ?? profile.facebook}
                twitter={form.twitter ?? profile.twitter}
                tiktok={form.tiktok ?? profile.tiktok}
                youtube={form.youtube ?? profile.youtube}
                websiteUrl={form.websiteUrl ?? profile.websiteUrl}
                winsCount={profile.competitionWinsCount ?? profile.winsCount ?? 0}
                className="hidden lg:block"
              />
            </aside>

            <div className="min-w-0">
              <ProfilePublicPreview
                firstName={form.firstName ?? profile.firstName}
                lastName={form.lastName ?? profile.lastName}
                email={profile.email}
                avatarUrl={form.avatarUrl ?? profile.avatarUrl}
                country={form.country ?? profile.country}
                showLocation={form.showLocation ?? profile.showLocation}
                showLastName={form.showLastName ?? profile.showLastName}
                showSocials={form.showSocials ?? profile.showSocials}
                instagram={form.instagram ?? profile.instagram}
                facebook={form.facebook ?? profile.facebook}
                twitter={form.twitter ?? profile.twitter}
                tiktok={form.tiktok ?? profile.tiktok}
                youtube={form.youtube ?? profile.youtube}
                websiteUrl={form.websiteUrl ?? profile.websiteUrl}
                winsCount={profile.competitionWinsCount ?? profile.winsCount ?? 0}
                className="mb-5 lg:hidden"
              />

              <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5">
                <TabsContent value="personal" className="mt-0">
                  <Card className={dashboardCardClass()}>
                    <CardHeader className={dashboardCardHeaderClass}>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <User className="size-4 text-primary" aria-hidden="true" />
                        {t("dashboard.profile.personalInfo")}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {t("dashboard.profile.personalInfoDesc")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className={dashboardCardContentClass}>
                      <FieldGroup>
                        <div className="rounded-xl border border-border/60 bg-muted/15 p-4">
                          <AvatarUpload
                            value={form.avatarUrl ?? profile.avatarUrl}
                            initials={profileInitials}
                            onUpload={handleAvatarUpload}
                            onRemove={handleAvatarRemove}
                            isUploading={uploadAvatar.isPending}
                            isRemoving={deleteAvatar.isPending}
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <Field>
                            <FieldLabel htmlFor="firstName">
                              {t("dashboard.profile.firstName")}
                            </FieldLabel>
                            <Input
                              id="firstName"
                              name="firstName"
                              value={form.firstName ?? ""}
                              onChange={handleChange}
                              placeholder={t("dashboard.profile.firstNamePlaceholder")}
                            />
                          </Field>
                          <Field>
                            <FieldLabel htmlFor="lastName">
                              {t("dashboard.profile.lastName")}
                            </FieldLabel>
                            <Input
                              id="lastName"
                              name="lastName"
                              value={form.lastName ?? ""}
                              onChange={handleChange}
                              placeholder={t("dashboard.profile.lastNamePlaceholder")}
                            />
                          </Field>
                        </div>
                        <Field>
                          <FieldLabel htmlFor="phone">{t("dashboard.profile.phone")}</FieldLabel>
                          <Input
                            id="phone"
                            name="phone"
                            value={form.phone ?? ""}
                            onChange={handleChange}
                            placeholder={t("dashboard.profile.phonePlaceholder")}
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor="email">{t("dashboard.profile.email")}</FieldLabel>
                          <Input id="email" name="email" value={form.email ?? ""} disabled />
                          <FieldDescription>
                            {t("dashboard.profile.emailNotChangable")}
                          </FieldDescription>
                        </Field>
                        {ageVerificationEnabled ? (
                          <Field data-focus="dateOfBirth">
                            <FieldLabel htmlFor="dateOfBirth">
                              {t("dashboard.profile.dateOfBirth")}
                            </FieldLabel>
                            {profile?.isAgeVerified && profile?.dateOfBirth ? (
                              <>
                                <Input
                                  id="dateOfBirth"
                                  value={formatDate(profile.dateOfBirth)}
                                  disabled
                                />
                                <FieldDescription>
                                  {t("dashboard.profile.dobVerified")}
                                </FieldDescription>
                              </>
                            ) : (
                              <>
                                <DatePicker
                                  id="dateOfBirth"
                                  value={
                                    form.dateOfBirth ? String(form.dateOfBirth).slice(0, 10) : ""
                                  }
                                  onChange={(value) =>
                                    setForm((prev) => ({ ...prev, dateOfBirth: value }))
                                  }
                                  minAge={complianceResponse?.data?.ageVerificationMinAge ?? 18}
                                  defaultToMinAge
                                  open={dobPickerOpen}
                                  onOpenChange={setDobPickerOpen}
                                  placeholder={t("dashboard.profile.dobPlaceholder")}
                                />
                                <FieldDescription>
                                  {t("dashboard.profile.dobRequired", {
                                    age: complianceResponse?.data?.ageVerificationMinAge ?? 18,
                                  })}
                                </FieldDescription>
                              </>
                            )}
                          </Field>
                        ) : null}
                      </FieldGroup>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="address" className="mt-0">
                  <Card className={dashboardCardClass()}>
                    <CardHeader className={dashboardCardHeaderClass}>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <MapPin className="size-4 text-primary" aria-hidden="true" />
                        {t("dashboard.profile.deliveryAddress")}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {t("dashboard.profile.deliveryAddressDesc")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className={dashboardCardContentClass}>
                      <FieldGroup>
                        <AddressFormFields
                          value={addressValue}
                          onChange={handleAddressChange}
                          idPrefix="profile"
                        />
                      </FieldGroup>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="social" className="mt-0">
                  <Card className={dashboardCardClass()}>
                    <CardHeader className={dashboardCardHeaderClass}>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Globe className="size-4 text-primary" aria-hidden="true" />
                        {t("dashboard.profile.socialLinks")}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {t("dashboard.profile.socialLinksDesc")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className={dashboardCardContentClass}>
                      <FieldGroup>
                        <div className="rounded-xl border border-border/60 bg-muted/15 px-4 py-3">
                          <Field orientation="horizontal">
                            <FieldContent>
                              <FieldTitle>{t("dashboard.profile.showOnPublic")}</FieldTitle>
                              <FieldDescription>
                                {t("dashboard.profile.showOnPublicDesc")}
                              </FieldDescription>
                            </FieldContent>
                            <Switch
                              checked={form.showSocials ?? true}
                              onCheckedChange={(checked) => handleSwitch("showSocials", checked)}
                              data-umami-event="profile:show-socials-toggle"
                            />
                          </Field>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          {SOCIAL_FIELDS.map(({ name, labelKey, placeholderKey }) => (
                            <Field key={name}>
                              <FieldLabel htmlFor={name}>{t(labelKey)}</FieldLabel>
                              <Input
                                id={name}
                                name={name}
                                value={(form as Record<string, string>)[name] ?? ""}
                                onChange={handleChange}
                                placeholder={t(placeholderKey)}
                              />
                            </Field>
                          ))}
                        </div>
                      </FieldGroup>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="privacy" className="mt-0">
                  <div className="flex flex-col gap-4">
                    <Card className={dashboardCardClass()}>
                      <CardHeader className={dashboardCardHeaderClass}>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Shield className="size-4 text-primary" aria-hidden="true" />
                          {t("dashboard.profile.privacy")}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {t("dashboard.profile.privacyDesc")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-0 p-0 pt-0">
                        {PRIVACY_SETTINGS.map(({ key, labelKey, descKey }, index) => (
                          <div key={key}>
                            {index > 0 ? <Separator /> : null}
                            <Field orientation="horizontal" className="px-5 py-4">
                              <FieldContent>
                                <FieldTitle>{t(labelKey)}</FieldTitle>
                                <FieldDescription>{t(descKey)}</FieldDescription>
                              </FieldContent>
                              <Switch
                                checked={form[key] ?? true}
                                onCheckedChange={(checked) => handleSwitch(key, checked)}
                                data-umami-event="profile:privacy-toggle"
                                data-umami-event-setting={key}
                              />
                            </Field>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card className={dashboardCardClass()}>
                      <CardHeader className={dashboardCardHeaderClass}>
                        <CardTitle className="text-base">
                          {t("dashboard.profile.marketing")}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {t("dashboard.profile.marketingDesc")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className={dashboardCardContentClass}>
                        <Field orientation="horizontal">
                          <FieldContent>
                            <FieldTitle>{t("dashboard.profile.marketingEmails")}</FieldTitle>
                            <FieldDescription>
                              {t("dashboard.profile.marketingEmailsDesc")}
                            </FieldDescription>
                          </FieldContent>
                          <Switch
                            checked={form.marketingConsent ?? false}
                            onCheckedChange={(checked) => handleSwitch("marketingConsent", checked)}
                            data-umami-event="profile:marketing-toggle"
                          />
                        </Field>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {activeTab !== "security" ? (
                  <ProfileSaveBar
                    isPending={updateProfile.isPending}
                    t={(key: string, p?: any) => t(key as any, p)}
                  />
                ) : null}
              </form>

              <TabsContent value="security" className="mt-0 flex flex-col gap-4">
                <Card className={dashboardCardClass()}>
                  <CardHeader className={dashboardCardHeaderClass}>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Lock className="size-4 text-primary" aria-hidden="true" />
                      {t("dashboard.profile.connectedAccounts")}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {t("dashboard.profile.connectedAccountsDesc")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className={dashboardCardContentClass}>
                    <ConnectedAccountsSection />
                  </CardContent>
                </Card>

                <Card className={dashboardCardClass()}>
                  <CardHeader className={dashboardCardHeaderClass}>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Lock className="size-4 text-primary" aria-hidden="true" />
                      {t("dashboard.profile.password")}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {t("dashboard.profile.passwordDesc")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className={dashboardCardContentClass}>
                    <ChangePasswordForm
                      localize={
                        t as (key: string, params?: Record<string, string | number>) => string
                      }
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </>
      ) : (
        <Card className={dashboardCardClass()}>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <User className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("dashboard.profile.failedToLoad")}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
