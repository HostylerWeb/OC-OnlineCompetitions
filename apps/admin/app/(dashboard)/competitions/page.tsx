"use client";

import {
  ApiResponseError,
  api,
  useAdminCategories,
  useAdminCompetitionMutations,
  useAdminCompetitions,
  useAdminDashboardStats,
  useAdminEndingSoonSettings,
  useBonusAwardAssignmentDrawerStore,
  useCompetitionStream,
  useEndingSoonSettingsMutations,
  useInstantPrizeDrawerStore,
  useServerPagination,
} from "@oc/api-admin";
import { Award, Film, Plus, RefreshCw, Settings, Trophy, Zap } from "@oc/icons";
import type {
  AdminCategory,
  AdminCompetition,
  ApiResponse,
  EndingSoonSettings,
} from "@oc/types";
import { filterEndingSoonCompetitions } from "@oc/utils";
import { useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { format } from "date-fns";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { AsyncCombobox } from "@/components/AsyncCombobox";
import { GroupBySelect } from "@/components/admin/GroupBySelect";
import { PriceCell } from "@/components/admin/PriceCell";
import { ShowDeletedToggle } from "@/components/admin/ShowDeletedToggle";
import { StatusBadge, type StatusVariant } from "@/components/admin/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CustomerDialog } from "@/components/CustomerDialog";
import {
  AddMilestoneDrawer,
  AddPrizeDrawer,
  CompetitionFormSheet,
  type CompetitionFormState,
  CompetitionFormTabs,
  DEFAULT_FORM,
  FILTER_STATUS_OPTIONS,
  getDefaultForm,
  SelectWinnerDialog,
} from "@/components/competition";
import {
  type CompetitionFormTab,
  validateCompetitionForm,
} from "@/components/competition/validateCompetitionForm";
import { DataTable, DataTableColumnHeader } from "@/components/DataTable";
import { ImageCell as ImageCellComponent } from "@/components/ImageCell";
import { PageShell } from "@/components/PageShell";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { VideoUpload } from "@/components/VideoUpload";
import { useAdminTableURL, useColumnVisibility } from "@/hooks/use-admin-table-url";
import { useTableSort } from "@/hooks/use-table-sort";
import { createZodResolver } from "@/lib/zod-resolver";

const endingSoonSchema = z
  .object({
    endingSoonCombineMode: z.enum(["or", "and"]),
    endingSoonTimeEnabled: z.boolean(),
    endingSoonDaysThreshold: z.coerce.number().int().min(1).default(7),
    endingSoonTicketsEnabled: z.boolean(),
    endingSoonTicketsThreshold: z.coerce.number().int().min(0).max(100).default(20),
    endingSoonTicketsMetric: z.enum(["remaining", "sold"]),
  })
  .refine(
    (data) => data.endingSoonTimeEnabled || data.endingSoonTicketsEnabled,
    "Enable at least one ending soon condition"
  );

type EndingSoonFormValues = z.infer<typeof endingSoonSchema>;

function getCompetitionStatusVariant(status: string): StatusVariant {
  if (status === "pending_draw") return "pending_draw";
  if (
    status === "active" ||
    status === "draft" ||
    status === "ended" ||
    status === "drawn" ||
    status === "cancelled"
  ) {
    return status;
  }
  return "draft";
}

function getCompetitionStatusLabel(status: string): string {
  const option = FILTER_STATUS_OPTIONS.find((o) => o.value === status);
  if (option) return option.label;
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const GROUP_BY_OPTIONS = [
  { value: "status", label: "Group by status" },
  { value: "category", label: "Group by category" },
];

const COMPETITION_COLUMN_IDS = [
  "image",
  "title",
  "status",
  "category",
  "prizeValue",
  "ticketPrice",
  "tickets",
  "drawDate",
  "actions",
];

export default function CompetitionsAdminPage() {
  const searchParams = useSearchParams();
  const {
    searchInput: globalFilter,
    debouncedSearch: debouncedGlobalFilter,
    onSearchChange: onGlobalFilterChange,
    groupBy,
    setGroupBy,
    filterValue: statusFilter,
    setFilterValue: setStatusFilter,
    extraFilterValues,
    setExtraFilterValue,
    pagination,
    setPagination,
    resetAll,
  } = useAdminTableURL({
    extraFilters: [{ param: "category", defaultValue: "all" }],
    defaultPageSize: 20,
  });
  const categoryFilter = extraFilterValues.category ?? "all";
  const { sortField, sortDir, toggleSort } = useTableSort("createdAt", "desc");
  const sorting: SortingState = sortField ? [{ id: sortField, desc: sortDir === "desc" }] : [];
  const handleSortingChange: React.Dispatch<React.SetStateAction<SortingState>> = (updater) => {
    const newSorting = typeof updater === "function" ? updater(sorting) : updater;
    if (newSorting[0]) {
      toggleSort(newSorting[0].id);
    }
  };
  const { columnVisibility, onColumnVisibilityChange } =
    useColumnVisibility(COMPETITION_COLUMN_IDS);

  const [isExporting, setIsExporting] = useState(false);

  async function handleExportCompetitions() {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("categoryId", categoryFilter);
      if (debouncedGlobalFilter) params.set("search", debouncedGlobalFilter);
      if (sortField) params.set("sortField", sortField);
      if (sortDir) params.set("sortDir", sortDir);
      window.open(`/api/admin/export/competitions?${params.toString()}`, "_blank");
    } finally {
      setIsExporting(false);
    }
  }

  const [showSheet, setShowSheet] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CompetitionFormState>(() => getDefaultForm());
  const [formError, setFormError] = useState("");
  const [drawDateError, setDrawDateError] = useState("");
  const [activeTab, setActiveTab] = useState<CompetitionFormTab>("details");
  const [isFetching, setIsFetching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const sessionUrlsRef = useRef<Set<string>>(new Set());
  const originalImagesRef = useRef<string[]>([]);
  const [winnerDialogOpen, setWinnerDialogOpen] = useState(false);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [selectedVideoCompetition, setSelectedVideoCompetition] = useState<{
    _id: string;
    title: string;
    landingPageVideoUrl?: string;
  } | null>(null);
  const [selectedCompetition, setSelectedCompetition] = useState<{
    _id: string;
    title: string;
    prizeValue: number;
    ticketsSold: number;
    maxTickets: number;
    status: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [selectedUserId, _setSelectedUserId] = useState<string | null>(null);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const grouping = useMemo(() => {
    if (!groupBy) return [];
    const mapping: Record<string, string> = {
      status: "status",
      category: "category",
    };
    return mapping[groupBy] ? [mapping[groupBy]] : [];
  }, [groupBy]);

  const { data: competitionsResponse, isLoading } = useAdminCompetitions({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    statusFilter:
      statusFilter === "all" ? "" : statusFilter === "need_draw" ? "pending_draw" : statusFilter,
    categoryId: categoryFilter === "all" ? undefined : categoryFilter,
    sortField,
    sortDir,
    search: debouncedGlobalFilter,
    showDeleted,
  });
  const competitions = competitionsResponse?.data ?? [];
  const competitionIds = competitions.map((c: any) => c._id || c.id).filter(Boolean);
  useCompetitionStream(competitionIds);
  const { pageCount } = useServerPagination(competitionsResponse?.meta);
  const { data: statsResponse } = useAdminDashboardStats();
  const stats = statsResponse?.data;
  const { data: categoriesResponse } = useAdminCategories();
  const categories = categoriesResponse?.data ?? [];
  const { createMutation, updateMutation, deleteMutation, restoreMutation } =
    useAdminCompetitionMutations();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const prizeDrawer = useInstantPrizeDrawerStore();
  const bonusDrawer = useBonusAwardAssignmentDrawerStore();

  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState<string[] | null>(null);

  const bulkActions = useMemo(
    () => [
      {
        label: "Publish",
        onClick: async (ids: string[]) => {
          await Promise.all(
            ids.map((id) => updateMutation.mutateAsync({ id, payload: { status: "active" } }))
          );
          toast.success(`Published ${ids.length} competition(s)`);
        },
        umamiEvent: "competition:bulk-publish",
      },
      {
        label: "Draft",
        onClick: async (ids: string[]) => {
          await Promise.all(
            ids.map((id) => updateMutation.mutateAsync({ id, payload: { status: "draft" } }))
          );
          toast.success(`Drafted ${ids.length} competition(s)`);
        },
        umamiEvent: "competition:bulk-draft",
      },
      {
        label: "Delete",
        variant: "destructive" as const,
        onClick: (ids: string[]) => setBulkDeleteConfirm(ids),
        umamiEvent: "competition:bulk-delete",
      },
    ],
    [deleteMutation, updateMutation]
  );

  const { data: settingsResponse } = useAdminEndingSoonSettings();
  const { saveSettingsMutation } = useEndingSoonSettingsMutations();
  const [rawCompetition, setRawCompetition] = useState<AdminCompetition | null>(null);
  const queryClient = useQueryClient();

  const { data: previewCompsResponse } = useAdminCompetitions({
    page: 1,
    limit: 100,
    statusFilter: "active",
  });
  const previewCompetitions = previewCompsResponse?.data ?? [];

  const settingsForm = useForm<EndingSoonFormValues>({
    resolver: createZodResolver(endingSoonSchema),
    defaultValues: {
      endingSoonCombineMode: "or",
      endingSoonTimeEnabled: true,
      endingSoonDaysThreshold: 7,
      endingSoonTicketsEnabled: true,
      endingSoonTicketsThreshold: 20,
      endingSoonTicketsMetric: "remaining",
    },
  });

  useEffect(() => {
    if (settingsResponse?.data) {
      const s = settingsResponse.data;
      settingsForm.reset({
        endingSoonCombineMode: s.endingSoonCombineMode ?? "or",
        endingSoonTimeEnabled: s.endingSoonTimeEnabled ?? true,
        endingSoonDaysThreshold: s.endingSoonDaysThreshold ?? 7,
        endingSoonTicketsEnabled: s.endingSoonTicketsEnabled ?? true,
        endingSoonTicketsThreshold: s.endingSoonTicketsThreshold ?? 20,
        endingSoonTicketsMetric: s.endingSoonTicketsMetric ?? "remaining",
      });
    }
  }, [settingsResponse, settingsForm]);

  const watchCombineMode = settingsForm.watch("endingSoonCombineMode");
  const watchTimeEnabled = settingsForm.watch("endingSoonTimeEnabled");
  const watchTicketsEnabled = settingsForm.watch("endingSoonTicketsEnabled");
  const watchDays = settingsForm.watch("endingSoonDaysThreshold");
  const watchTickets = settingsForm.watch("endingSoonTicketsThreshold");
  const watchMetric = settingsForm.watch("endingSoonTicketsMetric");

  const draftEndingSoonSettings = useMemo((): EndingSoonSettings | undefined => {
    const loaded = settingsResponse?.data;
    return {
      _id: "ending_soon_settings",
      endingSoonCombineMode: watchCombineMode,
      endingSoonTimeEnabled: watchTimeEnabled,
      endingSoonTicketsEnabled: watchTicketsEnabled,
      endingSoonTicketsMetric: watchMetric,
      endingSoonDaysThreshold: watchTimeEnabled
        ? watchDays
        : (loaded?.endingSoonDaysThreshold ?? 7),
      endingSoonTicketsThreshold: watchTicketsEnabled
        ? watchTickets
        : (loaded?.endingSoonTicketsThreshold ?? 20),
    };
  }, [
    watchCombineMode,
    watchTimeEnabled,
    watchTicketsEnabled,
    watchMetric,
    watchDays,
    watchTickets,
    settingsResponse?.data,
  ]);

  const endingSoonPreview = useMemo(
    () => filterEndingSoonCompetitions(previewCompetitions, draftEndingSoonSettings, { limit: 5 }),
    [previewCompetitions, draftEndingSoonSettings]
  );

  useEffect(() => {
    if (searchParams.get("create") !== "1") return;
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setFormError("");
    setDrawDateError("");
    setActiveTab("details");
    setShowSheet(true);
  }, [searchParams]);

  useEffect(() => {
    if (!showSheet || !editingId) {
      if (!editingId) {
        setForm(DEFAULT_FORM);
        setRawCompetition(null);
      }
      return;
    }

    setIsFetching(true);
    api
      .get<AdminCompetition>(`/api/admin/competitions/${editingId}`)
      .then((res) => {
        const comp = res.data;
        setRawCompetition(comp);
        const drawDateStr = comp?.drawDate
          ? format(new Date(comp.drawDate), "yyyy-MM-dd'T'HH:mm")
          : "";
        setForm({
          title: comp.title ?? "",
          subtitle: "",
          slug: comp.slug ?? "",
          shortDescription: comp.shortDescription ?? "",
          description: comp.description ?? "",
          category: comp.category ?? "",
          isCashOnly: comp.isCashOnly ?? false,
          requireSignIn: comp.requireSignIn ?? false,
          status: comp.status ?? "draft",
          prizeValue: comp.prizeValue ?? 0,
          ticketPrice: comp.ticketPrice ?? 0,
          originalPrice: comp.originalPrice ?? 0,
          hasOriginalPrice: !!comp.originalPrice,
          maxTickets: comp.maxTickets ?? 0,
          maxTicketsPerUser: comp.maxTicketsPerUser ?? 0,
          drawDate: drawDateStr,
          question: comp.question ?? "",
          questionOptions: comp.questionOptions ?? ["", "", "", ""],
          correctAnswer: Number(comp.correctAnswer ?? -1),
          images: (() => {
            const result: { url: string; roles: ("primary" | "hero" | "og" | "ref")[] }[] = [];
            if (comp.imageUrl) result.push({ url: comp.imageUrl, roles: ["primary"] });
            if (comp.heroImageUrl && comp.heroImageUrl !== comp.imageUrl) {
              result.push({ url: comp.heroImageUrl, roles: ["hero"] });
            }
            if (
              comp.ogImageUrl &&
              comp.ogImageUrl !== comp.imageUrl &&
              comp.ogImageUrl !== comp.heroImageUrl
            ) {
              const existing = result.find((i) => i.url === comp.ogImageUrl);
              if (existing) {
                existing.roles.push("og");
              } else {
                result.push({ url: comp.ogImageUrl, roles: ["og"] });
              }
            }
            if (
              comp.refOgImageUrl &&
              comp.refOgImageUrl !== comp.imageUrl &&
              comp.refOgImageUrl !== comp.heroImageUrl &&
              comp.refOgImageUrl !== comp.ogImageUrl
            ) {
              const existing = result.find((i) => i.url === comp.refOgImageUrl);
              if (existing) {
                existing.roles.push("ref");
              } else {
                result.push({ url: comp.refOgImageUrl, roles: ["ref"] });
              }
            }
            if (Array.isArray(comp.prizeImages)) {
              for (const url of comp.prizeImages) {
                if (!result.some((i) => i.url === url)) {
                  result.push({ url, roles: [] });
                }
              }
            }
            return result;
          })(),
          isFeatured: comp.isFeatured ?? false,
          displayOrder: comp.displayOrder ?? 0,
          currency: (comp.currency ?? "GBP") as "GBP" | "EUR",
          imageUrl: comp.imageUrl ?? "",
          categoryId: comp.category ?? "",
          name: "",
          label: "",
          iconName: "",
        });
        originalImagesRef.current = (() => {
          const urls: string[] = [];
          if (comp.imageUrl) urls.push(comp.imageUrl);
          if (comp.heroImageUrl && comp.heroImageUrl !== comp.imageUrl)
            urls.push(comp.heroImageUrl);
          if (
            comp.ogImageUrl &&
            comp.ogImageUrl !== comp.imageUrl &&
            comp.ogImageUrl !== comp.heroImageUrl
          )
            urls.push(comp.ogImageUrl);
          if (
            comp.refOgImageUrl &&
            comp.refOgImageUrl !== comp.imageUrl &&
            comp.refOgImageUrl !== comp.heroImageUrl &&
            comp.refOgImageUrl !== comp.ogImageUrl
          )
            urls.push(comp.refOgImageUrl);
          if (Array.isArray(comp.prizeImages)) urls.push(...comp.prizeImages);
          return urls;
        })();
      })
      .finally(() => setIsFetching(false));
  }, [showSheet, editingId]);

  useEffect(() => {
    if (form.drawDate && drawDateError) {
      setDrawDateError("");
    }
  }, [form.drawDate, drawDateError]);

  function handleNew() {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setRawCompetition(null);
    setFormError("");
    setDrawDateError("");
    setActiveTab("details");
    originalImagesRef.current = [];
    setShowSheet(true);
  }

  function handleEdit(comp: AdminCompetition) {
    setEditingId(comp._id);
    setFormError("");
    setDrawDateError("");
    setActiveTab("details");
    setShowSheet(true);
  }

  function handleClose() {
    const finalUrls = new Set((form.images ?? []).map((i) => i.url).filter(Boolean));
    const toDelete = [...sessionUrlsRef.current].filter((url) => !finalUrls.has(url));
    if (toDelete.length > 0) {
      Promise.all(
        toDelete.map((url) =>
          api.delete("/api/admin/media/assets", { params: { url } }).catch(() => {})
        )
      );
    }
    sessionUrlsRef.current = new Set();
    setShowSheet(false);
    setForm(DEFAULT_FORM);
    setRawCompetition(null);
    setFormError("");
    setDrawDateError("");
    setActiveTab("details");
    setEditingId(null);
  }

  // Returns true if any other (non-deleted) competition in the React Query
  // cache references this URL. Scans cached `["admin", "competitions"]` pages
  // (whatever's currently loaded). Tradeoff: pages that have never been
  // fetched are not visible to this check.
  function isUrlSharedByOtherCompetition(url: string): boolean {
    if (!url) return false;
    const queries = queryClient.getQueriesData<ApiResponse<AdminCompetition[]>>({
      queryKey: ["admin", "competitions"],
    });
    for (const [, cached] of queries) {
      const list = cached?.data ?? [];
      for (const c of list) {
        if (editingId && c._id === editingId) continue;
        if (c.prizeImages?.includes(url)) return true;
        if (c.imageUrl === url) return true;
        if (c.heroImageUrl === url) return true;
        if (c.prizeImageUrl === url) return true;
      }
    }
    return false;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");

    const validationError = validateCompetitionForm(form);
    if (validationError) {
      setFormError(validationError.error);
      setActiveTab(validationError.tab);
      if (validationError.error === "Draw date is required") {
        setDrawDateError(validationError.error);
      }
      return;
    }

    if (
      Number(form.ticketPrice) === 0 &&
      !window.confirm(
        `Ticket price is set to ${form.currency === "EUR" ? "\u20AC" : "\u00A3"}0.00. Are you sure?`
      )
    ) {
      return;
    }

    try {
      const drawDate = form.drawDate ? new Date(form.drawDate).toISOString() : undefined;
      const payload = {
        title: form.title,
        slug: form.slug || form.title.toLowerCase().replace(/\s+/g, "-"),
        shortDescription: form.shortDescription,
        description: form.description,
        category: form.category,
        isCashOnly: form.isCashOnly,
        requireSignIn: form.requireSignIn,
        status: form.status,
        prizeValue: Number(form.prizeValue) || 0,
        ticketPrice: Number(form.ticketPrice) || 0,
        maxTickets: Number(form.maxTickets) || 0,
        maxTicketsPerUser: Number(form.maxTicketsPerUser) || 0,
        endDate: drawDate,
        drawDate,
        question: form.question,
        questionOptions: form.questionOptions.filter((o) => o.trim() !== ""),
        correctAnswer: form.correctAnswer >= 0 ? form.correctAnswer : undefined,
        imageUrl: form.images.find((i) => i.roles.includes("primary"))?.url ?? undefined,
        heroImageUrl: form.images.find((i) => i.roles.includes("hero"))?.url ?? undefined,
        ogImageUrl: form.images.find((i) => i.roles.includes("og"))?.url ?? undefined,
        refOgImageUrl: form.images.find((i) => i.roles.includes("ref"))?.url ?? undefined,
        prizeImages: form.images.filter((i) => i.roles.length === 0).map((i) => i.url),
        isFeatured: form.isFeatured,
        displayOrder: Number(form.displayOrder) || 0,
        currency: form.currency,
        ...(form.hasOriginalPrice && Number(form.originalPrice) > 0
          ? { originalPrice: Number(form.originalPrice) }
          : {}),
      };

      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }

      // Find S3 files that were in the DB before this edit but are no longer
      // referenced by the saved form. Only run after a confirmed successful
      // mutation so that cancel/error paths never delete DB images.
      // The sessionUrlsRef cleanup in handleClose handles session uploads that
      // were discarded in the same session (not yet saved).
      const finalPool = (form.images ?? []).map((i) => i.url).filter(Boolean);
      const original = originalImagesRef.current;
      const orphans = original.filter((url) => !finalPool.includes(url));
      if (orphans.length > 0) {
        // Best-effort delete. The user already got their 200 from the server,
        // so we don't block on these. We also skip URLs that are still
        // referenced by any other (non-deleted) competition in the cache, to
        // avoid breaking shared assets.
        // Tradeoff: only checks URLs that are present in cached
        // ["admin", "competitions"] pages. If a URL is only used by a
        // competition on an uncached page, we won't detect the share and may
        // delete a still-needed file. We accept this small risk to avoid an
        // extra full-list fetch on every save.
        Promise.all(
          orphans
            .filter((url) => {
              const shared = isUrlSharedByOtherCompetition(url);
              return !shared;
            })
            .map((url) =>
              api.delete("/api/admin/media/assets", { params: { url } }).catch(() => {})
            )
        );
      }
      originalImagesRef.current = [];

      handleClose();

      if (payload.imageUrl) {
        const img = new Image();
        img.src = payload.imageUrl;
      }
      if (payload.heroImageUrl) {
        const img = new Image();
        img.src = payload.heroImageUrl;
      }
    } catch (err: unknown) {
      if (err instanceof ApiResponseError) {
        setFormError(err.message);
      } else {
        setFormError(err instanceof Error ? err.message : "Failed to save competition");
      }
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const target = e.target;
    const { name, value } = target;

    if (target instanceof HTMLInputElement) {
      if (target.type === "number") {
        setForm((prev) => ({ ...prev, [name]: value === "" ? 0 : Number(value) }));
        return;
      }
      if (target.type === "checkbox") {
        setForm((prev) => ({ ...prev, [name]: target.checked }));
        return;
      }
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  }

  const onSettingsSubmit = settingsForm.handleSubmit((values) => {
    saveSettingsMutation.mutate(values, {
      onSuccess: () => {
        toast.success("Ending soon settings saved");
        setSettingsOpen(false);
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save settings"),
    });
  });

  const isDeleted = (row: AdminCompetition) =>
    !!(row as unknown as { deletedAt?: unknown }).deletedAt;

  const columns: ColumnDef<AdminCompetition, unknown>[] = useMemo(
    () => [
      {
        id: "image",
        header: "Image",
        cell: ({ row }) => (
          <ImageCellComponent src={row.original.imageUrl} alt={row.original.title} size="sm" />
        ),
      },
      {
        id: "title",
        accessorKey: "title",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <div
              className={`flex items-center gap-2 truncate text-sm font-medium ${isDeleted(row.original) ? "line-through text-muted-foreground" : "text-foreground"}`}
            >
              {row.original.status === "drawn" && (
                <Trophy className="size-3.5 text-green-500 shrink-0" />
              )}
              {row.original.title}
              {isDeleted(row.original) ? <Badge variant="secondary">Deleted</Badge> : null}
            </div>
            <div className="truncate text-xs text-muted-foreground">{row.original.slug}</div>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge variant={getCompetitionStatusVariant(row.original.status)} showIcon={false}>
            {getCompetitionStatusLabel(row.original.status)}
          </StatusBadge>
        ),
      },
      {
        id: "category",
        header: "Category",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.category || "—"}</span>
        ),
      },
      {
        id: "prizeValue",
        accessorKey: "prizeValue",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Prize" />,
        cell: ({ row }) => (
          <PriceCell value={row.original.prizeValue} currency={row.original.currency} />
        ),
      },
      {
        id: "ticketPrice",
        accessorKey: "ticketPrice",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Ticket" />,
        cell: ({ row }) => (
          <PriceCell value={row.original.ticketPrice} currency={row.original.currency} />
        ),
      },
      {
        id: "tickets",
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tickets
          </span>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1.5 text-sm tabular-nums">
            <Trophy aria-hidden="true" className="size-3.5 text-gold" />
            <span>
              {row.original.ticketsSold}/{row.original.maxTickets}
            </span>
          </div>
        ),
      },
      {
        id: "drawDate",
        accessorKey: "drawDate",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Draw" />,
        cell: ({ row }) =>
          row.original.drawDate ? (
            <span className="text-sm text-muted-foreground">
              {format(new Date(row.original.drawDate), "d MMM yyyy, HH:mm")}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Competition actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {isDeleted(row.original) ? (
                <DropdownMenuItem
                  onSelect={() => {
                    restoreMutation.mutate(row.original._id, {
                      onSuccess: () => toast.success("Competition restored"),
                      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
                    });
                  }}
                  data-umami-event="competition:row-restore"
                >
                  <RefreshCw className="size-4" />
                  Restore
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem
                    onSelect={() => handleEdit(row.original)}
                    data-umami-event="competition:row-edit"
                  >
                    <Pencil className="size-4" />
                    Edit
                  </DropdownMenuItem>
                  {row.original.status !== "drawn" && row.original.status !== "cancelled" ? (
                    <DropdownMenuItem
                      onSelect={() => {
                        setSelectedCompetition({
                          _id: row.original._id,
                          title: row.original.title ?? "",
                          prizeValue: row.original.prizeValue ?? 0,
                          ticketsSold: row.original.ticketsSold ?? 0,
                          maxTickets: row.original.maxTickets ?? 0,
                          status: row.original.status ?? "",
                        });
                        setWinnerDialogOpen(true);
                      }}
                      data-umami-event="competition:select-winner"
                    >
                      <Trophy className="size-4" />
                      Select winner
                    </DropdownMenuItem>
                  ) : null}
                  {row.original.status !== "drawn" && row.original.status !== "cancelled" ? (
                    <DropdownMenuItem
                      onSelect={() => {
                        setSelectedVideoCompetition({
                          _id: row.original._id,
                          title: row.original.title ?? "",
                          landingPageVideoUrl: row.original.landingPageVideoUrl,
                        });
                        setVideoDialogOpen(true);
                      }}
                      data-umami-event="competition:upload-video"
                    >
                      <Film className="size-4" />
                      Upload video
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setDeleteTarget(row.original._id)}
                    data-umami-event="competition:row-delete"
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [deleteMutation.isPending, restoreMutation]
  );

  const tableData = useMemo(() => competitions, [competitions]);

  const totalActive = stats?.activeCompetitions ?? 0;
  const totalComps = stats?.totalCompetitions ?? 0;
  const totalPrize = stats?.totalPrizeValue ?? 0;

  return (
    <PageShell
      title="Competitions"
      description="Manage your prize competitions"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setSettingsOpen(true)}
            data-umami-event="competition:settings-open"
          >
            <Settings />
            Settings
          </Button>
          <Button onClick={handleNew} data-umami-event="competition:create-open">
            <Plus />
            New competition
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard
          label="Total competitions"
          value={isLoading ? "—" : totalComps.toLocaleString()}
          icon={Trophy}
          accent="primary"
          description={isLoading ? "Loading…" : `${totalActive} active right now`}
        />
        <StatCard
          label="Active competitions"
          value={isLoading ? "—" : totalActive.toLocaleString()}
          icon={Zap}
          accent="success"
          description="Currently running"
        />
        <StatCard
          label="Prize pool"
          value={
            isLoading
              ? "—"
              : new Intl.NumberFormat("en-GB", {
                  style: "currency",
                  currency: "GBP",
                  maximumFractionDigits: 0,
                }).format(totalPrize)
          }
          icon={Award}
          accent="warning"
          description="Total value"
        />
      </div>

      <DataTable<AdminCompetition>
        columns={columns}
        data={tableData}
        pageCount={pageCount}
        pagination={pagination}
        onPaginationChange={setPagination}
        manualSorting
        sorting={sorting}
        onSortingChange={handleSortingChange}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={onColumnVisibilityChange}
        isLoading={isLoading}
        emptyTitle="No competitions found"
        emptyDescription="Try clearing filters or creating your first competition."
        searchValue={globalFilter}
        onSearchChange={onGlobalFilterChange}
        searchPlaceholder="Search competitions…"
        enableRowSelection={true}
        enableGrouping={!!groupBy}
        grouping={grouping}
        rowClassName={(row) => {
          const comp = row as AdminCompetition;
          const classes = [];
          if (isDeleted(comp)) classes.push("opacity-50");
          if (comp.status === "drawn") classes.push("border-l-2 border-l-green-500/30");
          return classes.join(" ");
        }}
        bulkActions={bulkActions}
        exportConfig={{
          onExport: handleExportCompetitions,
          isExporting,
          umamiEvent: "competition:export-csv",
        }}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <AsyncCombobox
              value={categoryFilter}
              onValueChange={(value: string) => {
                setExtraFilterValue("category", value);
                setPagination((p) => ({ ...p, pageIndex: 0 }));
              }}
              queryKey="competition-category"
              fetchOptions={async (search: string) => {
                const res = await api.get<AdminCategory[]>("/api/admin/categories", {
                  params: { limit: 20, search },
                });
                const opts = (res.data ?? []).map((c) => ({
                  value: c._id,
                  label: c.name,
                }));
                if (!search) {
                  opts.unshift({ value: "all", label: "All categories" });
                }
                return opts;
              }}
              placeholder="All categories"
              className="w-[220px]"
            />

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                {FILTER_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <GroupBySelect
              value={groupBy}
              onValueChange={setGroupBy}
              options={GROUP_BY_OPTIONS}
              width="w-[180px]"
            />

            <ShowDeletedToggle
              id="show-deleted-competitions"
              checked={showDeleted}
              onCheckedChange={setShowDeleted}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                resetAll();
                setExtraFilterValue("category", "all");
              }}
              data-umami-event="competition:clear-filters"
            >
              Clear filters
            </Button>
          </div>
        }
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete competition"
        description="Are you sure you want to delete this competition? This action cannot be undone."
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        confirmDataUmamiEvent="competition:delete-confirm"
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget, {
              onSuccess: () => {
                toast.success("Competition deleted");
                setDeleteTarget(null);
              },
              onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
            });
          }
        }}
      />

      <ConfirmDialog
        open={bulkDeleteConfirm !== null}
        onOpenChange={(open) => !open && setBulkDeleteConfirm(null)}
        title="Delete competitions"
        description={`Delete ${bulkDeleteConfirm?.length ?? 0} competition(s)? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        confirmDataUmamiEvent="competition:bulk-delete-confirm"
        onConfirm={() => {
          if (bulkDeleteConfirm) {
            Promise.all(bulkDeleteConfirm.map((id) => deleteMutation.mutateAsync(id)))
              .then(() => {
                toast.success(`Deleted ${bulkDeleteConfirm.length} competition(s)`);
                setBulkDeleteConfirm(null);
              })
              .catch((err) => toast.error(err instanceof Error ? err.message : "Failed"));
          }
        }}
      />

      <CompetitionFormSheet
        open={showSheet}
        onOpenChange={setShowSheet}
        editingId={editingId}
        isPending={isPending}
        isFetching={isFetching}
        isUploading={isUploading}
        error={formError}
        onClose={handleClose}
        formId="competition-form"
        onSubmit={handleSubmit}
        editingCompetition={rawCompetition}
        onPointerDownOutside={(event: { preventDefault: () => void }) => {
          event.preventDefault();
        }}
      >
        <CompetitionFormTabs
          form={form}
          categories={categories}
          editingId={editingId}
          isFetching={isFetching}
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
          onChange={handleChange}
          onFormUpdate={(
            updater: CompetitionFormState | ((prev: CompetitionFormState) => CompetitionFormState)
          ) => setForm(updater)}
          onUploadsInFlightChange={setIsUploading}
          onSessionUploadedUrl={(url: string) => sessionUrlsRef.current.add(url)}
          drawDateError={drawDateError}
          ticketsSold={rawCompetition?.ticketsSold ?? 0}
        />
      </CompetitionFormSheet>

      <AddPrizeDrawer
        competitionId={prizeDrawer.competitionId}
        open={prizeDrawer.isOpen}
        onOpenChange={(open: boolean) => {
          if (!open) prizeDrawer.close();
        }}
        editingCip={prizeDrawer.editingCip}
      />

      <AddMilestoneDrawer
        competitionId={bonusDrawer.competitionId ?? ""}
        open={bonusDrawer.isOpen}
        onOpenChange={(open: boolean) => {
          if (!open) bonusDrawer.close();
        }}
        editingAssignmentId={bonusDrawer.editingAssignmentId}
        maxTickets={bonusDrawer.maxTickets}
        ticketsSold={bonusDrawer.ticketsSold ?? rawCompetition?.ticketsSold ?? 0}
      />

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent size="sm" className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Ending soon settings</DialogTitle>
            <DialogDescription>
              Choose which active competitions appear in the Ending Soon section on the customer
              site.
            </DialogDescription>
          </DialogHeader>
          <Form {...settingsForm}>
            <form id="settings-form" onSubmit={onSettingsSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={settingsForm.control}
                  name="endingSoonCombineMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Combine mode</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="or">OR — match either</SelectItem>
                          <SelectItem value="and">AND — match both</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>How the two conditions combine.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={settingsForm.control}
                  name="endingSoonTicketsMetric"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tickets metric</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="remaining">Remaining</SelectItem>
                          <SelectItem value="sold">Sold</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Card>
                <CardContent className="flex flex-col gap-3 p-4">
                  <FormField
                    control={settingsForm.control}
                    name="endingSoonTimeEnabled"
                    render={({ field }) => (
                      <FormItem
                        className="flex flex-row items-center justify-between rounded-lg border border-border p-3"
                        data-umami-event="competition:settings-toggle-time"
                      >
                        <div>
                          <FormLabel>By draw date</FormLabel>
                          <FormDescription>
                            Show competitions drawing within N days.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={settingsForm.control}
                    name="endingSoonDaysThreshold"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Days threshold</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            disabled={!watchTimeEnabled}
                            {...field}
                            value={field.value}
                            onChange={(e) => field.onChange(e.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex flex-col gap-3 p-4">
                  <FormField
                    control={settingsForm.control}
                    name="endingSoonTicketsEnabled"
                    render={({ field }) => (
                      <FormItem
                        className="flex flex-row items-center justify-between rounded-lg border border-border p-3"
                        data-umami-event="competition:settings-toggle-tickets"
                      >
                        <div>
                          <FormLabel>By ticket count</FormLabel>
                          <FormDescription>Show competitions close to selling out.</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={settingsForm.control}
                    name="endingSoonTicketsThreshold"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tickets threshold (0–100)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            disabled={!watchTicketsEnabled}
                            {...field}
                            value={field.value}
                            onChange={(e) => field.onChange(e.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm font-medium">Live preview</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {endingSoonPreview.length} active competition
                  {endingSoonPreview.length === 1 ? "" : "s"} would appear in the Ending Soon
                  section.
                </p>
                {endingSoonPreview.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-sm text-foreground">
                    {endingSoonPreview.map((comp) => (
                      <li key={comp._id} className="truncate">
                        {comp.title}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    No competitions match the current draft rules.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSettingsOpen(false)}
                  data-umami-event="competition:settings-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saveSettingsMutation.isPending}
                  data-umami-event="competition:settings-save"
                >
                  {saveSettingsMutation.isPending ? "Saving…" : "Save settings"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {selectedCompetition ? (
        <SelectWinnerDialog
          open={winnerDialogOpen}
          onOpenChange={(open: boolean) => {
            setWinnerDialogOpen(open);
            if (!open) setSelectedCompetition(null);
          }}
          competitionId={selectedCompetition._id}
          competitionTitle={selectedCompetition.title}
          prizeValue={selectedCompetition.prizeValue}
          ticketsSold={selectedCompetition.ticketsSold}
          maxTickets={selectedCompetition.maxTickets}
          status={selectedCompetition.status}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["admin", "competitions"] });
          }}
          dataUmamiEvent="competition:select-winner-confirm"
        />
      ) : null}

      <Dialog
        open={videoDialogOpen}
        onOpenChange={(open) => {
          setVideoDialogOpen(open);
          if (!open) setSelectedVideoCompetition(null);
        }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Upload landing page video</DialogTitle>
            <DialogDescription>
              {selectedVideoCompetition?.title
                ? `Add a promotional video for ${selectedVideoCompetition.title}.`
                : "Add a promotional video for this competition."}
            </DialogDescription>
          </DialogHeader>
          {selectedVideoCompetition ? (
            <VideoUpload
              competitionId={selectedVideoCompetition._id}
              value={selectedVideoCompetition.landingPageVideoUrl}
              onUpload={(url) => {
                if (url) {
                  queryClient.invalidateQueries({ queryKey: ["admin", "competitions"] });
                  setVideoDialogOpen(false);
                  setSelectedVideoCompetition(null);
                }
              }}
            />
          ) : null}
          <DialogClose asChild>
            <Button type="button" variant="secondary" className="mt-2 w-full">
              Cancel
            </Button>
          </DialogClose>
        </DialogContent>
      </Dialog>

      <CustomerDialog
        open={customerDialogOpen}
        onOpenChange={setCustomerDialogOpen}
        userId={selectedUserId}
      />
    </PageShell>
  );
}

import { MoreHorizontal, Pencil, Trash2 } from "@oc/icons";
// Local dropdown menu to keep the page self-contained.
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
