"use client";

import {
  api,
  useAdminInstantPrizeWinMutations,
  useAdminInstantPrizeWins,
  useServerPagination,
} from "@oc/api-admin";
import { MoreHorizontal, RefreshCw, Trash2, Trophy, User } from "@oc/icons";
import type { AdminCompetition, AdminUser } from "@oc/types";
import { getDisplayName } from "@oc/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, SortingState, Updater, VisibilityState } from "@tanstack/react-table";
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
import { PageShell } from "@/components/PageShell";
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

interface InstantPrizeWinItem {
  _id: string;
  ticketNumber: number;
  claimed: boolean;
  claimedAt?: string;
  wonAt: string;
  entryId: string;
  prizeTitle: string;
  prizeValue: number;
  prizeType: "prize" | "competition_ticket";
  competitionTitle: string;
  competitionSlug: string;
  userEmail: string;
  userFirstName?: string;
  userLastName?: string;
  userId: string;
  entryNumber: number;
  deletedAt?: string;
}

export default function InstantPrizeWinsAdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const tableState = useAdminTableURL({
    filterParam: "claimed",
    groupByParam: "groupBy",
    extraFilters: [
      { param: "competition", defaultValue: "all" },
      { param: "user", defaultValue: "all" },
      { param: "startDate", defaultValue: "" },
      { param: "endDate", defaultValue: "" },
    ],
    defaultPageSize: 10,
  });
  const competitionFilter = tableState.extraFilterValues.competition ?? "all";
  const userFilter = tableState.extraFilterValues.user ?? "all";
  const startDate = tableState.extraFilterValues.startDate ?? "";
  const endDate = tableState.extraFilterValues.endDate ?? "";
  const groupBy = tableState.groupBy;

  const { sortField, sortDir, toggleSort, resetSort } = useTableSort("wonAt", "desc");

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [claimTarget, setClaimTarget] = useState<InstantPrizeWinItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InstantPrizeWinItem | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  const sorting: SortingState = useMemo(
    () => (sortField ? [{ id: sortField, desc: sortDir === "desc" }] : []),
    [sortField, sortDir]
  );

  const onSortingChange = useCallback(
    (updater: Updater<SortingState>) => {
      const newSorting = typeof updater === "function" ? updater(sorting) : updater;
      const params = new URLSearchParams(searchParams.toString());
      if (newSorting.length > 0) {
        toggleSort(newSorting[0].id);
        params.set("sortField", newSorting[0].id);
        params.set("sortDir", newSorting[0].desc ? "desc" : "asc");
      } else {
        resetSort();
        params.delete("sortField");
        params.delete("sortDir");
      }
      params.delete("page");
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [sorting, searchParams, toggleSort, resetSort, router]
  );

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    const cols = searchParams.get("cols");
    if (!cols) return {};
    const hidden = cols.split(",");
    const visibility: VisibilityState = {};
    const ids = [
      "competitionTitle",
      "prizeTitle",
      "userEmail",
      "entryNumber",
      "prizeValue",
      "prizeType",
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

  const grouping = useMemo(() => {
    if (!groupBy) return [];
    const mapping: Record<string, string> = {
      user: "userEmail",
      prize: "prizeTitle",
    };
    return mapping[groupBy] ? [mapping[groupBy]] : [];
  }, [groupBy]);

  const { data: winsResponse, isLoading } = useAdminInstantPrizeWins({
    page: tableState.pagination.pageIndex + 1,
    limit: tableState.pagination.pageSize,
    claimedFilter: tableState.filterValue === "all" ? "" : tableState.filterValue,
    competitionId: competitionFilter === "all" ? undefined : competitionFilter,
    userId: userFilter === "all" ? undefined : userFilter,
    sortField,
    sortDir,
    search: tableState.debouncedSearch,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    showDeleted,
  });
  const wins = (winsResponse?.data ?? []) as InstantPrizeWinItem[];
  const { pageCount } = useServerPagination(winsResponse?.meta);
  const { toggleClaimedMutation, deleteMutation, restoreMutation } =
    useAdminInstantPrizeWinMutations();

  const bulkMutation = useMutation({
    mutationFn: ({ action, ids }: { action: string; ids: string[] }) =>
      api.post("/api/admin/bulk/instant-prize-wins", { action, ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "instant-prize-wins"] });
      toast.success("Bulk action completed");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
  });

  function handleBulkAction(action: string, ids: string[]) {
    bulkMutation.mutate({ action, ids });
  }

  function handleExport() {
    const params = new URLSearchParams();
    if (tableState.filterValue !== "all") params.set("claimed", tableState.filterValue);
    if (competitionFilter !== "all") params.set("competitionId", competitionFilter);
    if (userFilter !== "all") params.set("userId", userFilter);
    if (tableState.debouncedSearch) params.set("search", tableState.debouncedSearch);
    if (groupBy) params.set("groupBy", groupBy);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (sortField) {
      params.set("sortField", sortField);
      params.set("sortDir", sortDir);
    }
    const qs = params.toString();
    window.open(`/api/admin/export/instant-prize-wins${qs ? `?${qs}` : ""}`, "_blank");
  }

  const fetchCompetitions = async (search: string) => {
    const res = await api.get<AdminCompetition[]>("/api/admin/competitions", {
      params: { limit: 20, search, status: "active,ended" },
    });
    const opts = (res.data ?? []).map((c) => ({ value: c._id, label: c.title }));
    if (!search) opts.unshift({ value: "all", label: "All competitions" });
    return opts;
  };
  const fetchUsers = async (search: string) => {
    const res = await api.get<AdminUser[]>("/api/admin/users", {
      params: { limit: 20, search },
    });
    const opts = (res.data ?? []).map((u) => ({ value: u._id, label: u.email }));
    if (!search) opts.unshift({ value: "all", label: "All users" });
    return opts;
  };

  const isDeleted = (row: InstantPrizeWinItem) => !!row.deletedAt;

  const columns: ColumnDef<InstantPrizeWinItem>[] = useMemo(
    () => [
      {
        accessorKey: "competitionTitle",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Competition" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span
              className={`block max-w-[200px] truncate font-medium ${isDeleted(row.original) ? "line-through text-muted-foreground" : ""}`}
            >
              {row.original.competitionTitle}
            </span>
            {isDeleted(row.original) ? <Badge variant="secondary">Deleted</Badge> : null}
          </div>
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
          const { userEmail, userFirstName, userLastName, userId } = row.original;
          const name = getDisplayName(
            { firstName: userFirstName ?? undefined, lastName: userLastName ?? undefined },
            userEmail
          );
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
              <span className="truncate">{name}</span>
            </button>
          );
        },
      },
      {
        accessorKey: "entryNumber",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Ticket" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <Trophy className="size-3.5 text-primary" />
            <code className="font-mono text-sm tabular-nums">#{row.original.entryNumber}</code>
          </div>
        ),
      },
      {
        accessorKey: "prizeValue",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Prize value" />,
        cell: ({ row }) => <PriceCell value={row.original.prizeValue} />,
      },
      {
        accessorKey: "prizeType",
        header: "Type",
        cell: ({ row }) => (
          <StatusBadge
            variant={row.original.prizeType === "competition_ticket" ? "info" : "warning"}
            showIcon={false}
          >
            {row.original.prizeType === "competition_ticket" ? "Free ticket" : "Prize"}
          </StatusBadge>
        ),
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
                data-umami-event="instant-win:claim"
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
                        onSuccess: () => {
                          toast.success("Win restored");
                        },
                        onError: (err) =>
                          toast.error(err instanceof Error ? err.message : "Failed"),
                      });
                    }}
                    data-umami-event="instant-win:row-restore"
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
                      data-umami-event="instant-win:view-customer"
                    >
                      <User className="mr-2 size-4" />
                      View customer
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteTarget(row.original)}
                      data-umami-event="instant-win:row-delete"
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
    <PageShell title="Instant Prize Wins" description="Review and manage instant prize claims.">
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card/40 p-3">
        <div className="flex flex-col gap-1">
          <span className="text-[11px font-semibold uppercase tracking-wide text-muted-foreground">
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
          <span className="text-[11px font-semibold uppercase tracking-wide text-muted-foreground">
            Competition
          </span>
          <AsyncCombobox
            value={competitionFilter}
            onValueChange={(v) => {
              tableState.setExtraFilterValue("competition", v);
              tableState.setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
            queryKey="ipw-competition"
            fetchOptions={fetchCompetitions}
            placeholder="All competitions"
            className="h-8 w-56"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px font-semibold uppercase tracking-wide text-muted-foreground">
            User
          </span>
          <AsyncCombobox
            value={userFilter}
            onValueChange={(v) => {
              tableState.setExtraFilterValue("user", v);
              tableState.setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
            queryKey="ipw-user"
            fetchOptions={fetchUsers}
            placeholder="All users"
            className="h-8 w-56"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px font-semibold uppercase tracking-wide text-muted-foreground">
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
          <span className="text-[11px font-semibold uppercase tracking-wide text-muted-foreground">
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
          <span className="text-[11px font-semibold uppercase tracking-wide text-muted-foreground">
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

      <div className="flex items-center gap-2 mb-2">
        <ShowDeletedToggle
          id="show-deleted-instant-prize-wins"
          checked={showDeleted}
          onCheckedChange={setShowDeleted}
          umamiEvent="instant-win:show-deleted-toggle"
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
        searchPlaceholder="Search wins…"
        emptyTitle="No instant prize wins"
        emptyDescription="Adjust filters to see results."
        enableRowSelection
        enableGrouping={!!groupBy}
        grouping={grouping}
        rowClassName={(row) => (isDeleted(row as InstantPrizeWinItem) ? "opacity-50" : "")}
        bulkActions={[
          {
            label: "Mark Claimed",
            onClick: (ids) => handleBulkAction("claim", ids),
            umamiEvent: "instant-win:bulk-claim",
          },
          {
            label: "Mark Unclaimed",
            onClick: (ids) => handleBulkAction("unclaim", ids),
            umamiEvent: "instant-win:bulk-unclaim",
          },
          {
            label: "Delete",
            onClick: (ids) => handleBulkAction("delete", ids),
            variant: "destructive",
            umamiEvent: "instant-win:bulk-delete",
          },
        ]}
        exportConfig={{
          onExport: handleExport,
          isExporting: false,
          label: "Export CSV",
          umamiEvent: "instant-win:export-csv",
        }}
      />

      <CustomerDialog open={dialogOpen} onOpenChange={setDialogOpen} userId={selectedUserId} />

      <ConfirmDialog
        open={claimTarget !== null}
        onOpenChange={(open) => !open && setClaimTarget(null)}
        title="Mark as claimed"
        description={
          claimTarget
            ? `Mark instant prize "${claimTarget.prizeTitle || claimTarget.competitionTitle}" as claimed?`
            : ""
        }
        isLoading={toggleClaimedMutation.isPending}
        onConfirm={() => {
          if (claimTarget) {
            toggleClaimedMutation.mutate(claimTarget._id, {
              onSuccess: () => {
                toast.success("Marked claimed");
                setClaimTarget(null);
              },
              onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
            });
          }
        }}
        confirmButtonUmami="instant-win:claim-confirm"
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
        confirmButtonUmami="instant-win:delete-confirm"
      />
    </PageShell>
  );
}
