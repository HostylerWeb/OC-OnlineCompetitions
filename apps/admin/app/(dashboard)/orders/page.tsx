"use client";

import { api, useAdminOrderMutations, useAdminOrders } from "@oc/api-admin";
import { MoreHorizontal, RefreshCw, Trash2, User } from "@oc/icons";
import type { AdminUser } from "@oc/types";
import { OrderNumberCell } from "@oc/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, SortingState, VisibilityState } from "@tanstack/react-table";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { AsyncCombobox } from "@/components/AsyncCombobox";
import { DateCell } from "@/components/admin/DateCell";
import { GroupBySelect } from "@/components/admin/GroupBySelect";
import { OrderDetailDialog } from "@/components/admin/OrderDetailDialog";
import { PriceCell } from "@/components/admin/PriceCell";
import { ShowDeletedToggle } from "@/components/admin/ShowDeletedToggle";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CustomerDialog } from "@/components/CustomerDialog";
import { DataTable, DataTableColumnHeader } from "@/components/DataTable";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminTableURL } from "@/hooks/use-admin-table-url";
import { useTableSort } from "@/hooks/use-table-sort";

type PopulatedOrderUser = {
  _id: string;
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
};

function getOrderUserId(userId: string | PopulatedOrderUser | undefined): string | undefined {
  if (!userId) return undefined;
  if (typeof userId === "string") return userId;
  return userId._id ?? userId.id;
}

interface Order {
  _id: string;
  orderNumber: number;
  userId?: string | PopulatedOrderUser;
  userFullName?: string;
  userEmail?: string;
  status: "pending" | "processing" | "failed" | "refunded" | "completed";
  total: number;
  subtotal: number;
  discountAmount: number;
  referralBonusTickets: number;
  referralBalanceUsed: number;
  itemCount?: number;
  items?: unknown[];
  providerSessionId?: string;
  provider?: string;
  paidAt?: string;
  promoCodeId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

const statusVariantMap: Record<Order["status"], "warning" | "success" | "error" | "draft"> = {
  pending: "warning",
  processing: "warning",
  failed: "error",
  refunded: "draft",
  completed: "success",
};

type ProviderKey = "local" | "unknown";

const providerLabel: Record<ProviderKey, string> = {
  local: "Local",
  unknown: "—",
};

function ProviderPill({ provider }: { provider: ProviderKey }) {
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {providerLabel[provider]}
    </span>
  );
}

export default function OrdersAdminPage() {
  const tableState = useAdminTableURL({
    filterParam: "status",
    groupByParam: "groupBy",
    extraFilters: [{ param: "user", defaultValue: "all" }],
    columnSearchFields: [
      { param: "orderNumber" },
      { param: "userEmail" },
      { param: "userFullName" },
    ],
    defaultPageSize: 10,
  });
  const userFilter = tableState.extraFilterValues.user ?? "all";
  const { groupBy: effectiveGroupBy } = tableState;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { sortField, sortDir, toggleSort, resetSort } = useTableSort("createdAt", "desc");
  const [showDeleted, setShowDeleted] = useState(false);

  const sorting: SortingState = sortField ? [{ id: sortField, desc: sortDir === "desc" }] : [];
  const onSortingChange = (updater: SortingState | ((old: SortingState) => SortingState)) => {
    const newSorting = typeof updater === "function" ? updater(sorting) : updater;
    if (newSorting.length > 0) {
      toggleSort(newSorting[0].id);
    } else {
      resetSort();
    }
    const params = new URLSearchParams(searchParams.toString());
    if (newSorting.length > 0) {
      params.set("sortField", newSorting[0].id);
      params.set("sortDir", newSorting[0].desc ? "desc" : "asc");
    } else {
      params.delete("sortField");
      params.delete("sortDir");
    }
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (sortField) params.set("sortField", sortField);
      if (sortDir) params.set("sortDir", sortDir);
      if (tableState.filterValue !== "all") params.set("status", tableState.filterValue);
      if (userFilter !== "all") params.set("userId", userFilter);
      if (effectiveGroupBy) params.set("groupBy", effectiveGroupBy);
      if (tableState.debouncedSearch) params.set("search", tableState.debouncedSearch);
      for (const [key, val] of Object.entries(tableState.debouncedColumnSearch)) {
        if (val) params.set(`search[${key}]`, val);
      }
      const link = document.createElement("a");
      link.href = `/api/admin/export/orders?${params.toString()}`;
      link.setAttribute("download", `orders-export-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (_err) {
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  }, [
    sortField,
    sortDir,
    tableState.filterValue,
    tableState.debouncedSearch,
    tableState.debouncedColumnSearch,
    userFilter,
    effectiveGroupBy,
  ]);

  const queryClient = useQueryClient();
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.post("/api/admin/bulk/orders", { ids, action: "delete" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      toast.success("Orders deleted");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete orders");
    },
  });

  const hiddenColsStr = searchParams.get("cols");
  const columnVisibility: VisibilityState = useMemo(() => {
    if (!hiddenColsStr) return {};
    const hiddenCols = hiddenColsStr.split(",").filter(Boolean);
    const visibility: VisibilityState = {};
    for (const col of hiddenCols) {
      visibility[col] = false;
    }
    return visibility;
  }, [hiddenColsStr]);

  const onColumnVisibilityChange = (
    updater: VisibilityState | ((old: VisibilityState) => VisibilityState)
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
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const grouping = useMemo(() => {
    if (!effectiveGroupBy) return [];
    const mapping: Record<string, string> = {
      status: "status",
      user: "customer",
    };
    return mapping[effectiveGroupBy] ? [mapping[effectiveGroupBy]] : [];
  }, [effectiveGroupBy]);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [orderDetailOpen, setOrderDetailOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { data: ordersResponse, isLoading } = useAdminOrders({
    page: tableState.pagination.pageIndex + 1,
    limit: tableState.pagination.pageSize,
    statusFilter: tableState.filterValue === "all" ? "" : tableState.filterValue,
    userId: userFilter === "all" ? undefined : userFilter,
    sortField,
    sortDir,
    search: tableState.debouncedSearch,
    columnSearch: tableState.debouncedColumnSearch,
    showDeleted,
  });
  const orders = (ordersResponse?.data ?? []) as Order[];
  const pageCount = ordersResponse?.meta?.pages ?? 1;

  const { deleteMutation, restoreMutation } = useAdminOrderMutations();

  function handleViewCustomer(userId: string) {
    if (!userId) return;
    setSelectedUserId(userId);
    setDialogOpen(true);
  }

  const fetchUsers = async (search: string) => {
    const res = await api.get<AdminUser[]>("/api/admin/users", {
      params: { limit: 20, search },
    });
    const opts = (res.data ?? []).map((u) => ({ value: u._id, label: u.email }));
    if (!search) opts.unshift({ value: "all", label: "All users" });
    return opts;
  };

  const isDeleted = (row: Order) => !!row.deletedAt;

  const columns: ColumnDef<Order>[] = useMemo(
    () => [
      {
        id: "orderId",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Order #" />,
        accessorKey: "orderNumber",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <OrderNumberCell value={row.original.orderNumber} />
            {isDeleted(row.original) ? <Badge variant="secondary">Deleted</Badge> : null}
          </div>
        ),
      },
      {
        id: "customer",
        header: "Customer",
        cell: ({ row }) => {
          const userId = getOrderUserId(row.original.userId);
          if (!userId) return <span className="text-sm text-muted-foreground">—</span>;
          return (
            <button
              type="button"
              onClick={() => handleViewCustomer(userId)}
              className={`flex max-w-[220px] items-center gap-1.5 text-sm font-medium transition-colors hover:text-primary ${
                isDeleted(row.original) ? "text-muted-foreground line-through" : "text-foreground"
              }`}
              title="View customer details"
            >
              <User className="size-3.5 shrink-0" />
              <span className="truncate">
                {row.original.userFullName || row.original.userEmail || "Unknown"}
              </span>
            </button>
          );
        },
        getGroupingValue: (row) => row.userEmail ?? row.userFullName ?? "",
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => (
          <StatusBadge variant={statusVariantMap[row.original.status]} showIcon={false}>
            {row.original.status}
          </StatusBadge>
        ),
      },
      {
        accessorKey: "total",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
        cell: ({ row }) => <PriceCell value={row.original.total} />,
      },
      {
        id: "items",
        header: "Items",
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {row.original.itemCount ?? row.original.items?.length ?? 0}
          </span>
        ),
      },
      {
        id: "payment",
        header: "Payment",
        cell: ({ row }) => {
          const order = row.original;
          const provider = (order.provider ?? "unknown") as ProviderKey;
          const code = order.providerSessionId ?? order.metadata?.orderId ?? "";
          return (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <ProviderPill provider={provider} />
                <code className="font-mono text-xs text-muted-foreground">
                  {String(code).slice(0, 24)}
                </code>
              </div>
              {order.paidAt ? (
                <DateCell
                  value={order.paidAt}
                  variant="compact"
                  className="text-muted-foreground"
                />
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
        cell: ({ row }) => <DateCell value={row.original.createdAt} />,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Order actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isDeleted(row.original) ? (
                <DropdownMenuItem
                  onClick={() => {
                    restoreMutation.mutate(row.original._id, {
                      onSuccess: () => {
                        toast.success("Order restored");
                        setDeleteTarget(null);
                      },
                      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
                    });
                  }}
                >
                  <RefreshCw className="mr-2 size-4" />
                  Restore
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem
                    onClick={() => {
                      setSelectedOrderId(row.original._id);
                      setOrderDetailOpen(true);
                    }}
                  >
                    <User className="mr-2 size-4" />
                    View details
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleViewCustomer(getOrderUserId(row.original.userId) ?? "")}
                  >
                    <User className="mr-2 size-4" />
                    View customer
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteTarget(row.original._id)}
                  >
                    <Trash2 className="mr-2 size-4" />
                    Delete order
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [restoreMutation]
  );

  return (
    <PageShell title="Orders" description="View and manage customer orders.">
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card/40 p-3">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Order #
          </span>
          <Input
            value={tableState.columnSearch.orderNumber || ""}
            onChange={(e) => {
              tableState.onColumnSearchChange("orderNumber", e.target.value);
            }}
            placeholder="Number…"
            className="h-8 w-28"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Email
          </span>
          <Input
            value={tableState.columnSearch.userEmail || ""}
            onChange={(e) => {
              tableState.onColumnSearchChange("userEmail", e.target.value);
              tableState.setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
            placeholder="Customer email…"
            className="h-8 w-44"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            User
          </span>
          <AsyncCombobox
            value={userFilter}
            onValueChange={(value) => {
              tableState.setExtraFilterValue("user", value);
            }}
            queryKey="order-user"
            fetchOptions={fetchUsers}
            placeholder="All users"
            className="h-8 w-52"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Status
          </span>
          <Select
            value={tableState.filterValue}
            onValueChange={(value) => {
              tableState.setFilterValue(value);
            }}
          >
            <SelectTrigger className="h-8 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Group by
          </span>
          <GroupBySelect
            value={effectiveGroupBy}
            onValueChange={tableState.setGroupBy}
            options={[
              { value: "user", label: "Group by user" },
              { value: "status", label: "Group by status" },
            ]}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <ShowDeletedToggle
          id="show-deleted-orders"
          checked={showDeleted}
          onCheckedChange={setShowDeleted}
        />
      </div>

      <DataTable
        columns={columns}
        data={orders}
        rowClassName={(row) => (isDeleted(row as Order) ? "opacity-50" : "")}
        pageCount={pageCount}
        pagination={tableState.pagination}
        onPaginationChange={tableState.setPagination}
        isLoading={isLoading}
        searchValue={tableState.searchInput}
        onSearchChange={tableState.onSearchChange}
        searchPlaceholder="Search orders…"
        emptyTitle="No orders found"
        emptyDescription="Try adjusting your filters."
        manualSorting
        sorting={sorting}
        onSortingChange={onSortingChange}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={onColumnVisibilityChange}
        exportConfig={{
          onExport: handleExport,
          isExporting,
        }}
        enableRowSelection
        getRowId={(row: Order) => row._id}
        enableGrouping={!!effectiveGroupBy}
        grouping={grouping}
        bulkActions={[
          {
            label: "Delete",
            onClick: (ids) => bulkDeleteMutation.mutate(ids),
            variant: "destructive" as const,
          },
        ]}
      />

      <OrderDetailDialog
        open={orderDetailOpen}
        onOpenChange={setOrderDetailOpen}
        orderId={selectedOrderId}
        onViewCustomer={(userId) => {
          setSelectedUserId(userId);
          setDialogOpen(true);
        }}
      />

      <CustomerDialog open={dialogOpen} onOpenChange={setDialogOpen} userId={selectedUserId} />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete order"
        description="Are you sure you want to delete this order? This action cannot be undone."
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget, {
              onSuccess: () => {
                toast.success("Order deleted");
                setDeleteTarget(null);
              },
              onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
            });
          }
        }}
      />
    </PageShell>
  );
}
