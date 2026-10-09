"use client";

import {
  useAdminUserMutations,
  useAdminUserReferralMutation,
  useAdminUsers,
  useAuth,
  useServerPagination,
} from "@oc/api-admin";
import {
  Filter,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  User as UserIcon,
} from "@oc/icons";
import { useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, SortingState, VisibilityState } from "@tanstack/react-table";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { DateCell } from "@/components/admin/DateCell";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CustomerDialog } from "@/components/CustomerDialog";
import { DataTable, DataTableColumnHeader } from "@/components/DataTable";
import { FormSheet } from "@/components/FormSheet";
import { PageShell } from "@/components/PageShell";
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
import { useAdminTableURL } from "@/hooks/use-admin-table-url";
import { useTableSort } from "@/hooks/use-table-sort";
import { handleFormError } from "@/lib/handle-form-error";
import { createZodResolver } from "@/lib/zod-resolver";

interface UserRow {
  _id: string;
  email: string;
  role?: "user" | "manager" | "admin";
  isAdmin: boolean;
  isVerified: boolean;
  isGuestCheckout?: boolean;
  createdAt: string;
  referralMultiplier?: number;
  referralCode?: string | null;
  referralCount?: number;
  referredByEmail?: string;
}

const multiplierSchema = z.object({
  referralMultiplier: z.coerce
    .number()
    .min(0, "Must be at least 0")
    .max(100, "Must be 100 or less"),
});
type MultiplierFormValues = z.infer<typeof multiplierSchema>;

const GROUP_BY_OPTIONS = [
  { value: "none", label: "No grouping" },
  { value: "role", label: "Group by role" },
  { value: "verification", label: "Group by verification" },
];

const ALL_COLUMN_IDS = [
  "email",
  "isAdmin",
  "isVerified",
  "createdAt",
  "referralMultiplier",
  "referralCode",
  "referralCount",
  "referredByEmail",
  "actions",
] as const;

export default function UsersAdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { role: currentRole } = useAuth();
  const isManager = currentRole === "manager";

  const {
    searchInput,
    debouncedSearch,
    onSearchChange,
    filterValue: verifiedFilter,
    extraFilterValues,
    groupBy,
    setGroupBy,
    pagination,
    setPagination,
  } = useAdminTableURL({
    filterParam: "verified",
    extraFilters: [{ param: "isAdmin", defaultValue: "all" }],
    defaultPageSize: 10,
  });
  const isAdminFilter = extraFilterValues.isAdmin ?? "all";
  const { sortField, sortDir } = useTableSort("createdAt", "desc");

  const grouping = useMemo(() => {
    if (!groupBy) return [];
    const mapping: Record<string, string> = {
      role: "isAdmin",
      verification: "isVerified",
    };
    return mapping[groupBy] ? [mapping[groupBy]] : [];
  }, [groupBy]);

  const verifiedParam = verifiedFilter === "all" ? "" : verifiedFilter;
  const adminParam = isAdminFilter === "all" ? "" : isAdminFilter;
  const { data: usersResponse, isLoading } = useAdminUsers({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    verified: verifiedParam,
    isAdmin: adminParam,
    sortField,
    sortDir,
    search: debouncedSearch,
  });
  const users = (usersResponse?.data ?? []) as UserRow[];
  const {
    toggleVerifiedMutation,
    toggleAdminMutation,
    updateReferralMultiplierMutation,
    deleteUserMutation,
  } = useAdminUserMutations({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    verified: verifiedParam,
    isAdmin: adminParam,
    sortField,
    sortDir,
  });
  const { pageCount } = useServerPagination(usersResponse?.meta);

  // Profile dialog
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleViewProfile = useCallback((userId: string) => {
    setSelectedUserId(userId);
    setDialogOpen(true);
  }, []);

  // Edit multiplier sheet
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const form = useForm<MultiplierFormValues>({
    resolver: createZodResolver(multiplierSchema),
    defaultValues: { referralMultiplier: 1 },
  });

  useEffect(() => {
    if (editingUser) {
      form.reset({ referralMultiplier: editingUser.referralMultiplier ?? 1 });
    }
  }, [editingUser, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!editingUser) return;
    try {
      await updateReferralMultiplierMutation.mutateAsync({
        userId: editingUser._id,
        referralMultiplier: values.referralMultiplier,
      });
      toast.success("Referral multiplier updated");
      setEditingUser(null);
    } catch (err: unknown) {
      const msg = handleFormError(form, err);
      if (msg) toast.error(msg);
      if (!msg) toast.error("Please check the highlighted fields");
    }
  });

  // Reassign referral sheet
  const [reassignTarget, setReassignTarget] = useState<UserRow | null>(null);
  const reassignSchema = z.object({
    referralCode: z.string().optional(),
    action: z.enum(["set", "clear"], { message: "Select an action" }).default("set"),
  });
  type ReassignFormValues = z.infer<typeof reassignSchema>;
  const reassignForm = useForm<ReassignFormValues>({
    resolver: createZodResolver(reassignSchema),
    defaultValues: { referralCode: "", action: "set" },
  });
  const reassignMutation = useAdminUserReferralMutation();

  // Confirm dialogs
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<UserRow | null>(null);
  const [adminTarget, setAdminTarget] = useState<UserRow | null>(null);

  const columns: ColumnDef<UserRow>[] = useMemo(
    () => [
      {
        accessorKey: "email",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => handleViewProfile(row.original._id)}
            className="truncate font-mono text-sm transition-colors hover:text-primary"
          >
            {row.original.email}
          </button>
        ),
      },
      {
        accessorKey: "isAdmin",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
        cell: ({ row }) => {
          const roleLabel =
            row.original.role === "manager" ? "Manager" : row.original.isAdmin ? "Admin" : "User";
          if (isManager) {
            return (
              <StatusBadge variant={row.original.isAdmin ? "info" : "draft"} showIcon={false}>
                {roleLabel}
              </StatusBadge>
            );
          }
          return (
            <button
              type="button"
              onClick={() => setAdminTarget(row.original)}
              disabled={toggleAdminMutation.isPending}
              className="cursor-pointer"
              title={row.original.isAdmin ? "Revoke admin" : "Grant admin"}
            >
              <StatusBadge variant={row.original.isAdmin ? "info" : "draft"} showIcon={false}>
                {roleLabel}
              </StatusBadge>
            </button>
          );
        },
      },
      {
        accessorKey: "isVerified",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Verified" />,
        cell: ({ row }) => {
          const label = row.original.isVerified
            ? "Verified"
            : row.original.isGuestCheckout
              ? "Guest"
              : "Unverified";
          if (isManager) {
            return (
              <StatusBadge
                variant={
                  row.original.isVerified
                    ? "success"
                    : row.original.isGuestCheckout
                      ? "info"
                      : "warning"
                }
                showIcon={false}
              >
                {label}
              </StatusBadge>
            );
          }
          return (
            <button
              type="button"
              onClick={() => setVerifyTarget(row.original)}
              disabled={toggleVerifiedMutation.isPending}
              className="cursor-pointer"
              title={
                row.original.isGuestCheckout
                  ? "Guest profile"
                  : row.original.isVerified
                    ? "Mark unverified"
                    : "Mark verified"
              }
            >
              <StatusBadge
                variant={
                  row.original.isVerified
                    ? "success"
                    : row.original.isGuestCheckout
                      ? "info"
                      : "warning"
                }
                showIcon={false}
              >
                {label}
              </StatusBadge>
            </button>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Joined" />,
        cell: ({ row }) => <DateCell value={row.original.createdAt} />,
      },
      {
        accessorKey: "referralMultiplier",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Ref. Multiplier" />,
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {row.original.referralMultiplier != null ? row.original.referralMultiplier : 1}x
          </span>
        ),
      },
      {
        accessorKey: "referralCode",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Ref. Code" />,
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.referralCode ?? "\u2014"}</span>
        ),
      },
      {
        accessorKey: "referralCount",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Referrals" />,
        cell: ({ row }) => (
          <span className="tabular-nums text-sm">{row.original.referralCount ?? 0}</span>
        ),
      },
      {
        accessorKey: "referredByEmail",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Referred by" />,
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.referredByEmail ?? "\u2014"}</span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => e.stopPropagation()}
                aria-label="User actions"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => handleViewProfile(row.original._id)}>
                <UserIcon className="mr-2 size-4" />
                View profile
              </DropdownMenuItem>
              {!isManager && (
                <>
                  <DropdownMenuItem onClick={() => setEditingUser(row.original)}>
                    <Plus className="mr-2 size-4" />
                    Edit multiplier
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setReassignTarget(row.original)}>
                    <RefreshCw className="mr-2 size-4" />
                    Reassign referral
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAdminTarget(row.original)}>
                    <Shield className="mr-2 size-4" />
                    {row.original.isAdmin ? "Revoke admin" : "Grant admin"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setDeleteTarget(row.original)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 size-4" />
                    Delete user
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [
      toggleAdminMutation.isPending,
      toggleVerifiedMutation.isPending,
      handleViewProfile,
      setReassignTarget,
    ]
  );

  // Server-side sorting
  const sorting: SortingState = sortField ? [{ id: sortField, desc: sortDir === "desc" }] : [];

  const onSortingChange = useCallback(
    (updater: SortingState | ((prev: SortingState) => SortingState)) => {
      const newSorting = typeof updater === "function" ? updater(sorting) : updater;
      const params = new URLSearchParams(searchParams.toString());
      if (newSorting.length > 0) {
        params.set("sortField", newSorting[0].id);
        params.set("sortDir", newSorting[0].desc ? "desc" : "asc");
      } else {
        params.delete("sortField");
        params.delete("sortDir");
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [sorting, searchParams, router]
  );

  // URL-synced column visibility
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    const cols = searchParams.get("cols");
    if (!cols) return {};
    const visible = new Set(cols.split(","));
    return Object.fromEntries(ALL_COLUMN_IDS.map((id) => [id, visible.has(id)]));
  });

  const handleColumnVisibilityChange = useCallback(
    (updater: VisibilityState | ((prev: VisibilityState) => VisibilityState)) => {
      const newState = typeof updater === "function" ? updater(columnVisibility) : updater;
      setColumnVisibility(newState);
      const visibleCols = Object.entries(newState)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(",");
      const params = new URLSearchParams(searchParams.toString());
      if (visibleCols && visibleCols !== ALL_COLUMN_IDS.join(",")) {
        params.set("cols", visibleCols);
      } else {
        params.delete("cols");
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [columnVisibility, searchParams, router]
  );

  // CSV export
  const handleExport = useCallback(async () => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (sortField) {
      params.set("sortField", sortField);
      params.set("sortDir", sortDir);
    }
    try {
      const res = await fetch(`/api/admin/export/users?${params.toString()}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "users.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export users");
    }
  }, [debouncedSearch, sortField, sortDir]);

  // Row selection + bulk actions
  const [_selectedUsers, setSelectedUsers] = useState<UserRow[]>([]);

  const handleBulkAction = useCallback(
    async (action: string, ids: string[]) => {
      try {
        await fetch("/api/admin/bulk/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, action }),
        });
        toast.success(`Bulk action "${action}" completed`);
        queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      } catch {
        toast.error(`Bulk action "${action}" failed`);
      }
    },
    [queryClient]
  );

  return (
    <PageShell
      title="Users"
      description="Manage user accounts, roles, verification, and referral multipliers."
    >
      <DataTable
        columns={columns}
        data={users}
        pageCount={pageCount}
        pagination={pagination}
        onPaginationChange={setPagination}
        isLoading={isLoading}
        searchValue={searchInput}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search users by email\u2026"
        emptyTitle="No users found"
        emptyDescription="Try adjusting your search or filters."
        manualSorting
        sorting={sorting}
        onSortingChange={onSortingChange}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={handleColumnVisibilityChange}
        enableRowSelection
        onSelectedRowsChange={setSelectedUsers}
        enableGrouping={!!groupBy}
        grouping={grouping}
        bulkActions={
          isManager
            ? undefined
            : [
                { label: "Verify", onClick: (ids) => handleBulkAction("verify", ids) },
                { label: "Unverify", onClick: (ids) => handleBulkAction("unverify", ids) },
                { label: "Grant Admin", onClick: (ids) => handleBulkAction("grant-admin", ids) },
                {
                  label: "Revoke Admin",
                  onClick: (ids) => handleBulkAction("revoke-admin", ids),
                  variant: "destructive",
                },
                {
                  label: "Delete",
                  onClick: (ids) => handleBulkAction("delete", ids),
                  variant: "destructive",
                },
              ]
        }
        exportConfig={isManager ? undefined : { onExport: handleExport }}
        toolbar={
          <div className="flex items-center gap-2">
            <Select
              value={groupBy || "none"}
              onValueChange={(value) => setGroupBy(value === "none" ? undefined : value)}
            >
              <SelectTrigger className="h-9 w-[180px]">
                <Filter />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUP_BY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <CustomerDialog open={dialogOpen} onOpenChange={setDialogOpen} userId={selectedUserId} />

      <FormSheet
        open={editingUser !== null}
        onOpenChange={(open) => !open && setEditingUser(null)}
        title="Edit referral multiplier"
        description={editingUser?.email}
        onSubmit={onSubmit}
        isSubmitting={updateReferralMultiplierMutation.isPending}
        submitLabel="Save"
      >
        <Form {...form}>
          <FormField
            control={form.control}
            name="referralMultiplier"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Referral multiplier</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    {...field}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  Multiplier for referral commissions. Default is 1. Set below 1 to reduce
                  commissions; above 1 to boost.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </Form>
      </FormSheet>

      <FormSheet
        open={reassignTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReassignTarget(null);
            setError(null);
          }
        }}
        title="Reassign referral"
        description={reassignTarget?.email ? `Update referral for ${reassignTarget.email}` : ""}
        onSubmit={reassignForm.handleSubmit(async (values) => {
          if (!reassignTarget) return;
          try {
            if (values.action === "clear") {
              await reassignMutation.mutateAsync({
                userId: reassignTarget._id,
                action: "clear",
              });
              toast.success(`Referral cleared for ${reassignTarget.email}`);
            } else if (values.referralCode) {
              await reassignMutation.mutateAsync({
                userId: reassignTarget._id,
                referralCode: values.referralCode,
              });
              toast.success(`Referral reassigned to ${values.referralCode}`);
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
                    The user will be reassigned to this referral code.
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
        title="Delete user"
        description={
          <>
            Delete <strong>{deleteTarget?.email}</strong>? This anonymizes their profile and removes
            login access. Orders are retained.
          </>
        }
        confirmLabel="Delete"
        destructive
        isLoading={deleteUserMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            deleteUserMutation.mutate(deleteTarget._id, {
              onSuccess: () => {
                toast.success("User deleted");
                setDeleteTarget(null);
              },
              onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
            });
          }
        }}
      />

      <ConfirmDialog
        open={verifyTarget !== null}
        onOpenChange={(open) => !open && setVerifyTarget(null)}
        title={verifyTarget?.isVerified ? "Mark as unverified" : "Mark as verified"}
        description={
          verifyTarget
            ? `Are you sure you want to mark ${verifyTarget.email} as ${
                verifyTarget.isVerified ? "unverified" : "verified"
              }?`
            : ""
        }
        isLoading={toggleVerifiedMutation.isPending}
        onConfirm={() => {
          if (verifyTarget) {
            toggleVerifiedMutation.mutate(
              { userId: verifyTarget._id, isVerified: !verifyTarget.isVerified },
              {
                onSuccess: () => {
                  toast.success("Verification updated");
                  setVerifyTarget(null);
                },
                onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
              }
            );
          }
        }}
      />

      <ConfirmDialog
        open={adminTarget !== null}
        onOpenChange={(open) => !open && setAdminTarget(null)}
        title={adminTarget?.isAdmin ? "Revoke admin access" : "Grant admin access"}
        description={
          adminTarget
            ? `Are you sure you want to ${
                adminTarget.isAdmin ? "remove" : "grant"
              } admin access for ${adminTarget.email}?`
            : ""
        }
        destructive={adminTarget?.isAdmin}
        isLoading={toggleAdminMutation.isPending}
        onConfirm={() => {
          if (adminTarget) {
            toggleAdminMutation.mutate(
              { userId: adminTarget._id, isAdmin: !adminTarget.isAdmin },
              {
                onSuccess: () => {
                  toast.success("Admin role updated");
                  setAdminTarget(null);
                },
                onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
              }
            );
          }
        }}
      />
    </PageShell>
  );
}
