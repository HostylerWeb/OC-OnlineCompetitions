"use client";

import { BadgeCheck, Mail, Phone } from "@oc/icons";
import { cn, getDisplayName, getProfileInitials } from "@oc/utils";
import { UserAvatar } from "@/components/user-avatar";
import { useTranslation } from "@/lib/i18n";

interface ProfileHeroCardProps {
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  isVerified?: boolean;
  className?: string;
}

export function ProfileHeroCard({
  firstName,
  lastName,
  email,
  phone,
  avatarUrl,
  isVerified,
  className,
}: ProfileHeroCardProps) {
  const { t } = useTranslation();
  const initials = getProfileInitials({ firstName, lastName, email });
  const displayName = getDisplayName({ firstName, lastName }, email);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/12 via-primary/4 to-transparent"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/8 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
        <UserAvatar
          avatarUrl={avatarUrl}
          initials={initials}
          className="size-20 shrink-0 rounded-2xl ring-2 ring-primary/25 sm:size-24"
          imageClassName="rounded-2xl"
          fallbackClassName="rounded-2xl bg-primary/15 text-2xl font-bold text-primary sm:text-3xl"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {displayName}
            </h2>
            {isVerified ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                <BadgeCheck className="size-3.5" aria-hidden="true" />
                {t("profile.verified")}
              </span>
            ) : null}
          </div>

          <div className="mt-2 flex flex-col gap-1.5">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="size-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />
              <span className="truncate">{email}</span>
            </p>
            {phone ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="size-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />
                <span>{phone}</span>
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
