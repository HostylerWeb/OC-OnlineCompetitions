"use client";

import {
  api,
  useAdminPromoCodeMutations,
  useAdminPromoCodes,
  useServerPagination,
} from "@oc/api-admin";
import { Filter, MoreHorizontal, Plus, RefreshCw, Trash2 } from "@oc/icons";
import type { AdminPromoCode } from "@oc/types";
import { ADMIN_PROMO_CODE_TABLE } from "@oc/types";
import { useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, SortingState, Updater, VisibilityState } from "@tanstack/react-table";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { AsyncCombobox } from "@/components/AsyncCombobox";
import { DateCell } from "@/components/admin/DateCell";
import { PriceCell } from "@/components/admin/PriceCell";
import { ShowDeletedToggle } from "@/components/admin/ShowDeletedToggle";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable, DataTableColumnHeader } from "@/components/DataTable";
import { DateTimePicker } from "@/components/DateTimePicker";
import { FormSheet } from "@/components/FormSheet";
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAdminTableURL } from "@/hooks/use-admin-table-url";
import { useTableSort } from "@/hooks/use-table-sort";
import { handleFormError } from "@/lib/handle-form-error";
import { createZodResolver } from "@/lib/zod-resolver";

const promoCodeSchema = z
  .object({
    code: z
      .string()
      .min(1, "Code is required")
      .max(50, "Code is too long")
      .transform((v) => v.trim().toUpperCase()),
    discountType: z.enum(["percentage", "fixed"]),
    discountValue: z.coerce.number().positive("Must be greater than 0"),
    minOrderValue: z.coerce.number().nonnegative().optional().or(z.literal("")),
    maxUses: z.coerce.number().int().nonnegative().optional().or(z.literal("")),
    maxUsesPerUser: z.coerce.number().int().positive().optional().or(z.literal("")),
    validFrom: z.string().optional().or(z.literal("")),
    validUntil: z.string().optional().or(z.literal("")),
    isActive: z.boolean(),
    guestEligible: z.boolean(),
    competitionId: z.string().optional().or(z.literal("")),
    minTickets: z.coerce.number().int().positive().optional().or(z.literal("")),
  })
  .refine(
    (v) => {
      if (v.validFrom && v.validUntil) {
        return new Date(v.validFrom) < new Date(v.validUntil);
      }
      return true;
    },
    { path: ["validUntil"], message: "Expiry must be after the start date" }
  );

type PromoFormValues = z.infer<typeof promoCodeSchema>;

function getDefaultDates() {
  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const until = new Date(from);
  until.setDate(until.getDate() + 1);
  return {
    validFrom: from.toISOString().slice(0, 16),
    validUntil: until.toISOString().slice(0, 16),
  };
}

const DEFAULT_FORM: PromoFormValues = {
  code: "",
  discountType: "percentage",
  discountValue: 0,
  minOrderValue: "",
  maxUses: "",
  maxUsesPerUser: "",
  validFrom: "",
  validUntil: "",
  isActive: true,
  guestEligible: true,
  competitionId: "",
  minTickets: "",
};

function formatDiscount(promo: AdminPromoCode) {
  if (promo.discountValue == null) return "—";
  return promo.discountType === "percentage"
    ? `${promo.discountValue}%`
    : `£${promo.discountValue.toFixed(2)}`;
}

export default function PromoCodesAdminPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const tableState = useAdminTableURL({
    columnSearchFields: [{ param: "code" }, { param: "discountType" }, { param: "isActive" }],
    defaultPageSize: 10,
  });
  const { groupBy, setGroupBy } = tableState;
  const { sortField, sortDir } = useTableSort("createdAt", "desc");

  const [isExporting, setIsExporting] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);

  const grouping = useMemo(() => {
    if (!groupBy || groupBy === "none") return [];
    const mapping: Record<string, string> = {
      discountType: "discountType",
      status: "isActive",
    };
    return mapping[groupBy] ? [mapping[groupBy]] : [];
  }, [groupBy]);

  const { data: promoCodesResponse, isLoading } = useAdminPromoCodes({
    page: tableState.pagination.pageIndex + 1,
    limit: tableState.pagination.pageSize,
    sortField,
    sortDir,
    search: tableState.debouncedSearch,
    columnSearch: tableState.debouncedColumnSearch,
    showDeleted,
  });
  const promoCodes = promoCodesResponse?.data ?? [];
  const { pageCount } = useServerPagination(promoCodesResponse?.meta);
  const { deleteMutation, createMutation, updateMutation, restoreMutation } =
    useAdminPromoCodeMutations();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminPromoCode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminPromoCode | null>(null);

  const sorting = useMemo<SortingState>(
    () => (sortField ? [{ id: sortField, desc: sortDir === "desc" }] : []),
    [sortField, sortDir]
  );

  const onSortingChange = useCallback(
    (updater: Updater<SortingState>) => {
      const current: SortingState = sortField ? [{ id: sortField, desc: sortDir === "desc" }] : [];
      const next = typeof updater === "function" ? updater(current) : updater;
      const params = new URLSearchParams(searchParams.toString());
      if (next.length > 0) {
        params.set("sortField", next[0].id);
        params.set("sortDir", next[0].desc ? "desc" : "asc");
      } else {
        params.delete("sortField");
        params.delete("sortDir");
      }
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [sortField, sortDir, searchParams, router, pathname]
  );

  const columnVisibility = useMemo<VisibilityState>(() => {
    const cols = searchParams.get("cols");
    if (!cols) return {};
    const hidden: VisibilityState = {};
    for (const c of cols.split(",")) {
      hidden[c] = false;
    }
    return hidden;
  }, [searchParams]);

  const onColumnVisibilityChange = useCallback(
    (updater: Updater<VisibilityState>) => {
      const next = typeof updater === "function" ? updater(columnVisibility) : updater;
      const params = new URLSearchParams(searchParams.toString());
      const hidden = Object.entries(next)
        .filter(([, v]) => v === false)
        .map(([k]) => k);
      if (hidden.length > 0) params.set("cols", hidden.join(","));
      else params.delete("cols");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [columnVisibility, searchParams, router, pathname]
  );

  const handleExport = useCallback(() => {
    setIsExporting(true);
    const params = new URLSearchParams();
    if (tableState.debouncedSearch) params.set("search", tableState.debouncedSearch);
    window.open(`/api/admin/export/promo-codes?${params.toString()}`, "_blank");
    setTimeout(() => setIsExporting(false), 1000);
  }, [tableState.debouncedSearch]);

  const handleBulkAction = useCallback(
    async (action: string, ids: string[]) => {
      try {
        const res = await api.post<{ count: number }>("/api/admin/bulk/promo-codes", {
          ids,
          action,
        });
        toast.success(
          `${res.data.count} promo code(s) ${action === "delete" ? "deleted" : action === "activate" ? "activated" : "deactivated"}`
        );
        queryClient.invalidateQueries({ queryKey: ["admin", "promo-codes"] });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Bulk action failed");
      }
    },
    [queryClient]
  );

  const form = useForm<PromoFormValues>({
    resolver: createZodResolver(promoCodeSchema),
    defaultValues: DEFAULT_FORM,
  });

  useEffect(() => {
    if (editing) {
      setError(null);
      form.reset({
        code: editing.code,
        discountType: editing.discountType,
        discountValue: editing.discountValue ?? 0,
        minOrderValue: editing.minOrderValue ?? "",
        maxUses: editing.maxUses ?? "",
        maxUsesPerUser: editing.maxUsesPerUser ?? "",
        validFrom: editing.validFrom ? new Date(editing.validFrom).toISOString().slice(0, 16) : "",
        validUntil: editing.validUntil
          ? new Date(editing.validUntil).toISOString().slice(0, 16)
          : "",
        isActive: editing.isActive,
        guestEligible: editing.guestEligible ?? true,
        competitionId: editing.competitionId ?? "",
        minTickets: editing.minTickets ?? "",
      });
    } else if (sheetOpen) {
      setError(null);
      const dates = getDefaultDates();
      form.reset({
        ...DEFAULT_FORM,
        validFrom: dates.validFrom,
        validUntil: dates.validUntil,
      });
    }
  }, [editing, sheetOpen, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const payload = {
      code: values.code,
      discountType: values.discountType,
      discountValue: values.discountValue,
      minOrderValue:
        typeof values.minOrderValue === "number" && values.minOrderValue > 0
          ? values.minOrderValue
          : undefined,
      maxUses:
        typeof values.maxUses === "number" && values.maxUses > 0 ? values.maxUses : undefined,
      maxUsesPerUser:
        typeof values.maxUsesPerUser === "number" && values.maxUsesPerUser > 0
          ? values.maxUsesPerUser
          : undefined,
      validFrom: values.validFrom ? new Date(values.validFrom) : undefined,
      validUntil: values.validUntil ? new Date(values.validUntil) : undefined,
      isActive: values.isActive,
      guestEligible: values.guestEligible,
      competitionId: values.competitionId || undefined,
      minTickets:
        typeof values.minTickets === "number" && values.minTickets > 0
          ? values.minTickets
          : undefined,
    };
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing._id, payload });
        toast.success("Promo code updated");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Promo code created");
      }
      setSheetOpen(false);
      setEditing(null);
    } catch (err: unknown) {
      const msg = handleFormError(form, err);
      if (msg) toast.error(msg);
      if (!msg) toast.error("Please check the highlighted fields");
    }
  });

  const isDeleted = (row: AdminPromoCode) =>
    !!(row as unknown as { deletedAt?: unknown }).deletedAt;

  const columns: ColumnDef<AdminPromoCode>[] = useMemo(
    () => [
      {
        accessorKey: "code",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <code className="rounded bg-muted/50 px-2 py-0.5 font-mono text-sm text-primary">
              {row.original.code}
            </code>
            {isDeleted(row.original) ? <Badge variant="secondary">Deleted</Badge> : null}
          </div>
        ),
      },
      {
        accessorKey: "discountType",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
        cell: ({ row }) => <span className="capitalize text-sm">{row.original.discountType}</span>,
      },
      {
        id: "discount",
        header: "Value",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm font-medium tabular-nums">{formatDiscount(row.original)}</span>
        ),
      },
      {
        accessorKey: "minOrderValue",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Min Order" />,
        cell: ({ row }) =>
          row.original.minOrderValue ? (
            <PriceCell value={row.original.minOrderValue} size="sm" />
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "usage",
        header: "Usage",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground tabular-nums">
            {row.original.maxUses != null
              ? `${row.original.currentUses}/${row.original.maxUses}`
              : row.original.currentUses}
          </span>
        ),
      },
      {
        id: "competition",
        header: "Competition",
        enableSorting: false,
        cell: ({ row }) => {
          const compId = row.original.competitionId;
          const minTickets = row.original.minTickets;
          return (
            <div className="flex flex-col gap-0.5">
              <span className="text-sm">
                {compId ? (
                  <span className="text-muted-foreground italic">Competition-specific</span>
                ) : (
                  <span className="text-muted-foreground">Global</span>
                )}
              </span>
              {minTickets ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  Min {minTickets} ticket{minTickets !== 1 ? "s" : ""}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "validUntil",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Expires" />,
        cell: ({ row }) =>
          row.original.validUntil ? (
            <DateCell value={row.original.validUntil} />
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "isActive",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => (
          <StatusBadge variant={row.original.isActive ? "active" : "draft"} showIcon={false}>
            {row.original.isActive ? "Active" : "Inactive"}
          </StatusBadge>
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
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
                        toast.success("Promo code restored");
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
                      setEditing(row.original);
                      setSheetOpen(true);
                    }}
                  >
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteTarget(row.original)}
                  >
                    <Trash2 className="mr-2 size-4" />
                    Delete
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
    <PageShell
      title="Promo Codes"
      description="Manage discount codes and promotional offers."
      actions={
        <Button
          onClick={() => {
            setEditing(null);
            setSheetOpen(true);
          }}
        >
          <Plus className="size-4" />
          New promo code
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={promoCodes}
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
        searchPlaceholder="Search promo codes…"
        emptyTitle="No promo codes"
        emptyDescription="Create your first promo code to get started."
        enableRowSelection
        enableGrouping={!!groupBy && groupBy !== "none"}
        grouping={grouping}
        rowClassName={(row) => (isDeleted(row as AdminPromoCode) ? "opacity-50" : "")}
        bulkActions={[
          { label: "Activate", onClick: (ids) => handleBulkAction("activate", ids) },
          { label: "Deactivate", onClick: (ids) => handleBulkAction("deactivate", ids) },
          {
            label: "Delete",
            onClick: (ids) => handleBulkAction("delete", ids),
            variant: "destructive",
          },
        ]}
        getRowId={(row) => row._id}
        exportConfig={{
          onExport: handleExport,
          isExporting,
          label: "Export CSV",
        }}
        toolbar={
          <div className="flex items-center gap-2">
            <ShowDeletedToggle
              id="show-deleted-promo-codes"
              checked={showDeleted}
              onCheckedChange={setShowDeleted}
            />
            <Select
              value={groupBy || "none"}
              onValueChange={(value) => setGroupBy(value === "none" ? undefined : value)}
            >
              <SelectTrigger className="h-9 w-[180px]">
                <Filter />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No grouping</SelectItem>
                {ADMIN_PROMO_CODE_TABLE.groupByOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <FormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setEditing(null);
        }}
        title={editing ? "Edit promo code" : "New promo code"}
        description="Create or edit a promotional discount code."
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        error={error}
        size="wide"
      >
        <Form {...form}>
          <div className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="SAVE20" />
                  </FormControl>
                  <FormDescription>Uppercase, no spaces.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="discountType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed">Fixed amount</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discountValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Value</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="minOrderValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min order</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Optional"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxUses"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usage limit</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="Unlimited"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxUsesPerUser"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Uses per customer</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Default 1"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormDescription>Leave empty for default (1 use per account).</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="validFrom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valid from</FormLabel>
                    <FormControl>
                      <DateTimePicker
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="Pick start date and time"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="validUntil"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expires at</FormLabel>
                    <FormControl>
                      <DateTimePicker
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="Pick expiry date and time"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex flex-col gap-0.5">
                    <FormLabel className="cursor-pointer">Active</FormLabel>
                    <FormDescription>Inactive codes cannot be redeemed.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="guestEligible"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex flex-col gap-0.5">
                    <FormLabel className="cursor-pointer">Available for guest checkout</FormLabel>
                    <FormDescription>
                      When disabled, guest users at checkout will see this discount as unavailable.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Competition scope */}
            <FormField
              control={form.control}
              name="competitionId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Competition (optional)</FormLabel>
                  <FormControl>
                    <AsyncCombobox
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      queryKey="promo-code-competition"
                      clearable
                      icon={
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          className="size-4"
                          aria-hidden="true"
                        >
                          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 9 6.5 12 9c3-2.5 5-5 7.5-5a2.5 2.5 0 0 1 0 5H18" />
                          <path d="M12 9v12" />
                          <path d="M8 15h8" />
                        </svg>
                      }
                      fetchOptions={async (search) => {
                        const res = await api.get<
                          { _id: string; title: string; slug?: string; status?: string }[]
                        >("/api/admin/competitions", { params: { limit: 20, search } });
                        return (res.data ?? []).map((c) => ({
                          value: c._id,
                          label: c.title,
                          description: c.slug,
                          badge: c.status
                            ? {
                                label: c.status === "pending_draw" ? "draw" : c.status,
                                variant:
                                  c.status === "active"
                                    ? "success"
                                    : c.status === "drawn" || c.status === "cancelled"
                                      ? "muted"
                                      : "warning",
                              }
                            : undefined,
                        }));
                      }}
                      placeholder="All competitions (global)"
                      resolveLabel={async (value) => {
                        try {
                          const res = await api.get<{ title: string; status?: string }>(
                            `/api/admin/competitions/${value}`
                          );
                          return res.data.title;
                        } catch {
                          return null;
                        }
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Leave empty to make this promo code valid for all competitions.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="minTickets"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Minimum tickets</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="No minimum"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    Minimum number of tickets required in the cart to use this code.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Form>
      </FormSheet>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete promo code"
        description={
          <>
            Delete <strong>{deleteTarget?.code}</strong>? This action cannot be undone.
          </>
        }
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget._id, {
              onSuccess: () => {
                toast.success("Promo code deleted");
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
