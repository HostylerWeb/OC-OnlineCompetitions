"use client";

import { useAdminUserReferralStats } from "@oc/api-admin";
import { Search, User } from "@oc/icons";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function TestWithUserDrawer({
  open,
  onOpenChange,
  settingsTiers,
  calculusMethod = "gross",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  settingsTiers?: Array<{ threshold: number; tickets: number }>;
  calculusMethod?: "net" | "gross";
}) {
  const [searchEmail, setSearchEmail] = useState("");
  const [lookupUserId, setLookupUserId] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const { data: statsData, isLoading } = useAdminUserReferralStats(lookupUserId ?? "");

  async function handleLookup() {
    setLookupError(null);
    setLookupUserId(null);
    if (!searchEmail.trim()) return;
    try {
      const { api } = await import("@oc/api-admin");
      const res = await api.get(
        `/api/admin/users?search=${encodeURIComponent(searchEmail.trim())}&limit=1`
      );
      const users = (res as any)?.data?.data ?? [];
      if (users.length === 0) {
        setLookupError("No user found with that email");
        return;
      }
      setLookupUserId(users[0]._id);
    } catch {
      setLookupError("Failed to look up user");
    }
  }

  const stats = statsData?.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Test with a user</DialogTitle>
          <DialogDescription>
            See how a specific user would perform under the current tier settings.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Search by email…"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            className="flex-1"
          />
          <Button onClick={handleLookup} disabled={isLoading}>
            <Search className="size-4 mr-1" />
            Look up
          </Button>
        </div>
        {lookupError && <p className="text-xs text-destructive">{lookupError}</p>}

        {isLoading && <p className="text-sm text-muted-foreground">Loading stats…</p>}

        {stats && (
          <div className="space-y-3 pt-2">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <User className="size-4" />
                  <CardTitle className="text-sm">Current stats</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Active referrals</span>
                    <p className="font-medium tabular-nums">{stats.activeReferralCount}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pending</span>
                    <p className="font-medium tabular-nums">{stats.pendingReferralCount}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total</span>
                    <p className="font-medium tabular-nums">{stats.totalReferralCount}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tickets earned</span>
                    <p className="font-medium tabular-nums">{stats.totalTicketsEarned}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Current tier</span>
                    <p className="font-medium tabular-nums">{stats.tierTickets} tickets/purchase</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Multiplier</span>
                    <p className="font-medium tabular-nums">{stats.currentMultiplier}×</p>
                  </div>
                </div>
                {stats.referralsToNextTier > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {stats.referralsToNextTier} more active referrals needed to reach next tier (
                    {stats.nextTierTickets} tickets).
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">What-if simulation</CardTitle>
                <CardDescription className="text-xs">
                  How many tickets they&apos;d earn with more referrals
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-xs">
                  {(() => {
                    const tiers = settingsTiers ?? [];
                    const whatIfCounts = [1, 5, 10, 25, 50];
                    function computeTickets(count: number): {
                      tickets: number;
                      isReached: boolean;
                      label: string;
                    } {
                      const sorted = [...tiers].sort((a, b) => a.threshold - b.threshold);
                      let current = null;
                      for (const t of sorted) {
                        if (count >= t.threshold) current = t;
                        else break;
                      }
                      if (!current) return { tickets: 0, isReached: false, label: "No reward" };
                      const effectiveMultiplier = stats!.currentMultiplier ?? 1;
                      let base: number;
                      if (calculusMethod === "gross") {
                        const idx = sorted.findIndex((t) => t.threshold === current.threshold);
                        const prevTickets = idx > 0 ? sorted[idx - 1].tickets : 0;
                        base = current.tickets - prevTickets;
                      } else {
                        base = current.tickets;
                      }
                      const tickets = Math.round(base * effectiveMultiplier);
                      return { tickets, isReached: true, label: `${tickets} tickets` };
                    }
                    return whatIfCounts.map((n) => {
                      const result = computeTickets(n);
                      return (
                        <div key={n} className="flex justify-between py-0.5">
                          <span className="text-muted-foreground">{n} active referrals</span>
                          <span className="tabular-nums font-medium">{result.label}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
