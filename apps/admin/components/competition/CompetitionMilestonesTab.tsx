"use client";

import {
  useAdminAllBonusAwards,
  useAdminBonusAwardAssignmentMutations,
  useAdminBonusAwardAssignments,
  useAdminBonusAwardCapacity,
} from "@oc/api-admin";
import { ChevronDown, ChevronRight, Gift, Star, Trophy } from "@oc/icons";
import type {
  AdminBonusAward,
  AdminBonusAwardAssignment,
  BonusAwardCapacityResponse,
} from "@oc/types";
import { useEffect, useState } from "react";
import { AdminConfirmDialog, EmptyState, EntityActionMenu } from "@/components/admin";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Props {
  competitionId: string;
  maxTickets: number;
  onAddBonus: () => void;
  onEditBonus: (award: AdminBonusAwardAssignment) => void;
}

function MilestoneRow({
  award,
  onEdit,
  onDelete,
}: {
  award: AdminBonusAwardAssignment;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isFired = !!award.firedAt;
  const ba = award.bonusAward;
  const [showWinners, setShowWinners] = useState(false);

  return (
    <Card className={cn(isFired && "opacity-80")}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              isFired ? "bg-gold/20 text-gold" : "bg-muted text-muted-foreground"
            )}
          >
            <Star className={cn("h-5 w-5", isFired && "fill-gold")} />
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-2xl font-bold">{award.milestonePct}%</span>
                <span className="ml-2 text-sm text-muted-foreground">
                  milestone &middot; {award.quantity} winner{award.quantity > 1 ? "s" : ""}
                </span>
              </div>
              <EntityActionMenu
                onEdit={isFired ? undefined : onEdit}
                onDelete={award.isArchived ? undefined : onDelete}
                deleteLabel="Remove"
              />
            </div>

            <p className="text-sm text-muted-foreground">
              Triggers at {award.thresholdNumber.toLocaleString()} tickets sold
              {isFired &&
                award.firedAt &&
                ` \u00B7 Fired at ${new Date(award.firedAt).toLocaleString()}`}
            </p>

            {ba && (
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                {ba.images?.[0] && (
                  <img src={ba.images[0]} alt="" className="h-6 w-6 rounded object-cover" />
                )}
                <Gift className="h-4 w-4 text-gold" />
                <span className="text-sm font-medium">{ba.title}</span>
                {ba.value ? (
                  <span className="text-sm text-muted-foreground">
                    &mdash; &pound;{ba.value.toLocaleString()}
                  </span>
                ) : null}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <StatusBadge variant={isFired ? "info" : "draft"} showIcon={false}>
                {isFired ? `Fired (${award.wonCount}/${award.quantity} won)` : "Pending"}
              </StatusBadge>
              {award.isArchived && (
                <StatusBadge variant="cancelled" showIcon={false}>
                  Archived
                </StatusBadge>
              )}
            </div>

            {award.wins && award.wins.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowWinners((prev) => !prev)}
                  className="text-sm text-gold hover:underline"
                >
                  {showWinners ? (
                    <ChevronDown className="inline h-4 w-4" />
                  ) : (
                    <ChevronRight className="inline h-4 w-4" />
                  )}
                  View {award.wins.length} winner{award.wins.length > 1 ? "s" : ""}
                </button>
                {showWinners && (
                  <div className="rounded-lg border bg-card p-3 mt-2 space-y-2">
                    {award.wins.map((win) => (
                      <div
                        key={win._id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="font-mono text-muted-foreground shrink-0">
                          #{win.ticketNumber.toString().padStart(5, "0")}
                        </span>
                        <span className="text-muted-foreground truncate min-w-0 flex-1">
                          {win.userEmail}
                        </span>
                        <StatusBadge variant={win.claimed ? "success" : "draft"} showIcon={false}>
                          {win.claimed ? "Claimed" : "Unclaimed"}
                        </StatusBadge>
                        <span className="text-muted-foreground shrink-0">
                          {new Date(win.wonAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CompetitionMilestonesTab({ competitionId, onAddBonus, onEditBonus }: Props) {
  const { data: awardsRes, isLoading } = useAdminBonusAwardAssignments(competitionId);
  const { deleteAssignment } = useAdminBonusAwardAssignmentMutations();
  const [deleteConfirm, setDeleteConfirm] = useState<AdminBonusAwardAssignment | null>(null);

  const awards = (awardsRes?.data ?? []) as AdminBonusAwardAssignment[];
  const totalActive = awards.filter((a) => !a.isArchived).length;
  const activeFired = awards.filter((a) => a.firedAt && !a.isArchived).length;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Milestones</CardTitle>
              <CardDescription>
                {totalActive} of 99 milestones configured &middot; {activeFired} fired &middot;{" "}
                <a href="/bonus-awards" className="underline underline-offset-2 hover:text-gold">
                  View all
                </a>
              </CardDescription>
            </div>
            <Button type="button" onClick={onAddBonus} size="sm">
              + Add Milestone
            </Button>
          </div>
        </CardHeader>
      </Card>

      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="py-8">
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        ))
      ) : awards.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No milestones configured yet."
          action={{
            label: "Add Your First Milestone",
            onClick: onAddBonus,
          }}
        />
      ) : (
        awards.map((award) => (
          <MilestoneRow
            key={award._id}
            award={award}
            onEdit={() => onEditBonus(award)}
            onDelete={() => setDeleteConfirm(award)}
          />
        ))
      )}

      <AdminConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(openState) => {
          if (!openState) setDeleteConfirm(null);
        }}
        title="Remove Milestone"
        description={
          deleteConfirm?.wonCount && deleteConfirm.wonCount > 0
            ? "This milestone has already produced winners. It will be archived and hidden from the public view."
            : "Remove this bonus award milestone?"
        }
        onConfirm={async () => {
          if (!deleteConfirm) return;
          await deleteAssignment.mutateAsync({
            assignmentId: deleteConfirm._id,
            competitionId: competitionId,
          });
          setDeleteConfirm(null);
        }}
      />
    </div>
  );
}

export function AddMilestoneDrawer({
  competitionId,
  open,
  onOpenChange,
  editingAssignmentId,
  maxTickets,
  ticketsSold = 0,
}: {
  competitionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingAssignmentId?: string | null;
  maxTickets: number;
  ticketsSold?: number;
}) {
  const { createAssignment, updateAssignment } = useAdminBonusAwardAssignmentMutations();
  const { data: templatesRes } = useAdminAllBonusAwards({
    limit: 100,
  });
  const { data: capacityRes } = useAdminBonusAwardCapacity(competitionId);
  const templates = (templatesRes?.data ?? []) as AdminBonusAward[];
  const capacity = capacityRes?.data as BonusAwardCapacityResponse | undefined;

  const minMilestonePct = maxTickets > 0 ? Math.ceil((ticketsSold / maxTickets) * 100) : 1;
  const initialPct = Math.min(20, Math.max(minMilestonePct, 1));

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPrizeId, setSelectedPrizeId] = useState<string | null>(null);
  const [milestonePct, setMilestonePct] = useState<number>(initialPct);
  const [quantity, setQuantity] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setStep(1);
      setSelectedPrizeId(null);
      setMilestonePct(initialPct);
      setQuantity(1);
      setError("");
      setSubmitting(false);
    }
  }, [open, initialPct]);

  const usedPcts = capacity?.usedPcts ?? [];
  const isUpdate = !!editingAssignmentId;

  async function handleSubmit() {
    if (!selectedPrizeId) {
      setError("Select a prize");
      return;
    }
    if (!isUpdate && usedPcts.includes(milestonePct)) {
      setError("Percentage already used");
      return;
    }
    if (milestonePct < 1 || milestonePct > 99) {
      setError("Must be 1-99");
      return;
    }
    if (
      !isUpdate &&
      maxTickets > 0 &&
      ticketsSold > 0 &&
      Math.floor((maxTickets * milestonePct) / 100) <= ticketsSold
    ) {
      setError(
        `Milestone threshold (${Math.floor((maxTickets * milestonePct) / 100)}) must exceed tickets already sold (${ticketsSold}).`
      );
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      if (editingAssignmentId) {
        await updateAssignment.mutateAsync({
          assignmentId: editingAssignmentId,
          payload: { milestonePct, quantity },
          competitionId,
        });
      } else {
        await createAssignment.mutateAsync({
          competitionId,
          payload: { bonusAwardId: selectedPrizeId, milestonePct, quantity },
        });
      }
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="sm"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{isUpdate ? "Edit" : "Add"} Milestone</DialogTitle>
        </DialogHeader>
        {step === 1 ? (
          <div>
            <h4 className="mb-3 text-sm font-medium">Select Prize</h4>
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {templates.map((t) => (
                  <button
                    key={t._id}
                    type="button"
                    onClick={() => {
                      setSelectedPrizeId(t._id);
                      setStep(2);
                    }}
                    className="w-full rounded-lg border p-3 text-left text-sm hover:bg-accent"
                  >
                    <div className="font-medium">{t.title}</div>
                    {t.value ? (
                      <div className="text-muted-foreground">&pound;{t.value.toLocaleString()}</div>
                    ) : null}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="space-y-4">
            <FieldGroup>
              <FieldLabel>Milestone (%)</FieldLabel>
              <Input
                type="number"
                min={minMilestonePct}
                max={99}
                value={milestonePct}
                onChange={(e) => setMilestonePct(Number(e.target.value))}
              />
              <FieldDescription>
                Triggers at {Math.floor((maxTickets * milestonePct) / 100).toLocaleString()} tickets
                sold.
                {ticketsSold > 0 && <> Must exceed {ticketsSold.toLocaleString()} already sold.</>}
                {usedPcts.length > 0 && ` Already used: ${usedPcts.join("%, ")}%`}
              </FieldDescription>
            </FieldGroup>
            <FieldGroup>
              <FieldLabel>Winners</FieldLabel>
              <Input
                type="number"
                min={1}
                max={100}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </FieldGroup>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Saving..." : isUpdate ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
