"use client";

import type { ReferralMindmapNode } from "@oc/api-referrals/mindmap";
import type { TimelineEvent } from "@oc/api-referrals/timeline";
import { Crosshair, Crown, ExternalLink, Loader2, Mail, Shield, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAdminUserActivity } from "@/hooks/use-admin-user-activity";
import { UserActivityTimeline } from "./UserActivityTimeline";

interface ReferralDetailSheetProps {
  userId: string | null;
  node: ReferralMindmapNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFocusUser?: (userId: string) => void;
  isFocused?: boolean;
}

export function ReferralDetailSheet({
  userId,
  node,
  open,
  onOpenChange,
  onFocusUser,
  isFocused,
}: ReferralDetailSheetProps) {
  const [limit] = useState(50);
  const { data, isLoading, isError, refetch } = useAdminUserActivity(
    userId ?? "",
    limit,
    open && !!userId
  );

  const events: TimelineEvent[] = data?.events ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        showCloseButton={false}
      >
        <div className="flex items-start justify-between border-b bg-muted/30 px-6 py-4">
          <div className="min-w-0 flex-1">
            <SheetTitle className="flex items-center gap-1.5 text-sm">
              {node?.isAdmin ? (
                <Shield className="h-4 w-4 text-primary" />
              ) : node?.isRoot ? (
                <Crown className="h-4 w-4 text-amber-500" />
              ) : null}
              User detail
            </SheetTitle>
            {node && (
              <div className="mt-1 min-w-0">
                <p className="truncate font-mono text-sm font-semibold">{node.displayName}</p>
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  {node.email}
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {userId && onFocusUser && (
              <Button
                variant={isFocused ? "default" : "ghost"}
                size="icon"
                onClick={() => onFocusUser(userId)}
                aria-label={isFocused ? "Focused on this user" : "Focus on this user"}
                title={isFocused ? "Focused on this user" : "Focus on this user"}
              >
                <Crosshair className="h-3.5 w-3.5" />
              </Button>
            )}
            {userId && (
              <Button asChild variant="ghost" size="icon" aria-label="Open user admin">
                <Link href={`/users?selected=${userId}`}>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {node && (
          <div className="grid grid-cols-3 gap-px border-b bg-muted/20 text-center">
            <div className="bg-background px-2 py-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Active refs
              </p>
              <p className="font-mono text-base font-semibold text-emerald-600">
                {node.activeRefereeCount}
              </p>
            </div>
            <div className="bg-background px-2 py-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Tickets mint
              </p>
              <p className="font-mono text-base font-semibold text-amber-600">
                {node.ticketsMinted}
              </p>
            </div>
            <div className="bg-background px-2 py-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Spend</p>
              <p className="font-mono text-base font-semibold">
                £{(node.totalSpent ?? 0).toFixed(2)}
              </p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Activity
            </h4>
            {userId && !isLoading && (
              <button
                type="button"
                className="text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => refetch()}
              >
                Refresh
              </button>
            )}
          </div>
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          ) : isError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Failed to load activity.
            </div>
          ) : (
            <UserActivityTimeline events={events} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
