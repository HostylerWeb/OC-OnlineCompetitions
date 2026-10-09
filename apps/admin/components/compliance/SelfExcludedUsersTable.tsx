"use client";

import { useSelfExcludedUsers, useSelfExclusionOverrideMutations } from "@oc/api-admin";
import { AlertTriangle } from "@oc/icons";
import type { SelfExcludedUser } from "@oc/types";
import { formatDate } from "@oc/utils";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type ProcessAction = "approve" | "reject";
type DialogMode = "process" | "lift";

function OverrideRequestBadge({ status }: { status: "pending" | "approved" | "rejected" | null }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "default",
    approved: "secondary",
    rejected: "destructive",
  };
  return <Badge variant={variants[status]}>{status}</Badge>;
}

export function SelfExcludedUsersTable() {
  const { data, isLoading } = useSelfExcludedUsers();
  const { processOverrideMutation, liftSelfExclusionMutation } = useSelfExclusionOverrideMutations();
  const [selectedUser, setSelectedUser] = useState<SelfExcludedUser | null>(null);
  const [processAction, setProcessAction] = useState<ProcessAction>("approve");
  const [dialogMode, setDialogMode] = useState<DialogMode>("process");
  const [adminNote, setAdminNote] = useState("");
  const [liftReason, setLiftReason] = useState("");
  const [acknowledgePermanent, setAcknowledgePermanent] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const users = data?.data ?? [];

  const [emailWarning, setEmailWarning] = useState<string | null>(null);

  async function handleProcess(action: ProcessAction, user: SelfExcludedUser) {
    setSelectedUser(user);
    setProcessAction(action);
    setDialogMode("process");
    setAdminNote("");
    setDialogOpen(true);
  }

  function handleLift(user: SelfExcludedUser) {
    setSelectedUser(user);
    setDialogMode("lift");
    setLiftReason("");
    setAcknowledgePermanent(false);
    setDialogOpen(true);
  }

  async function confirmLift() {
    if (!selectedUser) return;
    const reason = liftReason.trim();
    if (reason.length < 10) {
      toast.error("Reason must be at least 10 characters for audit purposes.");
      return;
    }
    if (selectedUser.isPermanent && !acknowledgePermanent) {
      toast.error("Confirm lifting the permanent self-exclusion before continuing.");
      return;
    }
    setEmailWarning(null);
    try {
      const result = await liftSelfExclusionMutation.mutateAsync({
        userId: selectedUser.userId,
        reason,
        acknowledgePermanent: selectedUser.isPermanent ? true : undefined,
      });
      toast.success(`Self-exclusion removed for ${selectedUser.email}`);
      if (result.data?.emailError) {
        setEmailWarning(result.data.emailError);
      }
      setDialogOpen(false);
      setSelectedUser(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to remove self-exclusion");
    }
  }

  async function confirmProcess() {
    if (!selectedUser) return;
    setEmailWarning(null);
    try {
      const result = await processOverrideMutation.mutateAsync({
        userId: selectedUser.userId,
        action: processAction,
        adminNote: adminNote || undefined,
      });
      const data = result.data;
      if (data?.emailSent !== false) {
        toast.success(
          processAction === "approve"
            ? `Self-exclusion lifted for ${selectedUser.email}`
            : `Override request rejected for ${selectedUser.email}`
        );
      } else {
        toast.success(
          processAction === "approve"
            ? `Self-exclusion lifted for ${selectedUser.email}`
            : `Override request rejected for ${selectedUser.email}`
        );
        if (data?.emailError) {
          setEmailWarning(data.emailError);
        }
      }
      setDialogOpen(false);
      setSelectedUser(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to process request");
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Self-Excluded Users</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (users.length === 0) {
    return (
      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Self-Excluded Users</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No self-excluded users.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Self-Excluded Users</CardTitle>
          <p className="text-sm text-muted-foreground">
            Use <strong>Remove exclusion</strong> to lift self-exclusion directly. Approve or reject
            only applies when the user submitted an override request.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">User</th>
                  <th className="pb-2 pr-4 font-medium">Self-Excluded</th>
                  <th className="pb-2 pr-4 font-medium">Expires</th>
                  <th className="pb-2 pr-4 font-medium">Override Request</th>
                  <th className="pb-2 pr-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.userId} className="border-b border-border/50 last:border-0">
                    <td className="py-3 pr-4">
                      <div className="font-medium">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {formatDate(user.selfExcludedAt)}
                    </td>
                    <td className="py-3 pr-4">
                      {user.isPermanent ? (
                        <Badge variant="destructive">Permanent</Badge>
                      ) : user.selfExcludedUntil ? (
                        <span className="text-muted-foreground">
                          {formatDate(user.selfExcludedUntil)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <OverrideRequestBadge status={user.overrideRequest?.status ?? null} />
                        {user.overrideRequest?.status === "pending" && (
                          <span className="max-w-[180px] truncate text-xs text-muted-foreground">
                            "{user.overrideRequest.userReason}"
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleLift(user)}
                          disabled={
                            liftSelfExclusionMutation.isPending ||
                            processOverrideMutation.isPending
                          }
                          data-umami-event="compliance:lift-self-exclusion"
                        >
                          Remove exclusion
                        </Button>
                        {user.overrideRequest?.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleProcess("approve", user)}
                              disabled={processOverrideMutation.isPending}
                            >
                              Approve request
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleProcess("reject", user)}
                              disabled={processOverrideMutation.isPending}
                            >
                              Reject request
                            </Button>
                          </>
                        )}
                        {user.overrideRequest && user.overrideRequest.status !== "pending" && (
                          <span className="text-xs text-muted-foreground">
                            Request {user.overrideRequest.status}{" "}
                            {user.overrideRequest.createdAt
                              ? new Date(user.overrideRequest.createdAt).toLocaleDateString(
                                  "en-GB"
                                )
                              : ""}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {emailWarning ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="size-4" />
          <AlertDescription>Email delivery failed: {emailWarning}</AlertDescription>
        </Alert>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="sm">
          {dialogMode === "lift" ? (
            <>
              <DialogHeader>
                <DialogTitle>Remove self-exclusion</DialogTitle>
                <DialogDescription>
                  This immediately lifts self-exclusion for {selectedUser?.email}. The action is
                  recorded in the compliance audit log.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <Label htmlFor="lift-reason" className="text-sm font-medium">
                  Reason (required, min 10 characters)
                </Label>
                <Textarea
                  id="lift-reason"
                  value={liftReason}
                  onChange={(e) => setLiftReason(e.target.value)}
                  placeholder="Why is this exclusion being removed?"
                  rows={3}
                />
              </div>

              {selectedUser?.isPermanent ? (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <Checkbox
                    id="lift-ack-permanent"
                    checked={acknowledgePermanent}
                    onCheckedChange={(checked) => setAcknowledgePermanent(checked === true)}
                  />
                  <Label htmlFor="lift-ack-permanent" className="cursor-pointer text-sm leading-snug">
                    I confirm this user had a <strong>permanent</strong> self-exclusion and I am
                    authorising its removal.
                  </Label>
                </div>
              ) : null}

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void confirmLift()}
                  disabled={liftSelfExclusionMutation.isPending}
                >
                  Remove exclusion
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>
                  {processAction === "approve" ? "Approve Override Request" : "Reject Override Request"}
                </DialogTitle>
                <DialogDescription>
                  {processAction === "approve"
                    ? `This will lift the self-exclusion for ${selectedUser?.email}. The user's reason will be used as the audit log reason.`
                    : `This will mark the override request as rejected for ${selectedUser?.email}.`}
                </DialogDescription>
              </DialogHeader>

              {selectedUser?.overrideRequest && (
                <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
                  <span className="font-medium">User reason: </span>
                  <span className="text-muted-foreground">
                    &ldquo;{selectedUser.overrideRequest.userReason}&rdquo;
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="self-exclude-admin-note" className="text-sm font-medium">
                  Admin note (optional)
                </label>
                <Input
                  id="self-exclude-admin-note"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Add a note for the user..."
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant={processAction === "approve" ? "default" : "destructive"}
                  onClick={() => void confirmProcess()}
                  disabled={processOverrideMutation.isPending}
                >
                  {processAction === "approve" ? "Lift Self-Exclusion" : "Reject Request"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
