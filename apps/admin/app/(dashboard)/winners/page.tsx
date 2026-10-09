"use client";

import {
  api,
  useAdminWinnerMutations,
  useAdminWinners,
  useServerPagination,
} from "@oc/api-admin";
import {
  ImageIcon,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Trophy,
  User,
} from "@oc/icons";
import type { AdminCompetition, AdminUser } from "@oc/types";
import * as Sentry from "@sentry/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, SortingState, Updater, VisibilityState } from "@tanstack/react-table";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { AsyncCombobox } from "@/components/AsyncCombobox";
import { DateCell } from "@/components/admin/DateCell";
import { GroupBySelect } from "@/components/admin/GroupBySelect";
import { PriceCell } from "@/components/admin/PriceCell";
import { ShowDeletedToggle } from "@/components/admin/ShowDeletedToggle";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CustomerDialog } from "@/components/CustomerDialog";
import { DataTable, DataTableColumnHeader } from "@/components/DataTable";
import { FormSheet } from "@/components/FormSheet";
import { ImageCell } from "@/components/ImageCell";
import { PageShell } from "@/components/PageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Textarea } from "@/components/ui/textarea";
import { WinnerImageUploadDialog } from "@/components/WinnerImageUploadDialog";
import { WinnerPortraitUploadDialog } from "@/components/WinnerPortraitUploadDialog";
import { useAdminTableURL } from "@/hooks/use-admin-table-url";
import { useTableSort } from "@/hooks/use-table-sort";
import { handleFormError } from "@/lib/handle-form-error";
import { createZodResolver } from "@/lib/zod-resolver";

interface WinnerItem {
  _id: string;
  competitionId: string;
  competitionTitle: string;
  competitionSlug: string;
  userId: string;
  ticketNumber: string;
  prizeTitle: string;
  prizeValue: number;
  prizeImageUrl?: string | null;
  winnerPhotoUrl?: string | null;
  displayName: string;
  email?: string;
  location: string;
  testimonial: string;
  showFullName: boolean;
  claimed: boolean;
  drawnAt: string;
  deletedAt?: string;
}

interface EntryPreview {
  entry: { _id: string; entryNumber: number; userId: string };
  profile: { email: string | null; firstName: string | null; lastName: string | null };
  competition: { title: string; prizeValue: number } | null;
}

const addWinnerSchema = z.object({
  competitionId: z.string().min(1, "Competition is required"),
  ticketNumber: z.coerce.number().int().positive("Must be a positive integer"),
  prizeTitle: z.string().optional().or(z.literal("")),
  prizeValue: z.coerce.number().nonnegative().optional().or(z.literal("")),
  displayName: z.string().optional().or(z.literal("")),
  location: z.string().optional().or(z.literal("")),
  testimonial: z.string().optional().or(z.literal("")),
  showFullName: z.boolean(),
});
type AddWinnerFormValues = z.infer<typeof addWinnerSchema>;

const DEFAULT_FORM: AddWinnerFormValues = {
  competitionId: "",
  ticketNumber: 0,
  prizeTitle: "",
  prizeValue: "",
  displayName: "",
  location: "",
  testimonial: "",
  showFullName: false,
};

const SORTABLE_COLUMN_IDS = [
  "competitionTitle",
  "ticketNumber",
  "prizeValue",
  "drawnAt",
  "displayName",
  "claimed",
];

export default function WinnersAdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const tableState = useAdminTableURL({
    filterParam: "claimed",
    groupByParam: "groupBy",
    extraFilters: [
      { param: "competition", defaultValue: "all" },
      { param: "user", defaultValue: "all" },
    ],
    defaultPageSize: 10,
  });
  const competitionFilter = tableState.extraFilterValues.competition ?? "all";
  const userFilter = tableState.extraFilterValues.user ?? "all";
  const groupBy = tableState.groupBy;

  const { sortField, sortDir, toggleSort, resetSort } = useTableSort("drawnAt", "desc");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [entryPreview, setEntryPreview] = useState<EntryPreview | null>(null);
  const [searchError, setSearchError] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [claimedConfirm, setClaimedConfirm] = useState<WinnerItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WinnerItem | null>(null);
  const [imageDialogTarget, setImageDialogTarget] = useState<WinnerItem | null>(null);
  const [portraitDialogTarget, setPortraitDialogTarget] = useState<WinnerItem | null>(null);
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
    for (const id of SORTABLE_COLUMN_IDS) {
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
      user: "displayName",
      prize: "prizeTitle",
      competition: "competitionTitle",
    };
    return mapping[groupBy] ? [mapping[groupBy]] : [];
  }, [groupBy]);

  const { data: winnersResponse, isLoading } = useAdminWinners({
    page: tableState.pagination.pageIndex + 1,
    limit: tableState.pagination.pageSize,
    claimedFilter: tableState.filterValue === "all" ? "" : tableState.filterValue,
    competitionId: competitionFilter === "all" ? undefined : competitionFilter,
    userId: userFilter === "all" ? undefined : userFilter,
    sortField,
    sortDir,
    search: tableState.debouncedSearch,
    showDeleted,
  });
  const winners = (winnersResponse?.data ?? []) as WinnerItem[];
  const { pageCount } = useServerPagination(winnersResponse?.meta);
  const { toggleClaimedMutation, deleteMutation, restoreMutation } = useAdminWinnerMutations();

  const bulkMutation = useMutation({
    mutationFn: ({ action, ids }: { action: string; ids: string[] }) =>
      api.post("/api/admin/bulk/winners", { action, ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "winners"] });
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
    if (sortField) {
      params.set("sortField", sortField);
      params.set("sortDir", sortDir);
    }
    const qs = params.toString();
    window.open(`/api/admin/export/winners${qs ? `?${qs}` : ""}`, "_blank");
  }

  const form = useForm<AddWinnerFormValues>({
    resolver: createZodResolver(addWinnerSchema),
    defaultValues: DEFAULT_FORM,
  });

  const watchCompId = form.watch("competitionId");
  const watchTicket = form.watch("ticketNumber");

  const searchEntryMutation = useMutation({
    mutationFn: ({
      competitionId,
      ticketNumber,
    }: {
      competitionId: string;
      ticketNumber: string;
    }) =>
      api
        .get<EntryPreview>("/api/admin/winners/entries/search", {
          params: { competitionId, ticketNumber },
        })
        .then((res) => res.data),
    onSuccess: (data) => {
      setEntryPreview(data);
      setSearchError("");
    },
    onError: (err: unknown) => {
      setEntryPreview(null);
      setSearchError(err instanceof Error ? err.message : "Entry not found");
    },
  });

  const createWinnerMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post<WinnerItem>("/api/admin/winners", payload),
    onError: (err: unknown) => {
      Sentry.captureMessage("Failed to create winner", {
        level: "error",
        extra: { cause: String(err) },
      });
    },
  });

  function handleSearchEntry() {
    if (!watchCompId || !watchTicket) return;
    searchEntryMutation.mutate({
      competitionId: watchCompId,
      ticketNumber: String(watchTicket),
    });
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await createWinnerMutation.mutateAsync({
        competitionId: values.competitionId,
        ticketNumber: values.ticketNumber,
        prizeTitle: values.prizeTitle || undefined,
        prizeValue:
          typeof values.prizeValue === "number" && values.prizeValue > 0
            ? values.prizeValue
            : undefined,
        displayName: values.displayName || undefined,
        location: values.location || undefined,
        testimonial: values.testimonial || undefined,
        showFullName: values.showFullName || undefined,
      });
      toast.success("Winner added");
      setSheetOpen(false);
      setEntryPreview(null);
      setSearchError("");
      form.reset(DEFAULT_FORM);
    } catch (err) {
      const msg = handleFormError(form, err);
      if (msg) toast.error(msg);
      if (!msg) toast.error("Please check the highlighted fields");
    }
  });

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

  const isDeleted = (row: WinnerItem) => !!row.deletedAt;

  const columns: ColumnDef<WinnerItem>[] = useMemo(
    () => [
      {
        id: "image",
        header: () => <span className="sr-only">Image</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <ImageCell
            src={row.original.prizeImageUrl}
            alt={row.original.prizeTitle || "Winner image"}
            size="md"
          />
        ),
      },
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
        accessorKey: "displayName",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Winner" />,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => {
              setSelectedUserId(row.original.userId);
              setDialogOpen(true);
            }}
            className={`flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-primary ${
              isDeleted(row.original) ? "text-muted-foreground line-through" : "text-foreground"
            }`}
          >
            <User className="size-3.5" />
            {row.original.displayName || row.original.email || "—"}
          </button>
        ),
      },
      {
        accessorKey: "ticketNumber",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Ticket" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <Trophy className="size-3.5 text-primary" />
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
        id: "claimed",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Claimed" />,
        cell: ({ row }) => (
          <StatusBadge variant={row.original.claimed ? "success" : "warning"} showIcon={false}>
            {row.original.claimed ? "Claimed" : "Unclaimed"}
          </StatusBadge>
        ),
      },
      {
        accessorKey: "drawnAt",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Drawn" />,
        cell: ({ row }) => <DateCell value={row.original.drawnAt} />,
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
                onClick={() => setClaimedConfirm(row.original)}
                data-umami-event="winner:claim"
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
                          toast.success("Winner restored");
                        },
                        onError: (err) =>
                          toast.error(err instanceof Error ? err.message : "Failed"),
                      });
                    }}
                    data-umami-event="winner:row-restore"
                  >
                    <RefreshCw className="mr-2 size-4" />
                    Restore
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem
                      onClick={() => {
                        setImageDialogTarget(row.original);
                      }}
                      data-umami-event="winner:upload-image"
                    >
                      <ImageIcon className="mr-2 size-4" />
                      {row.original.prizeImageUrl ? "Replace image" : "Upload image"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setPortraitDialogTarget(row.original);
                      }}
                      data-umami-event="winner:upload-portrait"
                    >
                      <ImageIcon className="mr-2 size-4" />
                      {row.original.winnerPhotoUrl ? "Replace portrait" : "Upload portrait"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedUserId(row.original.userId);
                        setDialogOpen(true);
                      }}
                      data-umami-event="winner:view-customer"
                    >
                      <User className="mr-2 size-4" />
                      View customer
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteTarget(row.original)}
                      data-umami-event="winner:row-delete"
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete winner
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
    <PageShell
      title="Winners"
      description="Manage competition winners and prize claims."
      actions={
        <Button onClick={() => setSheetOpen(true)} data-umami-event="winner:add-open">
          <Plus className="size-4" />
          Add winner
        </Button>
      }
    >
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card/40 p-3">
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
            queryKey="winner-competition-filter"
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
            queryKey="winner-user-filter"
            fetchOptions={fetchUsers}
            placeholder="All users"
            className="h-8 w-56"
          />
        </div>
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
            Group by
          </span>
          <GroupBySelect
            value={groupBy}
            onValueChange={tableState.setGroupBy}
            options={[
              { value: "user", label: "User" },
              { value: "prize", label: "Prize" },
              { value: "competition", label: "Competition" },
            ]}
            width="w-[160px]"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <ShowDeletedToggle
          id="show-deleted-winners"
          checked={showDeleted}
          onCheckedChange={setShowDeleted}
          umamiEvent="winner:show-deleted-toggle"
        />
      </div>

      <DataTable
        columns={columns}
        data={winners}
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
        searchPlaceholder="Search winners…"
        emptyTitle="No winners"
        emptyDescription="Add a winner to get started."
        enableRowSelection
        enableGrouping={!!groupBy}
        grouping={grouping}
        rowClassName={(row) => (isDeleted(row as WinnerItem) ? "opacity-50" : "")}
        bulkActions={[
          { label: "Mark Claimed", onClick: (ids) => handleBulkAction("claim", ids) },
          { label: "Mark Unclaimed", onClick: (ids) => handleBulkAction("unclaim", ids) },
          {
            label: "Delete",
            onClick: (ids) => handleBulkAction("delete", ids),
            variant: "destructive",
          },
        ]}
        exportConfig={{
          onExport: handleExport,
          isExporting: false,
          label: "Export CSV",
        }}
      />

      <CustomerDialog open={dialogOpen} onOpenChange={setDialogOpen} userId={selectedUserId} />

      <FormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) {
            form.reset(DEFAULT_FORM);
            setEntryPreview(null);
            setSearchError("");
          }
        }}
        title="Add winner"
        description="Pick a competition and ticket, optionally with display details."
        onSubmit={onSubmit}
        isSubmitting={createWinnerMutation.isPending}
        submitLabel="Add winner"
        size="wide"
      >
        <Form {...form}>
          <div className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="competitionId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Competition</FormLabel>
                  <FormControl>
                    <AsyncCombobox
                      value={field.value}
                      onValueChange={field.onChange}
                      queryKey="winner-add-competition"
                      fetchOptions={async (search) => {
                        const res = await api.get<AdminCompetition[]>("/api/admin/competitions", {
                          params: { limit: 20, search },
                        });
                        return (res.data ?? []).map((c) => ({
                          value: c._id,
                          label: c.title,
                        }));
                      }}
                      placeholder="Select competition…"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
              <FormField
                control={form.control}
                name="ticketNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Winning ticket #</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="1234"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleSearchEntry}
                disabled={searchEntryMutation.isPending || !watchCompId || !watchTicket}
                data-umami-event="winner:search-entry"
              >
                <Search className="size-4" />
                Find
              </Button>
            </div>

            {searchError ? (
              <Alert variant="destructive">
                <AlertDescription>{searchError}</AlertDescription>
              </Alert>
            ) : null}

            {entryPreview ? (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-1">
                  Entry preview
                </p>
                <p className="text-sm font-medium">
                  {entryPreview.profile.firstName || entryPreview.profile.lastName
                    ? `${entryPreview.profile.firstName ?? ""} ${
                        entryPreview.profile.lastName ?? ""
                      }`.trim()
                    : entryPreview.profile.email}
                </p>
                <p className="text-xs text-muted-foreground">{entryPreview.profile.email}</p>
                <p className="mt-1 font-mono text-xs">Entry #{entryPreview.entry.entryNumber}</p>
              </div>
            ) : null}

            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Optional display details
              </p>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="prizeTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prize title</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Defaults to competition title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="prizeValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prize value (£)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Defaults to competition prize value"
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
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Defaults to first name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. London, UK" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="testimonial"
                render={({ field }) => (
                  <FormItem className="mt-3">
                    <FormLabel>Testimonial</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} placeholder="What the winner said…" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="showFullName"
                render={({ field }) => (
                  <FormItem className="mt-3 flex flex-row items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex flex-col gap-0.5">
                      <FormLabel className="cursor-pointer">Show full name</FormLabel>
                      <FormDescription>Default is anonymous (initial only).</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>
        </Form>
      </FormSheet>

      <ConfirmDialog
        open={claimedConfirm !== null}
        onOpenChange={(open) => !open && setClaimedConfirm(null)}
        title="Mark as claimed"
        description={
          claimedConfirm
            ? `Mark winner #${claimedConfirm.ticketNumber} on "${claimedConfirm.competitionTitle}" as claimed?`
            : ""
        }
        isLoading={toggleClaimedMutation.isPending}
        onConfirm={() => {
          if (claimedConfirm) {
            toggleClaimedMutation.mutate(
              { id: claimedConfirm._id },
              {
                onSuccess: () => {
                  toast.success("Marked claimed");
                  setClaimedConfirm(null);
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
        title="Delete winner"
        description={
          deleteTarget
            ? `Delete winner #${deleteTarget.ticketNumber} on "${deleteTarget.competitionTitle}"? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget._id, {
              onSuccess: () => {
                toast.success("Winner deleted");
                setDeleteTarget(null);
              },
              onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
            });
          }
        }}
      />

      <WinnerImageUploadDialog
        open={imageDialogTarget !== null}
        onOpenChange={(open) => !open && setImageDialogTarget(null)}
        winnerId={imageDialogTarget?._id ?? ""}
        winnerLabel={
          imageDialogTarget
            ? `${imageDialogTarget.displayName || imageDialogTarget.email || "Winner"} · ${imageDialogTarget.competitionTitle}`
            : ""
        }
        competitionSlug={imageDialogTarget?.competitionSlug ?? ""}
        currentImageUrl={imageDialogTarget?.prizeImageUrl}
      />

      <WinnerPortraitUploadDialog
        open={portraitDialogTarget !== null}
        onOpenChange={(open) => !open && setPortraitDialogTarget(null)}
        winnerId={portraitDialogTarget?._id ?? ""}
        winnerLabel={
          portraitDialogTarget
            ? `${portraitDialogTarget.displayName || portraitDialogTarget.email || "Winner"} · ${portraitDialogTarget.competitionTitle}`
            : ""
        }
        competitionSlug={portraitDialogTarget?.competitionSlug ?? ""}
        currentPortraitUrl={portraitDialogTarget?.winnerPhotoUrl}
      />
    </PageShell>
  );
}
