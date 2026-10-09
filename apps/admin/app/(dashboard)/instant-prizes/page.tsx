"use client";

import {
  api,
  useAdminCompetitions,
  useAdminInstantPrizeTemplateMutations,
  useAdminInstantPrizeTemplates,
  useServerPagination,
} from "@oc/api-admin";
import { Award, Filter, Lock, MoreHorizontal, Plus, RefreshCw, Trash2, X } from "@oc/icons";
import type { AdminInstantPrize } from "@oc/types";
import { ADMIN_INSTANT_PRIZE_TABLE } from "@oc/types";
import { getAvailableTickets } from "@oc/utils";
import type { ColumnDef, SortingState, Updater, VisibilityState } from "@tanstack/react-table";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { AsyncCombobox } from "@/components/AsyncCombobox";
import { PriceCell } from "@/components/admin/PriceCell";
import { ShowDeletedToggle } from "@/components/admin/ShowDeletedToggle";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable, DataTableColumnHeader } from "@/components/DataTable";
import { FormSheet } from "@/components/FormSheet";
import { ImageCell } from "@/components/ImageCell";
import { ImagePreview } from "@/components/image-preview";
import { ImageUpload } from "@/components/image-upload";
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
import { Textarea } from "@/components/ui/textarea";
import { useAdminTableURL } from "@/hooks/use-admin-table-url";
import { useTableSort } from "@/hooks/use-table-sort";
import { handleFormError } from "@/lib/handle-form-error";
import { createZodResolver } from "@/lib/zod-resolver";

const prizeSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional().or(z.literal("")),
    value: z.coerce.number().nonnegative("Must be 0 or greater"),
    images: z.array(z.string()),
    isActive: z.boolean(),
    type: z.enum(["prize", "competition_ticket"]),
    linkedCompetitionId: z.string().optional().or(z.literal("")),
    ticketCount: z.coerce.number().int().min(1, "Must be at least 1"),
  })
  .refine((v) => (v.type === "competition_ticket" ? !!v.linkedCompetitionId : true), {
    path: ["linkedCompetitionId"],
    message: "Linked competition is required for ticket prizes",
  });

type PrizeFormValues = z.infer<typeof prizeSchema>;

const DEFAULT_FORM: PrizeFormValues = {
  title: "",
  description: "",
  value: 0,
  images: [],
  isActive: true,
  type: "prize",
  linkedCompetitionId: "",
  ticketCount: 1,
};

type CompetitionSummary = {
  _id: string;
  title: string;
  ticketPrice?: number;
  maxTickets?: number;
  ticketsSold?: number;
  ticketsHeld?: number;
  availableTickets?: number;
};

function AvailabilityHint({
  competitionId,
  competitions,
}: {
  competitionId: string;
  competitions: CompetitionSummary[];
}) {
  const comp = competitions.find((c) => c._id === competitionId);
  if (!comp) return null;
  const available = getAvailableTickets(comp);
  const maxTickets = comp.maxTickets ?? 0;
  const pct = maxTickets ? Math.round((available / maxTickets) * 100) : 0;
  const isLow = pct < 20;
  return (
    <FormDescription className={isLow ? "text-destructive" : undefined}>
      {available} / {maxTickets} tickets available
      {isLow ? " — almost full" : null}
    </FormDescription>
  );
}

export default function InstantPrizesAdminPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tableState = useAdminTableURL({ defaultPageSize: 10 });
  const { groupBy, setGroupBy } = tableState;
  const { sortField, sortDir } = useTableSort("createdAt", "desc");

  const [isExporting, setIsExporting] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<AdminInstantPrize | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminInstantPrize | null>(null);
  const [typeSwitchConfirm, setTypeSwitchConfirm] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);

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
    window.open(`/api/admin/export/instant-prizes?${params.toString()}`, "_blank");
    setTimeout(() => setIsExporting(false), 1000);
  }, [tableState.debouncedSearch]);

  const grouping = useMemo(() => {
    if (!groupBy || groupBy === "none") return [];
    const mapping: Record<string, string> = {
      type: "type",
    };
    return mapping[groupBy] ? [mapping[groupBy]] : [];
  }, [groupBy]);

  const { data: prizesResponse, isLoading } = useAdminInstantPrizeTemplates({
    page: tableState.pagination.pageIndex + 1,
    limit: tableState.pagination.pageSize,
    sortField,
    sortDir,
    search: tableState.debouncedSearch,
    showDeleted,
  });
  const prizes = (prizesResponse?.data ?? []) as AdminInstantPrize[];
  const { pageCount } = useServerPagination(prizesResponse?.meta);
  const { deleteMutation, createMutation, updateMutation, restoreMutation } =
    useAdminInstantPrizeTemplateMutations();
  const { data: competitionsResponse } = useAdminCompetitions();
  const competitions = (competitionsResponse?.data ?? []) as CompetitionSummary[];
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const form = useForm<PrizeFormValues>({
    resolver: createZodResolver(prizeSchema),
    defaultValues: DEFAULT_FORM,
  });

  const watchType = form.watch("type");
  const watchLinkedId = form.watch("linkedCompetitionId");
  const watchTicketCount = form.watch("ticketCount");
  const isTicketType = watchType === "competition_ticket";
  const selectedComp = competitions.find((c) => c._id === watchLinkedId);
  const isValueLocked = isTicketType && !!selectedComp;

  useEffect(() => {
    if (editing) {
      form.reset({
        title: editing.title,
        description: editing.description || "",
        value: editing.value,
        images: editing.images ?? [],
        isActive: editing.isActive,
        type: editing.type ?? "prize",
        linkedCompetitionId: editing.linkedCompetitionId ?? "",
        ticketCount: editing.ticketCount ?? 1,
      });
    } else if (sheetOpen) {
      form.reset(DEFAULT_FORM);
    }
  }, [editing, sheetOpen, form]);

  // Auto-fill title/value for ticket-type prizes when comp or count changes
  useEffect(() => {
    if (!isTicketType || !selectedComp) return;
    const ticketCount = watchTicketCount || 1;
    const autoValue = (selectedComp.ticketPrice ?? 0) * ticketCount;
    form.setValue("value", autoValue);
    const ticketLabel = ticketCount === 1 ? "Ticket" : "Tickets";
    const currentTitle = form.getValues("title").trim();
    if (!currentTitle) {
      form.setValue("title", `Free ${ticketCount} ${ticketLabel} to ${selectedComp.title}`);
    }
    if (!form.getValues("description")?.trim()) {
      form.setValue(
        "description",
        `Winner will receive ${ticketCount} free ${ticketLabel.toLowerCase()} to ${selectedComp.title}!`
      );
    }
  }, [isTicketType, selectedComp, watchTicketCount, form]);

  const handlePrizeTypeChange = (nextType: "prize" | "competition_ticket") => {
    const currentType = form.getValues("type");
    if (nextType === currentType) return;
    if (
      currentType === "competition_ticket" &&
      form.getValues("linkedCompetitionId") &&
      nextType === "prize"
    ) {
      setTypeSwitchConfirm(true);
      return;
    }
    form.setValue("type", nextType);
    if (nextType === "prize") {
      form.setValue("linkedCompetitionId", "");
      form.setValue("ticketCount", 1);
    }
  };

  const confirmTypeSwitch = () => {
    form.setValue("type", "prize");
    form.setValue("linkedCompetitionId", "");
    form.setValue("ticketCount", 1);
    setTypeSwitchConfirm(false);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const payload = {
      title: values.title.trim(),
      description: values.description?.trim() || undefined,
      value: values.value,
      images: values.images,
      isActive: values.isActive,
      type: values.type,
      linkedCompetitionId: values.linkedCompetitionId || undefined,
      ticketCount: values.type === "competition_ticket" ? values.ticketCount : undefined,
    };
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing._id, payload });
        toast.success("Prize template updated");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Prize template created");
      }
      setSheetOpen(false);
      setEditing(null);
    } catch (err: unknown) {
      const msg = handleFormError(form, err);
      if (msg) toast.error(msg);
      if (!msg) toast.error("Please check the highlighted fields");
    }
  });

  const handleImageUpload = (url: string) => {
    const images = form.getValues("images");
    if (url && !images.includes(url)) {
      form.setValue("images", [...images, url]);
    }
  };

  const handleImageRemove = (index: number) => {
    const images = form.getValues("images");
    form.setValue(
      "images",
      images.filter((_, i) => i !== index)
    );
  };

  const isDeleted = (row: AdminInstantPrize) =>
    !!(row as unknown as { deletedAt?: unknown }).deletedAt;

  const columns: ColumnDef<AdminInstantPrize>[] = useMemo(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span
              className={`font-medium ${isDeleted(row.original) ? "line-through text-muted-foreground" : ""}`}
            >
              {row.original.title}
            </span>
            {isDeleted(row.original) ? <Badge variant="secondary">Deleted</Badge> : null}
          </div>
        ),
      },
      {
        accessorKey: "type",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
        cell: ({ row }) =>
          row.original.type === "competition_ticket" ? (
            <StatusBadge variant="info" showIcon={false}>
              Free tickets ×{row.original.ticketCount ?? 1}
            </StatusBadge>
          ) : (
            <StatusBadge variant="draft" showIcon={false}>
              Prize
            </StatusBadge>
          ),
      },
      {
        accessorKey: "value",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Value" />,
        cell: ({ row }) => <PriceCell value={row.original.value ?? 0} size="sm" />,
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
        id: "images",
        accessorKey: "images",
        header: "Images",
        enableSorting: false,
        cell: ({ row }) => {
          const imgs = row.original.images ?? [];
          if (imgs.length === 0) return <span className="text-sm text-muted-foreground">—</span>;
          return (
            <div className="flex items-center gap-1">
              {imgs.slice(0, 3).map((url, i) => (
                <ImageCell key={i} src={url} alt={`${row.original.title} ${i + 1}`} size="xs" />
              ))}
              {imgs.length > 3 ? (
                <span className="text-xs text-muted-foreground">+{imgs.length - 3}</span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "linkedCompetition",
        header: "Linked Competition",
        enableSorting: false,
        cell: ({ row }) => {
          const prize = row.original;
          if (prize.type !== "competition_ticket" || !prize.linkedCompetition) {
            return <span className="text-sm text-muted-foreground">—</span>;
          }
          const status = prize.linkedCompetition.status;
          const variant =
            status === "active"
              ? ("active" as const)
              : status === "drawn" || status === "cancelled"
                ? ("cancelled" as const)
                : ("draft" as const);
          return (
            <div className="flex items-center gap-2">
              <span className="truncate text-sm max-w-[140px]">
                {prize.linkedCompetition.title}
              </span>
              {status && (
                <StatusBadge variant={variant} showIcon={false}>
                  {status}
                </StatusBadge>
              )}
            </div>
          );
        },
      },
      {
        id: "usage",
        header: "Usage",
        enableSorting: false,
        cell: ({ row }) => {
          const baCount =
            (row.original as unknown as { bonusAwardCount?: number }).bonusAwardCount ?? 0;
          const caCount =
            (row.original as unknown as { competitionAssignmentCount?: number })
              .competitionAssignmentCount ?? 0;
          if (baCount === 0 && caCount === 0) {
            return <span className="text-sm text-muted-foreground">—</span>;
          }
          return (
            <div className="flex flex-col text-xs leading-tight">
              {baCount > 0 ? (
                <Link
                  href={`/bonus-awards?search=${encodeURIComponent(row.original.title)}`}
                  className="hover:text-primary"
                >
                  {baCount} bonus award{baCount !== 1 ? "s" : ""}
                </Link>
              ) : null}
              {caCount > 0 ? (
                <span className="text-muted-foreground">
                  {caCount} competition{caCount !== 1 ? "s" : ""}
                </span>
              ) : null}
            </div>
          );
        },
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
                        toast.success("Prize template restored");
                      },
                      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
                    });
                  }}
                  data-umami-event="instant-prize:row-restore"
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
                    data-umami-event="instant-prize:row-edit"
                  >
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      const params = new URLSearchParams();
                      params.set("create", "true");
                      params.set("prizeId", row.original._id);
                      params.set("prizeTitle", row.original.title);
                      if (row.original.value) params.set("prizeValue", String(row.original.value));
                      window.open(`/bonus-awards?${params.toString()}`, "_blank");
                    }}
                    data-umami-event="instant-prize:use-as-bonus"
                  >
                    <Award className="mr-2 size-4" />
                    Use as bonus award
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteTarget(row.original)}
                    data-umami-event="instant-prize:row-delete"
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
      title="Instant Prizes"
      description="Manage instant win prize templates."
      actions={
        <Button
          onClick={() => {
            setEditing(null);
            setSheetOpen(true);
          }}
          data-umami-event="instant-prize:create-open"
        >
          <Plus className="size-4" />
          New prize template
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={prizes}
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
        searchPlaceholder="Search prize templates…"
        emptyTitle="No prize templates"
        emptyDescription="Create your first template to get started."
        enableGrouping={!!groupBy && groupBy !== "none"}
        grouping={grouping}
        rowClassName={(row) => (isDeleted(row as AdminInstantPrize) ? "opacity-50" : "")}
        exportConfig={{
          onExport: handleExport,
          isExporting,
          label: "Export CSV",
          umamiEvent: "instant-prize:export-csv",
        }}
        toolbar={
          <div className="flex items-center gap-2">
            <ShowDeletedToggle
              id="show-deleted-instant-prizes"
              checked={showDeleted}
              onCheckedChange={setShowDeleted}
              umamiEvent="instant-prize:show-deleted-toggle"
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
                {ADMIN_INSTANT_PRIZE_TABLE.groupByOptions.map((opt) => (
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
        title={editing ? "Edit prize template" : "New prize template"}
        description={
          editing ? "Edit the prize template details" : "Create a new instant win prize template"
        }
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        size="wide"
        submitButtonUmami="instant-prize:form-submit"
        submitButtonDataAttrs={{ "data-umami-event-mode": editing ? "edit" : "create" }}
      >
        <Form {...form}>
          <div className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prize type</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) =>
                      handlePrizeTypeChange(v as "prize" | "competition_ticket")
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="prize">Site credit, cash, or physical prize</SelectItem>
                      <SelectItem value="competition_ticket">Free tickets in another competition</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose credit, cash, or product when editing the name and value below. Online Competitions does
                    not auto-pay credit or cash — staff fulfil wins under Instant Prize Wins.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isTicketType ? (
              <>
                <FormField
                  control={form.control}
                  name="linkedCompetitionId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target competition</FormLabel>
                      <FormControl>
                        <AsyncCombobox
                          value={field.value}
                          onValueChange={field.onChange}
                          queryKey="prize-linked-comp"
                          fetchOptions={async (search) => {
                            const res = await api.get<{ _id: string; title: string }[]>(
                              "/api/admin/competitions",
                              { params: { limit: 20, search } }
                            );
                            return (res.data ?? []).map((c) => ({
                              value: c._id,
                              label: c.title,
                            }));
                          }}
                          placeholder="Select competition…"
                        />
                      </FormControl>
                      {field.value ? (
                        <AvailabilityHint competitionId={field.value} competitions={competitions} />
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ticketCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tickets per win</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          className="w-32"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      </FormControl>
                      <FormDescription>
                        Number of free tickets awarded when this prize is won.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : null}

            <div className="rounded-lg border border-border p-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Details
              </p>
              <div className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. Instant £5 Cash Bonus" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Value (GBP)
                        {isValueLocked ? (
                          <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                            <Lock className="size-3" />
                            Auto-calculated
                          </span>
                        ) : null}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          readOnly={isValueLocked}
                          {...field}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={3}
                          placeholder="Optional description shown to customers"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="rounded-lg border border-border p-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Media
              </p>
              <FormField
                control={form.control}
                name="images"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Images</FormLabel>
                    <FormDescription>Upload one or more images for this prize.</FormDescription>
                    {field.value.length > 0 ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {field.value.map((url, i) => (
                          <div key={i} className="group relative">
                            <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-border">
                              <ImagePreview
                                src={url}
                                alt={`Prize ${i + 1}`}
                                className="h-full w-full"
                              />
                            </div>
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="destructive"
                              onClick={() => handleImageRemove(i)}
                              className="absolute -top-1.5 -right-1.5 opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <X className="size-3" />
                              <span className="sr-only">Remove</span>
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <ImageUpload
                      slug={`prize-template-${Date.now()}`}
                      onUpload={handleImageUpload}
                      onError={(msg) => toast.error(msg)}
                      className="[&>div]:rounded-lg [&>div]:border [&>div]:border-dashed [&>div]:border-border [&>div]:p-4"
                    />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <FormLabel className="cursor-pointer">Active</FormLabel>
                    <FormDescription>Inactive prizes will not be awarded.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-umami-event="instant-prize:toggle-active"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </Form>
      </FormSheet>

      <ConfirmDialog
        open={typeSwitchConfirm}
        onOpenChange={setTypeSwitchConfirm}
        title="Switch prize type"
        description="Switching to Physical Prize will clear the linked competition. Continue?"
        confirmLabel="Switch type"
        destructive
        onConfirm={confirmTypeSwitch}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete prize template"
        description={
          <>
            Delete <strong>{deleteTarget?.title}</strong>? This action cannot be undone.
          </>
        }
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget._id, {
              onSuccess: () => {
                toast.success("Prize template deleted");
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
