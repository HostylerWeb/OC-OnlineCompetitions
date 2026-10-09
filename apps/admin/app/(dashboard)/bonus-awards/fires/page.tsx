"use client";

import { api } from "@oc/api-admin";
import { RefreshCw, RotateCcw } from "@oc/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type FireItem = {
  _id: string;
  competitionId: {
    _id: string;
    title: string;
    slug: string;
    maxTickets: number;
  } | null;
  assignmentId: {
    _id: string;
    milestonePct: number;
    quantity: number;
    thresholdNumber: number;
  } | null;
  bonusAwardId: string;
  milestonePct: number;
  ticketsSoldAtFire: number;
  firedAt: string;
  status: string;
  drawnAt?: string;
  error?: string;
};

const STATUS_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Failed", value: "failed" },
  { label: "No Eligible", value: "no_eligible_tickets" },
  { label: "Drawing", value: "drawing" },
  { label: "Drawn", value: "drawn" },
] as const;

const RETRIGGERABLE = new Set(["no_eligible_tickets", "failed", "drawing"]);

const statusVariant = (status: string) => {
  switch (status) {
    case "pending":
      return "warning";
    case "drawing":
      return "info";
    case "drawn":
      return "drawn";
    case "no_eligible_tickets":
      return "error";
    case "failed":
      return "failed";
    default:
      return "draft";
  }
};

export default function BonusAwardFiresPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");

  const { data: firesRes, isLoading } = useQuery({
    queryKey: ["admin", "bonus-award-fires", filter],
    queryFn: () => api.get<{ data: FireItem[] }>(`/api/admin/bonus-awards/fires?status=${filter}`),
    refetchInterval: 10_000,
  });

  const retryAllMutation = useMutation({
    mutationFn: () => api.post("/api/admin/jobs/check-bonus-awards"),
    onSuccess: () => {
      toast.success("Bonus award check triggered");
      setTimeout(
        () =>
          queryClient.invalidateQueries({
            queryKey: ["admin", "bonus-award-fires"],
          }),
        3000
      );
    },
    onError: () => toast.error("Failed to trigger bonus award check"),
  });

  const fires = firesRes?.data?.data ?? [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bonus Award Fires</h1>
          <p className="text-muted-foreground">
            All fires across competitions. Auto-refreshes every 10s.
          </p>
        </div>
        <Button
          onClick={() => retryAllMutation.mutate()}
          disabled={retryAllMutation.isPending}
          data-umami-event="bonus-fire:check-all"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {retryAllMutation.isPending ? "Running..." : "Check All Competitions"}
        </Button>
      </div>

      <div className="flex gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            size="sm"
            variant={filter === opt.value ? "default" : "outline"}
            onClick={() => setFilter(opt.value)}
            data-umami-event="bonus-fire:filter-status"
            data-umami-event-value={opt.value}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {!isLoading && fires.length === 0 && (
        <Alert>
          <AlertTitle>No fires</AlertTitle>
          <AlertDescription>
            {filter === "all"
              ? "No bonus award fires found for any status."
              : `No fires with status "${filter}".`}
          </AlertDescription>
        </Alert>
      )}

      {fires.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competition</TableHead>
                  <TableHead>Milestone</TableHead>
                  <TableHead>Threshold</TableHead>
                  <TableHead>Tickets at Fire</TableHead>
                  <TableHead>Fired</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fires.map((fire) => (
                  <TableRow key={fire._id}>
                    <TableCell className="font-medium">
                      {fire.competitionId?.title ?? "Unknown"}
                    </TableCell>
                    <TableCell>{fire.milestonePct}%</TableCell>
                    <TableCell>{fire.assignmentId?.thresholdNumber ?? "?"}</TableCell>
                    <TableCell>{fire.ticketsSoldAtFire}</TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(fire.firedAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell>
                      <StatusBadge variant={statusVariant(fire.status)}>{fire.status}</StatusBadge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {fire.error ?? "—"}
                    </TableCell>
                    <TableCell>
                      <FireRetriggerButton fire={fire} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FireRetriggerButton({ fire }: { fire: FireItem }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.post(`/api/admin/bonus-awards/fires/${fire._id}/retrigger`),
    onSuccess: (res) => {
      const data = res.data as { newStatus?: string };
      toast.success(`Fire retriggered → ${data?.newStatus ?? "complete"}`);
      queryClient.invalidateQueries({ queryKey: ["admin", "bonus-award-fires"] });
    },
    onError: () => toast.error("Retrigger failed"),
  });

  if (!RETRIGGERABLE.has(fire.status)) {
    return (
      <span className="text-xs text-muted-foreground">
        {fire.status === "drawn" ? "Awarded" : "—"}
      </span>
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={mutation.isPending}
        data-umami-event="bonus-fire:retrigger"
      >
        <RotateCcw className="mr-1 h-3 w-3" />
        {mutation.isPending ? "..." : "Retrigger"}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Retrigger bonus award fire?"
        description={
          <div className="space-y-2">
            <p>
              This will reset the fire from <span className="font-mono text-xs">{fire.status}</span>{" "}
              to <span className="font-mono text-xs">pending</span> and re-run winner selection for
              the <strong>{fire.milestonePct}% milestone</strong> of{" "}
              <strong>{fire.competitionId?.title ?? "Unknown"}</strong>.
            </p>
            {fire.error && (
              <p className="text-xs text-muted-foreground">Previous error: {fire.error}</p>
            )}
          </div>
        }
        confirmLabel="Retrigger"
        isLoading={mutation.isPending}
        onConfirm={() => mutation.mutate()}
      />
    </>
  );
}
