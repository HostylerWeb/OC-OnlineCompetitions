"use client";

import { cn, withAssetCacheVersion } from "@oc/utils";
import { useMemo, useState } from "react";
import { Avatar, AvatarFallback } from "./ui/avatar";

export interface UserAvatarProps {
  avatarUrl?: string | null;
  initials: string;
  alt?: string;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  /** When set, busts browser cache only when profile/competition metadata changes. */
  cacheVersion?: string | number | Date | null;
  /** Load image immediately (profile hero, header). */
  priority?: boolean;
}

export function UserAvatar({
  avatarUrl,
  initials,
  alt = "Profile picture",
  className,
  imageClassName,
  fallbackClassName,
  cacheVersion,
  priority = false,
}: UserAvatarProps) {
  const src = useMemo(
    () => withAssetCacheVersion(avatarUrl, cacheVersion),
    [avatarUrl, cacheVersion]
  );
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <span
        className={cn(
          "relative flex size-8 shrink-0 overflow-hidden rounded-full",
          className
        )}
      >
        <img
          src={src}
          alt={alt}
          className={cn("aspect-square size-full object-cover", imageClassName)}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          decoding="async"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

  return (
    <Avatar className={className}>
      <AvatarFallback className={fallbackClassName}>{initials}</AvatarFallback>
    </Avatar>
  );
}
