"use client";

import {
  api,
  useAdminBonusAwardWinMutations,
  useAdminBonusAwardWins,
  useServerPagination,
} from "@oc/api-admin";
import { AlertCircle, Award, MoreHorizontal, RefreshCw, Star, Trash2, User } from "@oc/icons";
import type { AdminBonusAwardWinItem } from "@oc/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, SortingState, Updater, VisibilityState } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { AsyncCombobox } from "@/components/AsyncCombobox";
import { DateCell } from "@/components/admin/DateCell";
import { GroupBySelect } from "@/components/admin/GroupBySelect";
import { PriceCell } from "@/components/admin/PriceCell";
import { ShowDeletedToggle } from "@/components/admin/ShowDeletedToggle";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CustomerDialog } from "@/components/CustomerDialog";
import { DataTable, DataTableColumnHeader } from "@/components/DataTable";
import { DatePicker } from "@/components/DatePicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminTableURL } from "@/hooks/use-admin-table-url";
import { useTableSort } from "@/hooks/use-table-sort";

type FireItem = {
  _id: string;
  status: string;
  milestonePct: number;
  competitionId: { _id: string; title: string } | null;
};

const RETRIGGERABLE = new Set(["no_eligible_tickets", "failed", "drawing"]);

const fetchCompetitions = async (search: string) => {
  const res = await api.get<Array<{ _id: string; title: string }>>("/api/admin/competitions", {
    params: { limit: 20, search, status: "active,ended" },
  });
  const opts = (res.data ?? []).map((c) => ({ value: c._id, label: c.title }));
  if (!search) opts.unshift({ value: "all", label: "All competitions" });
  return opts;
};

export default function BonusAwardWinsAdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const _queryClient = useQueryClient();

  const tableState = useAdminTableURL({
    defaultPageSize: 10,
    filterParam: "claimed",
  });
  const { sortField, sortDir, toggleSort, resetSort } = useTableSort("wonAt", "desc");

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [claimTarget, setClaimTarget] = useState<AdminBonusAwardWinItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminBonusAwardWinItem | null>(null);
  const [bulkActionTarget, setBulkActionTarget] = useState<{
    action: string;
    ids: string[];
  } | null>(null);

  const competitionFilter = tableState.extraFilterValues?.competition ?? "all";
  const _userFilter = tableState.extraFilterValues?.user ?? "all";
  const startDate = tableState.extraFilterValues?.startDate ?? "";
  const endDate = tableState.extraFilterValues?.endDate ?? "";
  const showDeleted = tableState.extraFilterValues?.showDeleted === "true";
  const groupBy = tableState.groupBy;

  const grouping = useMemo(() => {
    if (!groupBy) return [];
    const mapping: Record<string, string> = {
      user: "userEmail",
      prize: "prizeTitle",
    };
    return mapping[groupBy] ? [mapping[groupBy]] : [];
  }, [groupBy]);

  const sorting: SortingState = useMemo(
    () => (sortField ? [{ id: sortField, desc: sortDir === "desc" }] : []),
    [sortField, sortDir]
  );

  const onSortingChange = useCallback(
    (updater: Updater<SortingState>) => {
      const newSorting = typeof updater === "function" ? updater(sorting) : updater;
      if (newSorting.length > 0) {
        toggleSort(newSorting[0].id);
      } else {
        resetSort();
      }
    },
    [sorting, toggleSort, resetSort]
  );

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    const cols = searchParams.get("cols");
    if (!cols) return {};
    const hidden = cols.split(",");
    const visibility: VisibilityState = {};
    const ids = [
      "competitionTitle",
      "milestonePct",
      "prizeTitle",
      "userEmail",
      "ticketNumber",
      "prizeValue",
      "claimed",
      "wonAt",
    ];
    for (const id of ids) {
      visibility[id] = !hidden.includes(id);
    }
    return visibility;
  });

  const onColumnVisibilityChange = useCallback(
    (updater: Updater<VisibilityState>) => {
      const newState = typeof updater === "function" ? updater(columnVisibility) : updater;
      setColumnVisibility(newState);
      const hidden = Object.entries(newState)
        .filter(([, visible]) => !visible)
        .map(([key]) => key);
      const params = new URLSearchParams(searchParams.toString());
      if (hidden.length > 0) params.set("cols", hidden.join(","));
      else params.delete("cols");
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [columnVisibility, searchParams, router]
  );

  const apiParams = useMemo(() => {
    const p: Record<string, unknown> = {
      page: tableState.pagination.pageIndex + 1,
      limit: tableState.pagination.pageSize,
      sortField,
      sortDir,
      search: tableState.debouncedSearch,
    };
    if (tableState.filterValue && tableState.filterValue !== "all") {
      p.claimed = tableState.filterValue;
    }
    if (competitionFilter !== "all") p.competitionId = competitionFilter;
    if (startDate) p.wonAtFrom = startDate;
    if (endDate) p.wonAtTo = endDate;
    if (showDeleted) p.showDeleted = "true";
    return p;
  }, [
    tableState.pagination,
    tableState.debouncedSearch,
    tableState.filterValue,
    sortField,
    sortDir,
    competitionFilter,
    startDate,
    endDate,
    showDeleted,
  ]);

  const { data: winsResponse, isLoading } = useAdminBonusAwardWins(apiParams);
  const wins = (winsResponse?.data ?? []) as AdminBonusAwardWinItem[];
  const { pageCount, total } = useServerPagination(winsResponse?.meta);

  const { toggleClaimedMutation, deleteMutation, restoreMutation, bulkMutation } =
    useAdminBonusAwardWinMutations();

  const isDeleted = (row: AdminBonusAwardWinItem) => {
    return "deletedAt" in row && !!row.deletedAt;
  };

  const { data: firesRes } = useQuery({
    queryKey: ["admin", "bonus-award-fires", "retrigger"],
    queryFn: () => api.get<{ data: FireItem[] }>("/api/admin/bonus-awards/fires"),
    refetchInterval: 30_000,
  });

  const retriggerableFires = useMemo(
    () => (firesRes?.data?.data ?? []).filter((f) => RETRIGGERABLE.has(f.status)),
    [firesRes]
  );

  function handleBulkAction(action: string, ids: string[]) {
    setBulkActionTarget({ action, ids });
  }

  const confirmBulkAction = useCallback(() => {
    if (!bulkActionTarget) return;
    bulkMutation.mutate(bulkActionTarget, {
      onSuccess: () => {
        const label =
          bulkActionTarget.action === "claim"
            ? "Marked claimed"
            : bulkActionTarget.action === "unclaim"
              ? "Marked unclaimed"
              : "Deleted";
        toast.success(`${bulkActionTarget.ids.length} win(s) ${label}`);
        setBulkActionTarget(null);
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
    });
  }, [bulkActionTarget, bulkMutation]);

  const bulkActionLabel =
    bulkActionTarget?.action === "claim"
      ? "Mark Claimed"
      : bulkActionTarget?.action === "unclaim"
        ? "Mark Unclaimed"
        : "Delete";

  function handleExport() {
    const params = new URLSearchParams();
    if (tableState.filterValue && tableState.filterValue !== "all")
      params.set("claimed", tableState.filterValue);
    if (competitionFilter !== "all") params.set("competitionId", competitionFilter);
    if (tableState.debouncedSearch) params.set("search", tableState.debouncedSearch);
    if (sortField) {
      params.set("sortField", sortField);
      params.set("sortDir", sortDir);
    }
    if (startDate) params.set("wonAtFrom", startDate);
    if (endDate) params.set("wonAtTo", endDate);
    if (showDeleted) params.set("showDeleted", "true");
    const qs = params.toString();
    window.open(`/api/admin/bonus-awards/wins${qs ? `?${qs}` : ""}`, "_blank");
  }

  const columns: ColumnDef<AdminBonusAwardWinItem>[] = useMemo(
    () => [
      {
        accessorKey: "competitionTitle",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Competition" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span
              className={`block max-w-[200px] truncate font-medium ${isDeleted(row.original) ? "text-muted-foreground line-through" : ""}`}
            >
              {row.original.competitionTitle}
            </span>
            {isDeleted(row.original) && <Badge variant="secondary">Deleted</Badge>}
          </div>
        ),
      },
      {
        accessorKey: "milestonePct",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Milestone" />,
        cell: ({ row }) => (
          <span className="text-sm font-semibold tabular-nums">{row.original.milestonePct}%</span>
        ),
      },
      {
        accessorKey: "prizeTitle",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Prize" />,
        cell: ({ row }) => (
          <span className="truncate text-sm">{row.original.prizeTitle || "—"}</span>
        ),
      },
      {
        accessorKey: "userEmail",
        header: "Winner",
        cell: ({ row }) => {
          const { userEmail, userId } = row.original;
          return (
            <button
              type="button"
              onClick={() => {
                setSelectedUserId(userId);
                setDialogOpen(true);
              }}
              className={`flex max-w-[200px] items-center gap-1.5 text-sm font-medium transition-colors hover:text-primary ${
                isDeleted(row.original) ? "text-muted-foreground line-through" : "text-foreground"
              }`}
            >
              <User className="size-3.5 shrink-0" />
              <span className="truncate">{userEmail}</span>
            </button>
          );
        },
      },
      {
        accessorKey: "ticketNumber",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Ticket" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <Star className="size-3.5 text-primary" />
            <code className="font-mono text-sm tabular-nums">#{row.original.ticketNumber}</code>
          </div>
        ),
      },
      {
        accessorKey: "prizeValue",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Prize value" />,
        cell: ({ row }) => <PriceCell value={row.original.prizeValue} />,
      },
      {
        accessorKey: "claimed",
        header: "Claimed",
        cell: ({ row }) => (
          <StatusBadge variant={row.original.claimed ? "success" : "warning"} showIcon={false}>
            {row.original.claimed ? "Claimed" : "Unclaimed"}
          </StatusBadge>
        ),
      },
      {
        accessorKey: "wonAt",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Won at" />,
        cell: ({ row }) => <DateCell value={row.original.wonAt} />,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            {!row.original.claimed && !isDeleted(row.original) ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setClaimTarget(row.original)}
                data-umami-event="bonus-win:claim"
              >
                Claim
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isDeleted(row.original) ? (
                  <DropdownMenuItem
                    onClick={() => {
                      restoreMutation.mutate(row.original._id, {
                        onSuccess: () => toast.success("Win restored"),
                        onError: (err) =>
                          toast.error(err instanceof Error ? err.message : "Failed"),
                      });
                    }}
                    data-umami-event="bonus-win:row-restore"
                  >
                    <RefreshCw className="mr-2 size-4" />
                    Restore
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedUserId(row.original.userId);
                        setDialogOpen(true);
                      }}
                      data-umami-event="bonus-win:view-customer"
                    >
                      <User className="mr-2 size-4" />
                      View customer
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteTarget(row.original)}
                      data-umami-event="bonus-win:row-delete"
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete win
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [restoreMutation]
  );

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Award className="size-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Bonus Award Wins{total ? ` (${total})` : ""}</h1>
            <p className="text-sm text-muted-foreground">Review and manage bonus award claims.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {retriggerableFires.length > 0 && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/bonus-awards/fires" data-umami-event="bonus-win:view-fires">
                <AlertCircle className="mr-1.5 size-3.5 text-destructive" />
                {retriggerableFires.length} fire(s) need retrigger
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            data-umami-event="bonus-win:export-csv"
          >
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card/40 p-3">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Claimed
          </span>
          <Select
            value={tableState.filterValue}
            onValueChange={(v) => {
              tableState.setFilterValue(v);
              tableState.setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className="h-8 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="true">Claimed</SelectItem>
              <SelectItem value="false">Unclaimed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Competition
          </span>
          <AsyncCombobox
            value={competitionFilter}
            onValueChange={(v) => {
              tableState.setExtraFilterValue("competition", v);
              tableState.setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
            queryKey="baw-competition"
            fetchOptions={fetchCompetitions}
            placeholder="All competitions"
            className="h-8 w-56"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Won from
          </span>
          <DatePicker
            value={startDate}
            onChange={(value) => {
              tableState.setExtraFilterValue("startDate", value);
              tableState.setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
            placeholder="Any date"
            className="h-8 w-36"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Won until
          </span>
          <DatePicker
            value={endDate}
            onChange={(value) => {
              tableState.setExtraFilterValue("endDate", value);
              tableState.setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
            placeholder="Any date"
            className="h-8 w-36"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Group by
          </span>
          <GroupBySelect
            value={groupBy}
            onValueChange={tableState.setGroupBy}
            options={[
              { value: "user", label: "User" },
              { value: "prize", label: "Prize" },
            ]}
            width="w-[160px]"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ShowDeletedToggle
          id="show-deleted-bonus-wins"
          checked={showDeleted}
          onCheckedChange={(v) => {
            tableState.setExtraFilterValue("showDeleted", v ? "true" : "");
            tableState.setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
          umamiEvent="bonus-win:show-deleted-toggle"
        />
      </div>

      <DataTable
        columns={columns}
        data={wins}
        pageCount={pageCount}
        pagination={tableState.pagination}
        onPaginationChange={tableState.setPagination}
        manualSorting
        sorting={sorting}
        onSortingChange={onSortingChange}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={onColumnVisibilityChange}
        isLoading={isLoading}
        searchValue={tableState.searchInput}
        onSearchChange={tableState.onSearchChange}
        searchPlaceholder="Search wins by prize, winner, or ticket..."
        enableRowSelection
        grouping={grouping}
        bulkActions={[
          {
            label: "Mark Claimed",
            onClick: (ids) => handleBulkAction("claim", ids),
          },
          {
            label: "Mark Unclaimed",
            onClick: (ids) => handleBulkAction("unclaim", ids),
          },
          {
            label: "Delete",
            onClick: (ids) => handleBulkAction("delete", ids),
            variant: "destructive",
          },
        ]}
        emptyTitle="No bonus award wins"
        emptyDescription="Bonus award wins appear when milestones are reached."
      />

      <CustomerDialog open={dialogOpen} onOpenChange={setDialogOpen} userId={selectedUserId} />

      <ConfirmDialog
        open={claimTarget !== null}
        onOpenChange={(open) => !open && setClaimTarget(null)}
        title="Mark as claimed"
        description={
          claimTarget
            ? `Mark bonus award "${claimTarget.prizeTitle || claimTarget.competitionTitle}" as claimed?`
            : ""
        }
        isLoading={toggleClaimedMutation.isPending}
        onConfirm={() => {
          if (claimTarget) {
            toggleClaimedMutation.mutate(
              { winId: claimTarget._id, claimed: true },
              {
                onSuccess: () => {
                  toast.success("Marked claimed");
                  setClaimTarget(null);
                },
                onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
              }
            );
          }
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete win"
        description={
          deleteTarget
            ? `Delete win for "${deleteTarget.prizeTitle || deleteTarget.competitionTitle}"? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget._id, {
              onSuccess: () => {
                toast.success("Win deleted");
                setDeleteTarget(null);
              },
              onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
            });
          }
        }}
      />

      <ConfirmDialog
        open={bulkActionTarget !== null}
        onOpenChange={(open) => !open && setBulkActionTarget(null)}
        title={`${bulkActionLabel} ${bulkActionTarget?.ids.length ?? 0} win(s)?`}
        description={`This will ${bulkActionTarget?.action === "delete" ? "delete" : "update"} ${bulkActionTarget?.ids.length ?? 0} selected win(s).`}
        confirmLabel={bulkActionLabel}
        destructive={bulkActionTarget?.action === "delete"}
        isLoading={bulkMutation.isPending}
        onConfirm={confirmBulkAction}
      />
    </div>
  );
}
