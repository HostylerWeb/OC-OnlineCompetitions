"use client";

import { Eye, EyeOff, MapPin, SocialIcon, Ticket, Trophy } from "@oc/icons";
import { cn, getDisplayName, getProfileInitials } from "@oc/utils";
import { COUNTRIES } from "@/components/ui/countries";
import { UserAvatar } from "@/components/user-avatar";
import { useTranslation } from "@/lib/i18n";

interface ProfilePublicPreviewProps {
  firstName?: string;
  lastName?: string;
  email: string;
  avatarUrl?: string;
  country?: string;
  showLocation?: boolean;
  showLastName?: boolean;
  showSocials?: boolean;
  instagram?: string;
  facebook?: string;
  twitter?: string;
  tiktok?: string;
  youtube?: string;
  websiteUrl?: string;
  winsCount: number;
  className?: string;
}

function getCountryLabel(code?: string) {
  if (!code) return null;
  return COUNTRIES.find((c) => c.value === code)?.label ?? code;
}

function VisibilityChip({ visible, label }: { visible: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        visible
          ? "border-success/25 bg-success/10 text-success"
          : "border-border/60 bg-muted/30 text-muted-foreground"
      )}
    >
      {visible ? (
        <Eye className="size-2.5" aria-hidden="true" />
      ) : (
        <EyeOff className="size-2.5" aria-hidden="true" />
      )}
      {label}
    </span>
  );
}

const SOCIAL_PREVIEW = [
  { key: "instagram", icon: "instagram" as const, valueKey: "instagram" as const },
  { key: "facebook", icon: "facebook" as const, valueKey: "facebook" as const },
  { key: "tiktok", icon: "tiktok" as const, valueKey: "tiktok" as const },
] as const;

export function ProfilePublicPreview({
  firstName,
  lastName,
  email,
  avatarUrl,
  country,
  showLocation,
  showLastName,
  showSocials,
  instagram,
  facebook,
  twitter,
  tiktok,
  youtube,
  websiteUrl,
  winsCount,
  className,
}: ProfilePublicPreviewProps) {
  const { t } = useTranslation();
  const initials = getProfileInitials({ firstName, lastName, email });
  const publicName = getDisplayName(
    {
      firstName: firstName ?? undefined,
      lastName: showLastName ? (lastName ?? undefined) : undefined,
    },
    email
  );
  const countryLabel = getCountryLabel(country);
  const locationVisible = Boolean(showLocation && countryLabel);

  const socialValues = { instagram, facebook, twitter, tiktok, youtube, websiteUrl };
  const activeSocials = SOCIAL_PREVIEW.filter(({ valueKey }) => socialValues[valueKey]?.trim());
  const hasSocialLinks =
    showSocials &&
    (activeSocials.length > 0 || twitter?.trim() || youtube?.trim() || websiteUrl?.trim());

  return (
    <section
      aria-label={t("profile.publicPreview")}
      className={cn(
        "overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-border/50 bg-muted/20 px-4 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/90">
          {t("profile.livePreview")}
        </p>
        <p className="text-[10px] text-muted-foreground">{t("profile.entryListAppearance")}</p>
      </div>

      <div className="p-4">
        <div className="relative overflow-hidden rounded-xl p-px">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/35 via-primary/10 to-transparent"
            aria-hidden="true"
          />
          <div className="relative rounded-[calc(0.75rem-1px)] bg-background/95 p-3">
            <div className="flex items-center gap-3">
              <UserAvatar
                avatarUrl={avatarUrl}
                initials={initials}
                className="size-11 shrink-0 rounded-xl ring-1 ring-primary/20"
                imageClassName="rounded-xl"
                fallbackClassName="rounded-xl bg-primary/15 text-sm font-bold text-primary"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{publicName}</p>
                {locationVisible ? (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="size-3 shrink-0" aria-hidden="true" />
                    {countryLabel}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs italic text-muted-foreground/60">
                    {t("profile.locationHidden")}
                  </p>
                )}
              </div>

              <div className="shrink-0 text-right">
                <p className="flex items-center justify-end gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Ticket className="size-3" aria-hidden="true" />
                  {t("profile.ticketLabel")}
                </p>
                <p className="font-mono text-sm font-semibold tabular-nums text-primary">#00421</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <VisibilityChip
            visible={Boolean(showLastName && lastName?.trim())}
            label={t("profile.lastName")}
          />
          <VisibilityChip visible={locationVisible} label={t("profile.location")} />
          <VisibilityChip visible={Boolean(showSocials)} label={t("profile.socialLinks")} />
        </div>

        {hasSocialLinks ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-muted/15 px-3 py-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("profile.socials")}
            </span>
            <div className="flex items-center gap-2">
              {activeSocials.map(({ key, icon }) => (
                <span
                  key={key}
                  className="flex size-7 items-center justify-center rounded-lg border border-border/50 bg-background/80"
                  title={socialValues[key as keyof typeof socialValues]}
                >
                  <SocialIcon name={icon} className="size-3.5 text-muted-foreground" />
                </span>
              ))}
              {twitter?.trim() ? (
                <span className="rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {t("profile.xAbbr")}
                </span>
              ) : null}
              {youtube?.trim() ? (
                <span className="rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {t("profile.ytAbbr")}
                </span>
              ) : null}
              {websiteUrl?.trim() ? (
                <span className="rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {t("profile.webAbbr")}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-between rounded-lg border border-border/50 bg-muted/10 px-3 py-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Trophy className="size-3.5 text-primary" aria-hidden="true" />
            {t("profile.competitionWins")}
          </span>
          <span className="font-mono text-base font-semibold tabular-nums text-primary">
            {winsCount}
          </span>
        </div>
      </div>
    </section>
  );
}
