"use client";

import {
  useAdminReferralMutations,
  useAdminReferralSettings,
  useAdminReferrals,
  useAdminUserReferralMutation,
  useServerPagination,
} from "@oc/api-admin";
import {
  Info,
  Link2,
  MoreHorizontal,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  User,
  UserCheck,
  Users,
} from "@oc/icons";
import * as Sentry from "@sentry/react";
import type { ColumnDef, SortingState, VisibilityState } from "@tanstack/react-table";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { DateCell } from "@/components/admin/DateCell";
import { ShowDeletedToggle } from "@/components/admin/ShowDeletedToggle";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CustomerDialog } from "@/components/CustomerDialog";
import { DataTable, DataTableColumnHeader } from "@/components/DataTable";
import { FormSheet } from "@/components/FormSheet";
import { PageShell } from "@/components/PageShell";
import { StatCard } from "@/components/StatCard";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAdminTableURL } from "@/hooks/use-admin-table-url";
import { useTableSort } from "@/hooks/use-table-sort";
import { handleFormError } from "@/lib/handle-form-error";
import { createZodResolver } from "@/lib/zod-resolver";
import {
  ReferralSummaryCards,
  TierDistributionWidget,
  TopReferrersWidget,
} from "./_components/ReferralInsights";
import { ReferralSettingsSheet } from "./_components/ReferralSettingsSheet";
import { TestWithUserDrawer } from "./_components/TestWithUserDrawer";

function _HelpTooltip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
        >
          <Info className="size-3.5" />
          <span className="sr-only">Help</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-72 text-xs">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

interface ReferralItem {
  _id: string;
  referrerId: string;
  referrerEmail: string;
  referredUserId: string;
  referredEmail: string;
  isActive?: boolean;
  commissionAmount: number;
  ticketsAwarded?: number;
  createdAt: string;
  deletedAt?: string | null;
  latestDeletedAt?: string | null;
  activePurchaseCount?: number;
  signupReferrerEmail?: string;
  referrerReferralCount?: number;
  referrerReferralCode?: string | null;
  purchaseCount?: number;
  referralPurchaseIds?: string[];
  referrerActiveCount?: number;
  referrerInactiveCount?: number;
  referrerTotalCount?: number;
}

const reassignSchema = z.object({
  referralCode: z.string().optional(),
  action: z.enum(["set", "clear"], { message: "Select an action" }).default("set"),
});
type ReassignFormValues = z.infer<typeof reassignSchema>;

export default function ReferralsAdminPage() {
  const [error, setError] = useState<string | null>(null);
  const tableState = useAdminTableURL({
    extraFilters: [{ param: "status", defaultValue: "all" }],
    columnSearchFields: [{ param: "referrerEmail" }, { param: "referredEmail" }],
    defaultPageSize: 10,
  });
  const statusFilter = tableState.extraFilterValues.status ?? "all";
  const { sortField, sortDir } = useTableSort("createdAt", "desc");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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

  const [selectedReferrerId, setSelectedReferrerId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [referredDialogOpen, setReferredDialogOpen] = useState(false);
  const [selectedReferredId, setSelectedReferredId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [testDrawerOpen, setTestDrawerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReferralItem | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [reassignTarget, setReassignTarget] = useState<ReferralItem | null>(null);

  const { data: referralsResponse, isLoading } = useAdminReferrals({
    page: tableState.pagination.pageIndex + 1,
    limit: tableState.pagination.pageSize,
    status: statusFilter === "all" ? undefined : statusFilter,
    sortField,
    sortDir,
    search: tableState.debouncedSearch,
    columnSearch: tableState.debouncedColumnSearch,
    showDeleted,
  });
  const referrals = (referralsResponse?.data ?? []) as ReferralItem[];
  const { pageCount } = useServerPagination(referralsResponse?.meta);
  const referralSummary = (referralsResponse as any)?.meta?.summary as
    | { activeCount: number; inactiveCount: number; totalCount: number }
    | undefined;
  const activeTotal = referralSummary?.activeCount ?? 0;
  const inactiveTotal = referralSummary?.inactiveCount ?? 0;

  const handleExport = useCallback(() => {
    const headers = [
      "Referrer Email",
      "Referred Email",
      "Status",
      "Active Referrals",
      "Inactive Referrals",
      "Total Referrals",
      "Tickets",
      "Purchases",
      "Referral Code",
      "Date",
    ];
    const rows = referrals.map((r) => [
      r.referrerEmail,
      r.referredEmail,
      r.isActive ? "Active" : "Inactive",
      String(r.referrerActiveCount ?? 0),
      String(r.referrerInactiveCount ?? 0),
      String(r.referrerTotalCount ?? 0),
      String(r.ticketsAwarded ?? 0),
      String(r.purchaseCount ?? 1),
      r.referrerReferralCode ?? "",
      r.createdAt ? new Date(r.createdAt).toISOString() : "",
    ]);
    const csv = [
      headers.map((h) => `"${h}"`).join(","),
      ...rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `referrals-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [referrals]);

  const { data: settingsResponse } = useAdminReferralSettings();
  const settingsData = settingsResponse?.data;
  const { deleteMutation, restoreMutation, saveSettingsMutation } = useAdminReferralMutations();
  const reassignMutation = useAdminUserReferralMutation();

  const reassignForm = useForm<ReassignFormValues>({
    resolver: createZodResolver(reassignSchema),
    defaultValues: { referralCode: "", action: "set" },
  });

  const handleSettingsOpenChange = useCallback((open: boolean) => {
    setSettingsOpen(open);
  }, []);

  const handleViewReferrer = useCallback((referrerId: string) => {
    setSelectedReferrerId(referrerId);
    setDialogOpen(true);
  }, []);

  const handleViewReferred = useCallback((userId: string) => {
    setSelectedReferredId(userId);
    setReferredDialogOpen(true);
  }, []);

  const isDeleted = (row: ReferralItem) => {
    if (row.activePurchaseCount !== undefined) {
      return row.activePurchaseCount === 0;
    }
    return !!row.deletedAt;
  };

  const columns: ColumnDef<ReferralItem>[] = useMemo(
    () => [
      {
        accessorKey: "referrerEmail",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Checkout referrer" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleViewReferrer(row.original.referrerId)}
              className={`flex max-w-[200px] items-center gap-1.5 text-sm font-medium transition-colors hover:text-primary ${
                isDeleted(row.original) ? "text-muted-foreground line-through" : "text-foreground"
              }`}
            >
              <User className="size-3.5 shrink-0" />
              <span className="truncate">{row.original.referrerEmail}</span>
            </button>
            {isDeleted(row.original) ? <Badge variant="secondary">Deleted</Badge> : null}
          </div>
        ),
      },
      {
        accessorKey: "signupReferrerEmail",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Signup referrer" />,
        cell: ({ row }) => {
          const signup = row.original.signupReferrerEmail;
          if (!signup || signup === row.original.referrerEmail)
            return <span className="text-muted-foreground text-xs">—</span>;
          return (
            <span
              className="flex max-w-[200px] items-center gap-1.5 text-sm text-muted-foreground"
              title={`Originally referred by ${signup} at sign-up — differs from checkout referrer`}
            >
              <Link2 className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{signup}</span>
            </span>
          );
        },
      },
      {
        accessorKey: "referrerActiveCount",
        header: ({ column }) => (
          <span className="inline-flex items-center gap-1">
            <DataTableColumnHeader column={column} title="Active" />
            <_HelpTooltip>
              Unique referred users (for this referrer) whose latest purchase qualifies as active.
              Same formula as the user dashboard leaderboard.
            </_HelpTooltip>
          </span>
        ),
        cell: ({ row }) => (
          <span className="tabular-nums text-sm text-success">
            {row.original.referrerActiveCount ?? 0}
          </span>
        ),
      },
      {
        accessorKey: "referrerInactiveCount",
        header: ({ column }) => (
          <span className="inline-flex items-center gap-1">
            <DataTableColumnHeader column={column} title="Inactive" />
            <_HelpTooltip>
              Unique referred users (for this referrer) whose latest purchase is outside the
              activity window or below the minimum spend.
            </_HelpTooltip>
          </span>
        ),
        cell: ({ row }) => (
          <span className="tabular-nums text-sm text-muted-foreground">
            {row.original.referrerInactiveCount ?? 0}
          </span>
        ),
      },
      {
        accessorKey: "referrerTotalCount",
        header: ({ column }) => (
          <span className="inline-flex items-center gap-1">
            <DataTableColumnHeader column={column} title="Total" />
            <_HelpTooltip>
              Total unique referred users (active + inactive) for this referrer.
            </_HelpTooltip>
          </span>
        ),
        cell: ({ row }) => (
          <span className="tabular-nums text-sm">{row.original.referrerTotalCount ?? 0}</span>
        ),
      },
      {
        accessorKey: "referredEmail",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Referred user" />,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => handleViewReferred(row.original.referredUserId)}
            className={`flex max-w-[200px] items-center gap-1.5 text-sm font-medium transition-colors hover:text-primary ${
              isDeleted(row.original) ? "text-muted-foreground line-through" : "text-foreground"
            }`}
          >
            <User className="size-3.5 shrink-0" />
            <span className="truncate">{row.original.referredEmail}</span>
          </button>
        ),
      },
      {
        accessorKey: "referrerReferralCode",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Referral code" />,
        cell: ({ row }) => (
          <span
            className="font-mono text-sm"
            title={`Referrer code: ${row.original.referrerReferralCode ?? "N/A"}`}
          >
            {row.original.referrerReferralCode ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "purchaseCount",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Purchases" />,
        cell: ({ row }) => (
          <span
            className="tabular-nums text-sm"
            title={`${row.original.purchaseCount ?? 1} total purchases by this referred user`}
          >
            {row.original.purchaseCount ?? 1}
          </span>
        ),
      },
      {
        accessorKey: "isActive",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => (
          <StatusBadge variant={row.original.isActive ? "success" : "draft"} showIcon={false}>
            {row.original.isActive ? "Active" : "Inactive"}
          </StatusBadge>
        ),
      },
      {
        accessorKey: "ticketsAwarded",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Tickets" />,
        cell: ({ row }) => (
          <span className="tabular-nums text-sm">{row.original.ticketsAwarded ?? 0}</span>
        ),
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
              <Button variant="ghost" size="icon-sm" aria-label="Actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setReassignTarget(row.original)}
                data-umami-event="referral:reassign"
              >
                <RefreshCw className="mr-2 size-4" />
                Reassign referral
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {isDeleted(row.original) ? (
                <DropdownMenuItem
                  onClick={async () => {
                    const ids =
                      row.original.referralPurchaseIds &&
                      row.original.referralPurchaseIds.length > 0
                        ? row.original.referralPurchaseIds
                        : [row.original._id];
                    try {
                      for (const id of ids) {
                        await restoreMutation.mutateAsync(id);
                      }
                      toast.success("Referral restored");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed");
                    }
                  }}
                  data-umami-event="referral:row-restore"
                >
                  <RefreshCw className="mr-2 size-4" />
                  Restore
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteTarget(row.original)}
                  data-umami-event="referral:row-delete"
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [handleViewReferrer, handleViewReferred, restoreMutation]
  );

  return (
    <PageShell
      title="Referrals"
      description="Manage referral program settings and tier awards."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setTestDrawerOpen(true)}
            data-umami-event="referral:test-with-user"
          >
            <Search className="size-4" />
            Test with user
          </Button>
          <Button
            variant="outline"
            onClick={() => setSettingsOpen(true)}
            data-umami-event="referral:settings-open"
          >
            <Settings className="size-4" />
            Settings
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Active pairs"
          value={activeTotal.toLocaleString("en-GB")}
          icon={UserCheck}
          accent="primary"
          tooltip="Unique (referrer × referred) pairs whose latest purchase qualifies as active (within the activity window, ≥ minimum spend, not soft-deleted)."
        />
        <StatCard
          label="Inactive pairs"
          value={inactiveTotal.toLocaleString("en-GB")}
          icon={Users}
          accent="warning"
          tooltip="Unique (referrer × referred) pairs whose latest purchase falls outside the activity window, is below minimum spend, or has been soft-deleted."
        />
        <StatCard
          label="Total pairs"
          value={(activeTotal + inactiveTotal).toLocaleString("en-GB")}
          icon={Users}
          tooltip="Total unique (referrer × referred) pairs in the current filter view."
        />
      </div>

      <ReferralSummaryCards />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TierDistributionWidget />
        <TopReferrersWidget />
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card/40 p-3">
        <div className="flex flex-col gap-1">
          <span className="text-[11px font-semibold uppercase tracking-wide text-muted-foreground">
            Referrer email
          </span>
          <Input
            value={tableState.columnSearch.referrerEmail || ""}
            onChange={(e) => {
              tableState.onColumnSearchChange("referrerEmail", e.target.value);
              tableState.setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
            placeholder="Referrer email…"
            className="h-8 w-48"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px font-semibold uppercase tracking-wide text-muted-foreground">
            Referred email
          </span>
          <Input
            value={tableState.columnSearch.referredEmail || ""}
            onChange={(e) => {
              tableState.onColumnSearchChange("referredEmail", e.target.value);
              tableState.setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
            placeholder="Referred email…"
            className="h-8 w-48"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px font-semibold uppercase tracking-wide text-muted-foreground">
            Status
          </span>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              tableState.setExtraFilterValue("status", v);
              tableState.setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className="h-8 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <ShowDeletedToggle
          id="show-deleted-referrals"
          checked={showDeleted}
          onCheckedChange={setShowDeleted}
          umamiEvent="referral:show-deleted-toggle"
        />
      </div>

      <DataTable
        columns={columns}
        data={referrals}
        pageCount={pageCount}
        pagination={tableState.pagination}
        onPaginationChange={tableState.setPagination}
        isLoading={isLoading}
        searchValue={tableState.searchInput}
        onSearchChange={tableState.onSearchChange}
        searchPlaceholder="Search referrals…"
        emptyTitle="No referrals"
        emptyDescription="When users invite friends they'll appear here."
        manualSorting
        sorting={sorting}
        onSortingChange={handleSortingChange}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={handleColumnVisibilityChange}
        rowClassName={(row) => (isDeleted(row as ReferralItem) ? "opacity-50" : "")}
        exportConfig={{
          onExport: handleExport,
          label: "Export CSV",
        }}
      />

      <CustomerDialog open={dialogOpen} onOpenChange={setDialogOpen} userId={selectedReferrerId} />

      <CustomerDialog
        open={referredDialogOpen}
        onOpenChange={setReferredDialogOpen}
        userId={selectedReferredId}
      />

      <ReferralSettingsSheet
        open={settingsOpen}
        onOpenChange={handleSettingsOpenChange}
        initialData={settingsData as unknown as Record<string, unknown> | null}
        onSave={async (data) => {
          await new Promise<void>((resolve, reject) => {
            saveSettingsMutation.mutate(data as any, {
              onSuccess: () => {
                toast.success("Settings saved");
                setSettingsOpen(false);
                resolve();
              },
              onError: (err) => {
                toast.error(err instanceof Error ? err.message : "Failed to save");
                reject(err);
              },
            });
          });
        }}
      />

      <TestWithUserDrawer
        open={testDrawerOpen}
        onOpenChange={setTestDrawerOpen}
        settingsTiers={
          settingsData?.tiers as Array<{ threshold: number; tickets: number }> | undefined
        }
        calculusMethod={(settingsData as any)?.calculusMethod ?? "gross"}
      />

      <FormSheet
        open={reassignTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReassignTarget(null);
            setError(null);
          }
        }}
        title="Reassign referral"
        description={
          reassignTarget?.referredEmail ? `Update referral for ${reassignTarget.referredEmail}` : ""
        }
        onSubmit={reassignForm.handleSubmit(async (values) => {
          if (!reassignTarget) return;
          try {
            if (values.action === "clear") {
              await reassignMutation.mutateAsync({
                userId: reassignTarget.referredUserId,
                action: "clear",
              });
              toast.success("Referral cleared");
            } else if (values.referralCode) {
              await reassignMutation.mutateAsync({
                userId: reassignTarget.referredUserId,
                referralCode: values.referralCode,
              });
              toast.success("Referral reassigned");
            }
            setReassignTarget(null);
          } catch (err) {
            const msg = handleFormError(reassignForm, err);
            if (msg) setError(msg);
            if (!msg) toast.error("Please check the highlighted fields");
          }
        })}
        isSubmitting={reassignMutation.isPending}
        error={error}
        submitLabel="Save"
      >
        <Form {...reassignForm}>
          <FormField
            control={reassignForm.control}
            name="action"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Action</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="set">Set referral code</SelectItem>
                    <SelectItem value="clear">Clear referral</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {reassignForm.watch("action") === "set" && (
            <FormField
              control={reassignForm.control}
              name="referralCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New referral code</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter referral code..." {...field} />
                  </FormControl>
                  <FormDescription>
                    The referred user will be reassigned to this referral code.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </Form>
      </FormSheet>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete referral"
        description="This action cannot be undone."
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={async () => {
          if (deleteTarget) {
            try {
              const ids =
                deleteTarget.referralPurchaseIds && deleteTarget.referralPurchaseIds.length > 0
                  ? deleteTarget.referralPurchaseIds
                  : [deleteTarget._id];
              for (const id of ids) {
                await deleteMutation.mutateAsync(id);
              }
              toast.success("Referral deleted");
              setDeleteTarget(null);
            } catch (err) {
              Sentry.captureMessage("Failed to delete referral", {
                level: "error",
                extra: { cause: String(err) },
              });
              toast.error(err instanceof Error ? err.message : "Failed");
            }
          }
        }}
      />
    </PageShell>
  );
}
