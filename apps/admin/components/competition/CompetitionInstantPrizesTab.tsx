"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ApiResponseError,
  useAdminCompetitionInstantPrizeAssignmentMutations,
  useAdminCompetitionInstantPrizeAssignments,
} from "@oc/api-admin";
import { GripVertical, Plus, Trophy } from "@oc/icons";
import type { CompetitionInstantPrize } from "@oc/types";
import { useState } from "react";
import { toast } from "sonner";
import { AdminConfirmDialog, EmptyState, EntityActionMenu } from "@/components/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function activeCipQuantity(cipList: CompetitionInstantPrize[]): number {
  return cipList.filter((cip) => !cip.isArchived).reduce((acc, cip) => acc + cip.quantity, 0);
}

interface CompetitionInstantPrizesTabProps {
  competitionId: string;
  maxTickets: number;
  onAddPrize?: () => void;
  onEditPrize?: (cip: CompetitionInstantPrize) => void;
}

function PrizeEntryRow({
  cip,
  onEdit,
  onDelete,
}: {
  cip: CompetitionInstantPrize;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cip.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const numbers = cip.winningEntryNumbers ?? [];
  const visibleNumbers = numbers.slice(0, 3);
  const remainingCount = numbers.length - 3;
  const isCompetitionTicket = cip.instantPrize?.type === "competition_ticket";
  const ticketCount = cip.instantPrize?.ticketCount ?? 1;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn("overflow-hidden py-0 transition-all", isDragging && "opacity-40")}
    >
      <CardContent className="flex items-start gap-2 p-4">
        <button
          type="button"
          className="mt-0.5 flex cursor-grab touch-none items-center justify-center rounded p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
          tabIndex={-1}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">
                {cip.instantPrize?.title ?? "Unknown Prize"}
              </span>
              {isCompetitionTicket && (
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  Free tickets ×{ticketCount}
                </Badge>
              )}
              {cip.isArchived && (
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  Archived
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>
                {cip.quantity} win{cip.quantity === 1 ? "" : "s"}
              </span>
              {isCompetitionTicket ? (
                <span>
                  {ticketCount} ticket{ticketCount === 1 ? "" : "s"} per win
                </span>
              ) : (
                <span>
                  Tickets:{" "}
                  {numbers.length === 0 ? (
                    "not set yet"
                  ) : (
                    <>
                      {visibleNumbers.join(", ")}
                      {remainingCount > 0 && (
                        <span className="text-primary"> …+{remainingCount} more</span>
                      )}
                    </>
                  )}
                </span>
              )}
              <span className="text-foreground">
                {cip.claimedCount} / {cip.quantity} won
              </span>
            </div>
          </div>
          {!cip.isArchived && (
            <EntityActionMenu
              triggerLabel="Instant prize actions"
              className="shrink-0"
              onEdit={onEdit}
              editLabel="Edit prize"
              onDelete={onDelete}
              deleteLabel="Remove"
              deleteTitle="Remove Instant Prize"
              deleteDescription="Remove this instant prize assignment from the competition?"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}


export function CompetitionInstantPrizesTab({
  competitionId,
  maxTickets,
  onAddPrize,
  onEditPrize,
}: CompetitionInstantPrizesTabProps) {
  const [deleteConfirmCip, setDeleteConfirmCip] = useState<CompetitionInstantPrize | null>(null);

  const { data: cipResponse, isLoading } =
    useAdminCompetitionInstantPrizeAssignments(competitionId);
  const cipList = (cipResponse?.data ?? []) as CompetitionInstantPrize[];
  const { deleteMutation, reorderMutation } = useAdminCompetitionInstantPrizeAssignmentMutations();
  const isPending = deleteMutation.isPending || reorderMutation.isPending;

  const totalAssigned = activeCipQuantity(cipList);
  const remainingCapacity = maxTickets - totalAssigned;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = cipList.findIndex((c) => c.id === active.id);
    const newIndex = cipList.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(cipList, oldIndex, newIndex);
    const items = reordered.map((c, i) => ({ id: c.id, sortOrder: i }));

    reorderMutation.mutate({ competitionId, items });
  }

  async function confirmDelete() {
    if (!deleteConfirmCip || !competitionId) return;
    try {
      const result = await deleteMutation.mutateAsync({
        competitionId,
        id: deleteConfirmCip.id,
      });
      const archived = (result?.data as { archived?: boolean } | undefined)?.archived;
      toast.success(
        archived
          ? "Assignment archived — won tickets preserved"
          : "Instant prize assignment removed"
      );
    } catch (err: unknown) {
      if (err instanceof ApiResponseError) {
        toast.error(err.message);
      } else {
        toast.error(err instanceof Error ? err.message : "Failed to remove assignment");
      }
    } finally {
      setDeleteConfirmCip(null);
    }
  }

  if (!competitionId) {
    return (
      <EmptyState
        icon={Trophy}
        title="Save the competition first"
        description="Instant prizes can be assigned after the competition is created."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-sm">Instant win prizes</CardTitle>
            <CardDescription>
              Prize groups for this competition — same idea as CompetitionGo instant wins
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-xs text-muted-foreground">
              <p>
                <span
                  className={
                    totalAssigned >= maxTickets ? "font-medium text-destructive" : "text-foreground"
                  }
                >
                  {totalAssigned} / {maxTickets}
                </span>{" "}
                instant wins configured
              </p>
              {remainingCapacity > 0 && (
                <p className="text-primary">{remainingCapacity} more win{remainingCapacity === 1 ? "" : "s"} available</p>
              )}
            </div>
            <Button
              type="button"
              onClick={onAddPrize}
              disabled={maxTickets === 0 || remainingCapacity === 0}
            >
              <Plus data-icon="inline-start" />
              Add prize
            </Button>
          </div>
        </CardHeader>
        {maxTickets > 0 && (
          <CardContent className="pt-0">
            <Progress value={Math.min((totalAssigned / maxTickets) * 100, 100)} className="h-2" />
          </CardContent>
        )}
      </Card>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : cipList.length === 0 ? (
        <EmptyState
          title="No instant prizes assigned"
          description="Add instant win prizes to this competition."
          action={{
            label: "Add your first prize",
            onClick: () => onAddPrize?.(),
          }}
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={cipList.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {cipList.map((cip) => (
                <PrizeEntryRow
                  key={cip.id}
                  cip={cip}
                  onEdit={() => onEditPrize?.(cip)}
                  onDelete={() => setDeleteConfirmCip(cip)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AdminConfirmDialog
        open={!!deleteConfirmCip}
        onOpenChange={(openState) => {
          if (!openState) setDeleteConfirmCip(null);
        }}
        title="Remove Instant Prize"
        description={
          deleteConfirmCip
            ? deleteConfirmCip.claimedCount > 0
              ? `Remove "${deleteConfirmCip.instantPrize?.title}"? This archives the assignment — ${deleteConfirmCip.claimedCount} won ticket${deleteConfirmCip.claimedCount !== 1 ? "s" : ""} stay visible.`
              : `Remove "${deleteConfirmCip.instantPrize?.title}"? Winning numbers and held tickets will be freed.`
            : "Remove this prize assignment?"
        }
        confirmLabel={deleteConfirmCip?.claimedCount ? "Archive" : "Remove"}
        isDestructive
        isLoading={isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
