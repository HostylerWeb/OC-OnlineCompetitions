"use client";

import { api, useAdminCompetitions } from "@oc/api-admin";
import { Clock, RefreshCw, SkipForward, Trophy } from "@oc/icons";
import type { AdminCompetition } from "@oc/types";
import { formatDateTime, getDisplayName } from "@oc/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, SortingState, VisibilityState } from "@tanstack/react-table";
import { AssetImage } from "@/components/AssetImage";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PriceCell } from "@/components/admin/PriceCell";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable, DataTableColumnHeader } from "@/components/DataTable";
import { PageShell } from "@/components/PageShell";
import { StatCard } from "@/components/StatCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminTableURL } from "@/hooks/use-admin-table-url";
import { useTableSort } from "@/hooks/use-table-sort";

interface WinnerPreview {
  entry: { _id: string; entryNumber: number; userId: string };
  profile: { email: string | null; firstName: string | null; lastName: string | null };
  competition: { title: string; prizeValue: number } | null;
}

interface RecentWinner {
  _id: string;
  competitionId: string;
  competitionTitle: string;
  displayName?: string;
  prizeValue: number;
  ticketNumber: string;
  email?: string;
  drawnAt: string;
}

interface PendingCompetitionCardProps {
  competition: AdminCompetition;
  onConfirm: (ticketNumber: string, competitionId: string) => void;
  onSkip: (competitionId: string) => void;
  isConfirming: boolean;
}

function PendingCompetitionCard({
  competition,
  onConfirm,
  onSkip,
  isConfirming,
}: PendingCompetitionCardProps) {
  const [ticketNumber, setTicketNumber] = useState("");
  const [preview, setPreview] = useState<WinnerPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  function reset() {
    setTicketNumber("");
    setPreview(null);
    setPreviewError(null);
    setIsLookingUp(false);
  }

  async function handlePreview() {
    if (!ticketNumber.trim()) return;
    setIsLookingUp(true);
    setPreviewError(null);
    setPreview(null);
    try {
      const res = await api.get<WinnerPreview>("/api/admin/winners/entries/search", {
        params: { competitionId: competition._id, ticketNumber: ticketNumber.trim() },
      });
      if (res.data) {
        setPreview(res.data);
      } else {
        setPreviewError("Entry not found. Check the ticket number.");
      }
    } catch {
      setPreviewError("Entry not found. Check the ticket number.");
      setPreview(null);
    } finally {
      setIsLookingUp(false);
    }
  }

  function handleConfirm() {
    if (!preview) return;
    onConfirm(ticketNumber, competition._id);
    reset();
  }

  function handleSkipClick() {
    onSkip(competition._id);
    reset();
  }

  const displayName = preview
    ? getDisplayName(
        {
          firstName: preview.profile.firstName ?? undefined,
          lastName: preview.profile.lastName ?? undefined,
        },
        preview.profile.email ?? ""
      )
    : null;

  return (
    <Card className="relative overflow-hidden shadow-none">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-primary/80" />

      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h3 className="truncate text-base font-semibold text-foreground">
              {competition.title}
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <StatusBadge variant="pending_draw" showIcon={false}>
                Pending Draw
              </StatusBadge>
              <span aria-hidden="true">·</span>
              <span>{formatDateTime(competition.drawDate ?? "")}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <PriceCell value={competition.prizeValue} size="md" />
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Trophy aria-hidden="true" className="size-4 text-gold" />
          <span>
            <span className="font-medium text-foreground">{competition.ticketsSold ?? 0}</span>/
            {competition.maxTickets ?? 0} tickets sold
          </span>
        </div>

        {competition.imageUrl ? (
          <div className="relative h-40 overflow-hidden rounded-lg bg-muted">
            <AssetImage
              src={competition.imageUrl}
              alt={competition.title}
              fill
              className="object-cover"
            />
          </div>
        ) : null}

        <div className="border-t border-border" />

        <div className="flex gap-2">
          <Input
            type="number"
            min={1}
            placeholder="Winning entry #"
            value={ticketNumber}
            onChange={(e) => setTicketNumber(e.target.value)}
            className="flex-1 font-mono"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handlePreview();
            }}
          />
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={!ticketNumber.trim() || isLookingUp}
            data-umami-event="livestream:preview-entry"
          >
            {isLookingUp ? "..." : "Preview"}
          </Button>
          <Button
            variant="outline"
            onClick={handleSkipClick}
            aria-label="Skip competition"
            data-umami-event="livestream:skip-competition"
          >
            <SkipForward />
          </Button>
        </div>

        {previewError ? (
          <Alert variant="destructive">
            <AlertDescription>{previewError}</AlertDescription>
          </Alert>
        ) : null}

        {preview ? (
          <div className="flex flex-col gap-2 rounded-lg border border-success/20 bg-success/10 p-4">
            <div className="mb-2 flex items-center gap-2 text-success">
              <Trophy aria-hidden="true" className="size-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Winner Preview</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span className="text-muted-foreground">Ticket #</span>
              <span className="font-mono font-semibold text-foreground">
                {String(preview.entry.entryNumber).padStart(6, "0")}
              </span>
              <span className="text-muted-foreground">Name</span>
              <span className="text-foreground">{displayName ?? "—"}</span>
              <span className="text-muted-foreground">Email</span>
              <span className="truncate text-foreground">{preview.profile.email ?? "—"}</span>
            </div>
          </div>
        ) : null}

        <div className="flex gap-2">
          <Button
            variant="default"
            className="flex-1"
            onClick={handleConfirm}
            disabled={!preview || isConfirming}
            data-umami-event="livestream:confirm-winner"
          >
            {isConfirming ? "..." : "Confirm Winner"}
          </Button>
          <Button
            variant="outline"
            onClick={reset}
            disabled={isConfirming}
            data-umami-event="livestream:clear-preview"
          >
            Clear
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LivestreamDrawPage() {
  const [completedDraws, setCompletedDraws] = useState<RecentWinner[]>([]);
  const [isLoadingCompleted, setIsLoadingCompleted] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmWinnerState, setConfirmWinnerState] = useState<{
    competitionId: string;
    title: string;
    ticketNumber: string;
  } | null>(null);
  const [completedPagination, setCompletedPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [totalPages, setTotalPages] = useState(1);

  const { searchInput, onSearchChange, extraFilterValues } = useAdminTableURL({
    extraFilters: [{ param: "status", defaultValue: "pending_draw" }],
    defaultPageSize: 20,
  });

  const { sortField, sortDir } = useTableSort("drawnAt", "desc");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const statusFilter = extraFilterValues.status === "all" ? "" : extraFilterValues.status;

  const sorting: SortingState = sortField ? [{ id: sortField, desc: sortDir === "desc" }] : [];

  const handleSortingChange: React.Dispatch<React.SetStateAction<SortingState>> = (updater) => {
    const newSorting = typeof updater === "function" ? updater(sorting) : updater;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    const sort = newSorting[0];
    if (sort) {
      params.set("sortField", sort.id);
      params.set("sortDir", sort.desc ? "desc" : "asc");
    } else {
      params.delete("sortField");
      params.delete("sortDir");
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  const colsRaw = searchParams.get("cols");
  const columnVisibility: VisibilityState = colsRaw
    ? Object.fromEntries(colsRaw.split(",").map((col) => [col, false]))
    : {};

  const handleColumnVisibilityChange: React.Dispatch<React.SetStateAction<VisibilityState>> = (
    updater
  ) => {
    const newVisibility = typeof updater === "function" ? updater(columnVisibility) : updater;
    const hiddenCols = Object.entries(newVisibility)
      .filter(([, visible]) => !visible)
      .map(([col]) => col);
    const params = new URLSearchParams(searchParams.toString());
    if (hiddenCols.length > 0) {
      params.set("cols", hiddenCols.join(","));
    } else {
      params.delete("cols");
    }
    router.replace(`${pathname}?${params.toString()}`);
  };
  const {
    data: competitionsResponse,
    isLoading: isLoadingCompetitions,
    refetch,
  } = useAdminCompetitions({
    statusFilter,
    search: searchInput,
    limit: 20,
  });
  const pendingCompetitions = competitionsResponse?.data ?? [];

  const confirmWinnerMutation = useMutation({
    mutationFn: async ({
      competitionId,
      ticketNumber,
    }: {
      competitionId: string;
      ticketNumber: number;
    }) => api.post("/api/admin/winners", { competitionId, ticketNumber }),
    onSuccess: () => {
      toast.success("Winner confirmed!", { duration: 4000 });
      queryClient.invalidateQueries({ queryKey: ["admin", "competitions"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to confirm winner");
    },
    onSettled: () => setConfirmingId(null),
  });

  const fetchCompletedDraws = useCallback(async () => {
    setIsLoadingCompleted(true);
    try {
      const res = await api.get<RecentWinner[]>("/api/admin/winners", {
        params: {
          page: completedPagination.pageIndex + 1,
          limit: completedPagination.pageSize,
          sortField,
          sortDir,
        },
      });
      setCompletedDraws(res.data ?? []);
      setTotalPages(res.meta?.pages ?? 1);
    } catch {
      toast.error("Failed to load completed draws");
    } finally {
      setIsLoadingCompleted(false);
    }
  }, [completedPagination.pageIndex, completedPagination.pageSize, sortField, sortDir]);

  useEffect(() => {
    void fetchCompletedDraws();
  }, [fetchCompletedDraws]);

  function handleRefresh() {
    void refetch();
    void fetchCompletedDraws();
    toast.success("Competitions refreshed");
  }

  function handlePreview(ticketNumber: string, competitionId: string) {
    const competition = pendingCompetitions.find((c) => c._id === competitionId);
    const parsed = Number.parseInt(ticketNumber, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Enter a valid ticket number");
      return;
    }
    setConfirmWinnerState({
      competitionId,
      title: competition?.title ?? "",
      ticketNumber: String(parsed),
    });
  }

  function handleSkip(_competitionId: string) {
    toast.info("Competition kept in pending draw queue");
  }

  function handleConfirmWinner() {
    if (!confirmWinnerState) return;
    setConfirmingId(confirmWinnerState.competitionId);
    confirmWinnerMutation.mutate(
      {
        competitionId: confirmWinnerState.competitionId,
        ticketNumber: Number.parseInt(confirmWinnerState.ticketNumber, 10),
      },
      {
        onSettled: () => {
          setConfirmingId(null);
          setConfirmWinnerState(null);
          void fetchCompletedDraws();
        },
      }
    );
  }

  const completedColumns: ColumnDef<RecentWinner>[] = useMemo(
    () => [
      {
        id: "competitionTitle",
        accessorKey: "competitionTitle",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Competition" />,
        cell: ({ row }) => (
          <span className="block max-w-[200px] truncate text-sm font-medium">
            {row.original.competitionTitle}
          </span>
        ),
      },
      {
        id: "winner",
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Winner
          </span>
        ),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-[160px] truncate text-sm text-muted-foreground">
            {row.original.displayName ?? row.original.email ?? "Anonymous"}
          </span>
        ),
      },
      {
        id: "ticketNumber",
        accessorKey: "ticketNumber",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Ticket" />,
        cell: ({ row }) => <code className="font-mono text-sm">#{row.original.ticketNumber}</code>,
      },
      {
        id: "prizeValue",
        accessorKey: "prizeValue",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Prize" />,
        cell: ({ row }) => <PriceCell value={row.original.prizeValue} />,
      },
      {
        id: "drawnAt",
        accessorKey: "drawnAt",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Drawn" />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDateTime(row.original.drawnAt)}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <PageShell
      title="Livestream Draw"
      description="Draw winners for competitions during a livestream."
      actions={
        <Button variant="outline" onClick={handleRefresh} data-umami-event="livestream:refresh">
          <RefreshCw />
          Refresh
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Pending draws"
          value={pendingCompetitions.length}
          icon={Clock}
          accent="primary"
        />
        <StatCard
          label="Completed today"
          value={completedDraws.length}
          icon={Trophy}
          accent="success"
        />
        <StatCard
          label="Tickets in pool"
          value={pendingCompetitions.reduce((acc, c) => acc + (c.ticketsSold ?? 0), 0)}
          accent="default"
        />
        <StatCard
          label="Prize value queued"
          value={new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: "GBP",
            maximumFractionDigits: 0,
          }).format(pendingCompetitions.reduce((acc, c) => acc + (c.prizeValue ?? 0), 0))}
          accent="default"
        />
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-border" />
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Pending draws ({pendingCompetitions.length})
          </h2>
          <div className="h-px flex-1 bg-border" />
        </div>

        {isLoadingCompetitions ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {[1, 2].map((i) => (
              <Card key={i} className="shadow-none">
                <div className="flex flex-col gap-3 p-6">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="mt-4 h-32" />
                </div>
              </Card>
            ))}
          </div>
        ) : pendingCompetitions.length === 0 ? (
          <Empty className="border border-dashed py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Trophy aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>No competitions pending draw</EmptyTitle>
              <EmptyDescription>
                Competitions reach this state when their draw date passes while status is "ended".
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {pendingCompetitions.map((comp) => (
              <PendingCompetitionCard
                key={comp._id}
                competition={comp}
                onConfirm={handlePreview}
                onSkip={handleSkip}
                isConfirming={confirmingId === comp._id}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-border" />
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Completed draws
          </h2>
          <div className="h-px flex-1 bg-border" />
        </div>

        <DataTable<RecentWinner>
          columns={completedColumns}
          data={completedDraws}
          pageCount={Math.max(1, totalPages)}
          pagination={completedPagination}
          onPaginationChange={setCompletedPagination}
          isLoading={isLoadingCompleted}
          emptyTitle="No completed draws yet"
          emptyDescription="Completed draws will appear here after winners are confirmed."
          searchValue={searchInput}
          onSearchChange={onSearchChange}
          searchPlaceholder="Search competitions…"
          manualSorting
          sorting={sorting}
          onSortingChange={handleSortingChange}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={handleColumnVisibilityChange}
        />
      </section>

      <ConfirmDialog
        open={confirmWinnerState !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmWinnerState(null);
        }}
        title="Confirm winner"
        description={
          confirmWinnerState
            ? `Draw ${confirmWinnerState.title} for ticket #${confirmWinnerState.ticketNumber}?`
            : ""
        }
        confirmLabel="Confirm winner"
        isLoading={confirmWinnerMutation.isPending}
        onConfirm={handleConfirmWinner}
      />
    </PageShell>
  );
}
