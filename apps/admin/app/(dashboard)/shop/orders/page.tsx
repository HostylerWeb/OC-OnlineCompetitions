"use client";

import {
  ApiResponseError,
  useAdminShopOrder,
  useAdminShopOrderMutations,
  useAdminShopOrders,
  useServerPagination,
} from "@oc/api-admin";
import { MoreHorizontal, User } from "@oc/icons";
import { formatOrderNumber, OrderNumberCell } from "@oc/utils";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { DateCell } from "@/components/admin/DateCell";
import { PriceCell } from "@/components/admin/PriceCell";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { CustomerDialog } from "@/components/CustomerDialog";
import { DataTable, DataTableColumnHeader } from "@/components/DataTable";
import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

interface ShopOrderRow {
  _id: string;
  orderNumber: number;
  userId?: string;
  email?: string;
  status: string;
  isGuestCheckout?: boolean;
  items?: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    productSnapshot?: { name: string; sku: string; price: number };
  }>;
  subtotal: number;
  total: number;
  shippingAddress?: {
    firstName: string;
    lastName: string;
    addressLine1: string;
    city: string;
    postcode: string;
    country: string;
  };
  provider?: string;
  paidAt?: string;
  createdAt: string;
  notes?: string;
}

const statusVariants: Record<string, "warning" | "info" | "success" | "error" | "draft"> = {
  pending: "warning",
  paid: "info",
  processing: "warning",
  shipped: "info",
  delivered: "success",
  cancelled: "error",
  refunded: "draft",
};

const statusOptions = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

function ProviderPill({ provider }: { provider?: string }) {
  if (!provider || provider === "unknown") {
    return <span className="text-sm text-muted-foreground">--</span>;
  }
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {provider}
    </span>
  );
}

export default function ShopOrdersAdminPage() {
  const tableState = useAdminTableURL({
    filterParam: "status",
    columnSearchFields: [{ param: "orderNumber" }, { param: "email" }],
    defaultPageSize: 10,
  });

  const { sortField, sortDir, toggleSort, resetSort } = useTableSort("createdAt", "desc");

  const sorting: SortingState = sortField ? [{ id: sortField, desc: sortDir === "desc" }] : [];

  const { data: ordersResponse, isLoading } = useAdminShopOrders({
    page: tableState.pagination.pageIndex + 1,
    limit: tableState.pagination.pageSize,
    statusFilter: tableState.filterValue === "all" ? "" : tableState.filterValue,
    sortField,
    sortDir,
    search: tableState.debouncedSearch,
  });

  const orders = (ordersResponse?.data ?? []) as unknown as ShopOrderRow[];
  const { pageCount } = useServerPagination(ordersResponse?.meta);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderDetailOpen, setOrderDetailOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);

  function handleViewCustomer(userId: string | undefined) {
    if (!userId) return;
    setSelectedUserId(userId);
    setCustomerDialogOpen(true);
  }

  const columns: ColumnDef<ShopOrderRow>[] = useMemo(
    () => [
      {
        accessorKey: "orderNumber",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Order #" />,
        cell: ({ row }) => <OrderNumberCell value={row.original.orderNumber} />,
      },
      {
        id: "customer",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
        accessorKey: "email",
        cell: ({ row }) => (
          <span className="max-w-[200px] truncate text-sm">{row.original.email || "--"}</span>
        ),
      },
      {
        id: "items",
        header: "Items",
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">{row.original.items?.length ?? 0}</span>
        ),
      },
      {
        accessorKey: "total",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
        cell: ({ row }) => <PriceCell value={row.original.total} />,
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => (
          <StatusBadge variant={statusVariants[row.original.status] ?? "draft"}>
            {row.original.status}
          </StatusBadge>
        ),
      },
      {
        id: "provider",
        header: "Provider",
        cell: ({ row }) => <ProviderPill provider={row.original.provider} />,
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
              <DropdownMenuItem
                onClick={() => {
                  setSelectedOrderId(row.original._id);
                  setOrderDetailOpen(true);
                }}
                data-umami-event="shop-order:view-details"
              >
                View details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleViewCustomer(row.original.userId)}
                data-umami-event="shop-order:view-customer"
              >
                <User className="mr-2 size-4" />
                View customer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    []
  );

  return (
    <PageShell title="Shop Orders" description="View and manage shop orders.">
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card/40 p-3">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Order #
          </span>
          <input
            value={tableState.columnSearch.orderNumber || ""}
            onChange={(e) => {
              tableState.onColumnSearchChange("orderNumber", e.target.value);
            }}
            placeholder="Number..."
            className="h-8 w-28 rounded-md border border-input bg-background px-2 text-sm"
            data-umami-event="shop-order:search-order-number"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Email
          </span>
          <input
            value={tableState.columnSearch.email || ""}
            onChange={(e) => {
              tableState.onColumnSearchChange("email", e.target.value);
              tableState.setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
            placeholder="Customer email..."
            className="h-8 w-44 rounded-md border border-input bg-background px-2 text-sm"
            data-umami-event="shop-order:search-email"
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
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={orders}
        pageCount={pageCount}
        pagination={tableState.pagination}
        onPaginationChange={tableState.setPagination}
        isLoading={isLoading}
        searchValue={tableState.searchInput}
        onSearchChange={tableState.onSearchChange}
        searchPlaceholder="Search orders..."
        emptyTitle="No shop orders found"
        emptyDescription="Try adjusting your filters."
        manualSorting
        sorting={sorting}
        onSortingChange={(updaterOrValue) => {
          const newSorting =
            typeof updaterOrValue === "function" ? updaterOrValue(sorting) : updaterOrValue;
          if (newSorting.length > 0) {
            toggleSort(newSorting[0].id);
          } else {
            resetSort();
          }
        }}
        getRowId={(row: ShopOrderRow) => row._id}
      />

      <ShopOrderDetailDialog
        open={orderDetailOpen}
        onOpenChange={setOrderDetailOpen}
        orderId={selectedOrderId}
        onViewCustomer={(userId) => {
          setSelectedUserId(userId);
          setCustomerDialogOpen(true);
        }}
      />

      <CustomerDialog
        open={customerDialogOpen}
        onOpenChange={setCustomerDialogOpen}
        userId={selectedUserId}
      />
    </PageShell>
  );
}

function ShopOrderDetailDialog({
  open,
  onOpenChange,
  orderId,
  onViewCustomer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
  onViewCustomer?: (userId: string) => void;
}) {
  const { data: orderRes, isLoading, refetch } = useAdminShopOrder(orderId ?? "");
  const order = orderRes?.data as ShopOrderRow | undefined;
  const { updateStatusMutation } = useAdminShopOrderMutations();

  const [changingStatus, setChangingStatus] = useState(false);

  const orderUserId = order?.userId;
  const hasCustomerTrigger = !!orderUserId && !!onViewCustomer;

  if (!open) return null;

  const handleStatusChange = (newStatus: string) => {
    if (!orderId || newStatus === order?.status) return;
    setChangingStatus(true);
    updateStatusMutation.mutate(
      { id: orderId, status: newStatus },
      {
        onSuccess: () => {
          toast.success(`Order status changed to ${newStatus}`);
          refetch();
          setChangingStatus(false);
        },
        onError: (err) => {
          if (err instanceof ApiResponseError) {
            toast.error(err.message);
          } else {
            toast.error(err instanceof Error ? err.message : "Failed to update status");
          }
          setChangingStatus(false);
        },
      }
    );
  };

  const items = order?.items ?? [];
  const subtotal = items.reduce(
    (sum, item) => sum + (item.productSnapshot?.price ?? item.unitPrice) * item.quantity,
    0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid-rows-[auto_minmax(0,1fr)_auto]">
        <DialogHeader>
          {isLoading ? (
            <DialogTitle>Loading order...</DialogTitle>
          ) : order ? (
            <DialogTitle className="flex items-center gap-3">
              Order {formatOrderNumber(order.orderNumber)}
              <StatusBadge variant={statusVariants[order.status] ?? "draft"}>
                {order.status}
              </StatusBadge>
            </DialogTitle>
          ) : (
            <DialogTitle>Order not found</DialogTitle>
          )}
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col gap-4 px-1 py-2">
              <div className="h-6 w-36 animate-pulse rounded bg-muted" />
              <div className="h-16 w-full animate-pulse rounded-lg bg-muted" />
              <div className="h-40 w-full animate-pulse rounded-lg bg-muted" />
            </div>
          ) : !order ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <p className="text-sm text-muted-foreground">Order not found.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6 px-1 py-2">
              {/* Header bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                {hasCustomerTrigger ? (
                  <button
                    type="button"
                    onClick={() => onViewCustomer(orderUserId!)}
                    className="group flex flex-col gap-0.5 text-left"
                    title="View customer details"
                  >
                    <span className="text-xs text-muted-foreground">Customer</span>
                    <span className="flex items-center gap-1.5 font-medium transition-colors group-hover:text-primary">
                      <User className="size-3.5 shrink-0" />
                      {order.email || "--"}
                    </span>
                    {order.isGuestCheckout ? (
                      <Badge variant="outline" className="w-fit text-[10px]">
                        Guest
                      </Badge>
                    ) : null}
                  </button>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Customer</span>
                    <span className="font-medium">{order.email || "--"}</span>
                    {order.isGuestCheckout ? (
                      <Badge variant="outline" className="w-fit text-[10px]">
                        Guest
                      </Badge>
                    ) : null}
                  </div>
                )}
                <div className="flex flex-col gap-0.5 text-right">
                  <span className="text-xs text-muted-foreground">Total</span>
                  <span className="text-lg font-semibold">
                    <PriceCell value={order.total} />
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 text-right">
                  <span className="text-xs text-muted-foreground">Date</span>
                  <span className="whitespace-nowrap">
                    <DateCell value={order.createdAt} variant="compact" />
                  </span>
                </div>
              </div>

              {/* Status change */}
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Status
                </span>
                <Select
                  value={order.status}
                  onValueChange={handleStatusChange}
                  disabled={changingStatus}
                >
                  <SelectTrigger className="h-8 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        <span className="capitalize">{s}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Line Items */}
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Items ({items.length})
                </h4>
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No items.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {items.map((item, idx) => {
                      const name = item.productSnapshot?.name ?? `Product (${item.productId})`;
                      const unitPrice = item.productSnapshot?.price ?? item.unitPrice;
                      const lineTotal = unitPrice * item.quantity;
                      return (
                        <div key={idx} className="rounded-lg border px-4 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="truncate text-sm font-medium">{name}</span>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span>Qty: {item.quantity}</span>
                                <span>
                                  <PriceCell value={unitPrice} size="sm" /> ea
                                </span>
                                <span className="font-medium text-foreground">
                                  <PriceCell value={lineTotal} size="sm" />
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Pricing */}
              <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-right font-medium">
                    <PriceCell value={subtotal} />
                  </span>
                  <span className="text-muted-foreground">Total</span>
                  <span className="text-right font-semibold">
                    <PriceCell value={order.total} />
                  </span>
                </div>
              </div>

              {/* Payment Provider */}
              {order.provider ? (
                <div className="flex flex-col gap-2">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Payment
                  </h4>
                  <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      <span className="text-muted-foreground">Provider</span>
                      <span className="text-right font-medium capitalize">{order.provider}</span>
                      {order.paidAt ? (
                        <>
                          <span className="text-muted-foreground">Paid at</span>
                          <span className="text-right">
                            <DateCell value={order.paidAt} variant="compact" />
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Shipping Address */}
              {order.shippingAddress ? (
                <div className="flex flex-col gap-2">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Shipping Address
                  </h4>
                  <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                    <p>
                      {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                    </p>
                    <p className="text-muted-foreground">{order.shippingAddress.addressLine1}</p>
                    <p className="text-muted-foreground">
                      {order.shippingAddress.city}, {order.shippingAddress.postcode}
                    </p>
                    <p className="text-muted-foreground">{order.shippingAddress.country}</p>
                  </div>
                </div>
              ) : null}

              {/* Order Notes */}
              {order.notes ? (
                <div className="flex flex-col gap-2">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Notes
                  </h4>
                  <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                    <p className="text-muted-foreground">{order.notes}</p>
                  </div>
                </div>
              ) : null}

              {/* Created date */}
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Order Details
                </h4>
                <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    <span className="text-muted-foreground">Created</span>
                    <span className="text-right">
                      <DateCell value={order.createdAt} variant="compact" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
