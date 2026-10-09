"use client";

import {
  useAdminCategories,
  useAdminCategoryMutations,
  useServerPagination,
} from "@oc/api-admin";
import { ArrowDown, ArrowUp, MoreHorizontal, Plus, RefreshCw, Trash2 } from "@oc/icons";
import type { AdminCategory } from "@oc/types";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { GroupBySelect } from "@/components/admin/GroupBySelect";
import { ShowDeletedToggle } from "@/components/admin/ShowDeletedToggle";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable } from "@/components/DataTable";
import { FormSheet } from "@/components/FormSheet";
import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useAdminTableURL, useColumnVisibility } from "@/hooks/use-admin-table-url";
import { useTableSort } from "@/hooks/use-table-sort";
import { handleFormError } from "@/lib/handle-form-error";
import { slugifyName } from "@/lib/slug";
import { createZodResolver } from "@/lib/zod-resolver";

const SORTABLE_HEADER_CLASS =
  "group flex w-full items-center gap-1 transition-colors hover:text-foreground";

function SortableHeader({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${SORTABLE_HEADER_CLASS} ${align === "right" ? "justify-end" : ""} ${
        active ? "text-foreground" : "text-muted-foreground"
      }`}
    >
      <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      <span
        className={`text-[10px] transition-opacity ${
          active ? "opacity-100" : "opacity-0 group-hover:opacity-50"
        }`}
        aria-hidden="true"
      >
        {dir === "asc" ? "▲" : "▼"}
      </span>
    </button>
  );
}

const CATEGORY_COLUMN_IDS = ["displayOrder", "name", "slug", "iconName", "isActive", "actions"];

const CATEGORY_GROUP_BY_OPTIONS = [{ value: "name", label: "Group by name" }];

const ICON_OPTIONS = [
  { value: "Smartphone", label: "Smartphone" },
  { value: "Car", label: "Car" },
  { value: "Watch", label: "Watch" },
  { value: "Zap", label: "Zap" },
  { value: "Trophy", label: "Trophy" },
];

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, digits, dashes only"),
  label: z.string().optional().or(z.literal("")),
  iconName: z.string().min(1, "Pick an icon"),
  description: z.string().optional().or(z.literal("")),
  isActive: z.boolean(),
});
type CategoryFormValues = z.infer<typeof categorySchema>;

const DEFAULT_FORM: CategoryFormValues = {
  name: "",
  slug: "",
  label: "",
  iconName: "Trophy",
  description: "",
  isActive: true,
};

export default function CategoriesAdminPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminCategory | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderList, setReorderList] = useState<AdminCategory[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);

  const tableState = useAdminTableURL({ defaultPageSize: 10 });
  const { sortField, sortDir, toggleSort } = useTableSort("displayOrder", "asc");
  const sorting: SortingState = sortField ? [{ id: sortField, desc: sortDir === "desc" }] : [];
  const handleSortingChange: React.Dispatch<React.SetStateAction<SortingState>> = (updater) => {
    const newSorting = typeof updater === "function" ? updater(sorting) : updater;
    if (newSorting[0]) {
      toggleSort(newSorting[0].id);
    }
  };
  const { columnVisibility, onColumnVisibilityChange } = useColumnVisibility(CATEGORY_COLUMN_IDS);
  const { groupBy, setGroupBy } = tableState;

  const [isExporting, setIsExporting] = useState(false);

  function handleExportCategories() {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (tableState.debouncedSearch) params.set("search", tableState.debouncedSearch);
      if (sortField) params.set("sortField", sortField);
      if (sortDir) params.set("sortDir", sortDir);
      window.open(`/api/admin/export/categories?${params.toString()}`, "_blank");
    } finally {
      setIsExporting(false);
    }
  }

  const grouping = useMemo(() => {
    if (!groupBy) return [];
    const mapping: Record<string, string> = {
      name: "name",
    };
    return mapping[groupBy] ? [mapping[groupBy]] : [];
  }, [groupBy]);

  const { data: categoriesResponse, isLoading } = useAdminCategories({
    page: tableState.pagination.pageIndex + 1,
    limit: tableState.pagination.pageSize,
    search: tableState.debouncedSearch,
    sortField,
    sortDir,
    showDeleted,
  });
  const { data: allCategoriesResponse, isLoading: isAllLoading } = useAdminCategories({
    page: 1,
    limit: 100,
    search: "",
    showDeleted,
  });
  const categories = categoriesResponse?.data ?? [];
  const allCategories = allCategoriesResponse?.data ?? [];
  const { pageCount } = useServerPagination(categoriesResponse?.meta);
  const {
    deleteMutation,
    createMutation,
    updateMutation,
    reorderCategoriesMutation,
    restoreMutation,
  } = useAdminCategoryMutations();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (!reorderMode) return;
    setReorderList(
      [...allCategories].sort(
        (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name)
      )
    );
  }, [reorderMode, allCategories]);

  const form = useForm<CategoryFormValues>({
    resolver: createZodResolver(categorySchema),
    defaultValues: DEFAULT_FORM,
  });

  useEffect(() => {
    if (editing) {
      form.reset({
        name: editing.name,
        slug: editing.slug,
        label: editing.label || editing.name,
        iconName: editing.iconName || "Trophy",
        description: editing.description || "",
        isActive: editing.isActive ?? true,
      });
    } else if (sheetOpen) {
      form.reset(DEFAULT_FORM);
    }
  }, [editing, sheetOpen, form]);

  // Auto-slug from name when slug field hasn't been manually edited
  const watchedName = form.watch("name");
  useEffect(() => {
    if (editing) return;
    const slugField = form.getValues("slug");
    if (!slugField || slugField === slugifyName(form.formState.defaultValues?.name ?? "")) {
      form.setValue("slug", slugifyName(watchedName));
    }
  }, [watchedName, editing, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const payload = {
      name: values.name,
      slug: values.slug || slugifyName(values.name),
      label: values.label || values.name,
      iconName: values.iconName,
      description: values.description || undefined,
      isActive: values.isActive,
    };
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing._id, payload });
        toast.success("Category updated");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Category created");
      }
      setSheetOpen(false);
      setEditing(null);
    } catch (err: unknown) {
      const msg = handleFormError(form, err);
      if (msg) toast.error(msg);
      if (!msg) toast.error("Please check the highlighted fields");
    }
  });

  function moveCategory(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= reorderList.length) return;
    setReorderList((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      if (!item) return prev;
      next.splice(nextIndex, 0, item);
      return next;
    });
  }

  async function handleSaveReorder() {
    try {
      await reorderCategoriesMutation.mutateAsync(reorderList.map((c) => c._id));
      toast.success("Category order saved");
      setReorderMode(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save order");
    }
  }

  const isDeleted = (row: AdminCategory) => !!(row as unknown as { deletedAt?: unknown }).deletedAt;

  const columns: ColumnDef<AdminCategory>[] = useMemo(
    () => [
      {
        id: "displayOrder",
        accessorKey: "displayOrder",
        header: () => (
          <SortableHeader
            label="Order"
            active={sortField === "displayOrder"}
            dir={sortDir}
            onClick={() => toggleSort("displayOrder")}
          />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums text-sm text-muted-foreground">
            {row.original.displayOrder ?? 0}
          </span>
        ),
      },
      {
        id: "name",
        accessorKey: "name",
        header: () => (
          <SortableHeader
            label="Name"
            active={sortField === "name"}
            dir={sortDir}
            onClick={() => toggleSort("name")}
          />
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span
              className={`font-medium ${isDeleted(row.original) ? "line-through text-muted-foreground" : ""}`}
            >
              {row.original.name}
            </span>
            {isDeleted(row.original) ? <Badge variant="secondary">Deleted</Badge> : null}
          </div>
        ),
      },
      {
        id: "slug",
        accessorKey: "slug",
        header: () => (
          <SortableHeader
            label="Slug"
            active={sortField === "slug"}
            dir={sortDir}
            onClick={() => toggleSort("slug")}
          />
        ),
        cell: ({ row }) => (
          <code className="rounded bg-muted/50 px-2 py-0.5 font-mono text-xs text-muted-foreground">
            {row.original.slug}
          </code>
        ),
      },
      {
        id: "iconName",
        accessorKey: "iconName",
        header: "Icon",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.iconName || "Trophy"}</span>
        ),
      },
      {
        id: "isActive",
        accessorKey: "isActive",
        header: "Active",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.isActive === false ? "No" : "Yes"}</span>
        ),
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
              {isDeleted(row.original) ? (
                <DropdownMenuItem
                  onClick={() => {
                    restoreMutation.mutate(row.original._id, {
                      onSuccess: () => toast.success("Category restored"),
                      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
                    });
                  }}
                  data-umami-event="category:row-restore"
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
                    data-umami-event="category:row-edit"
                  >
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteTarget(row.original)}
                    data-umami-event="category:row-delete"
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
    [sortField, sortDir, toggleSort, restoreMutation]
  );

  return (
    <PageShell
      title="Categories"
      description="Manage competition categories and homepage section order."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={reorderMode ? "default" : "outline"}
            onClick={() => setReorderMode((v) => !v)}
            data-umami-event="category:toggle-reorder-mode"
          >
            {reorderMode ? "Back to table" : "Reorder categories"}
          </Button>
          {reorderMode ? (
            <Button
              onClick={handleSaveReorder}
              disabled={reorderCategoriesMutation.isPending}
              data-umami-event="category:save-order"
            >
              Save order
            </Button>
          ) : (
            <Button
              onClick={() => {
                setEditing(null);
                setSheetOpen(true);
              }}
              data-umami-event="category:create-open"
            >
              <Plus className="size-4" />
              New category
            </Button>
          )}
        </div>
      }
    >
      {reorderMode ? (
        <Card>
          <CardContent className="p-4">
            <p className="mb-4 text-sm text-muted-foreground">
              Categories appear on the homepage in this order. Use the arrows to move items up or
              down, then save.
            </p>
            {isAllLoading ? (
              <p className="text-sm text-muted-foreground">Loading categories…</p>
            ) : reorderList.length === 0 ? (
              <p className="text-sm text-muted-foreground">No categories yet.</p>
            ) : (
              <ul className="space-y-2">
                {reorderList.map((cat, index) => (
                  <li
                    key={cat._id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 transition-colors hover:border-primary/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {cat.label || cat.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{cat.slug}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        disabled={index === 0}
                        onClick={() => moveCategory(index, -1)}
                        aria-label={`Move ${cat.name} up`}
                        data-umami-event="category:move-up"
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        disabled={index === reorderList.length - 1}
                        onClick={() => moveCategory(index, 1)}
                        aria-label={`Move ${cat.name} down`}
                        data-umami-event="category:move-down"
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={categories}
          pageCount={pageCount}
          pagination={tableState.pagination}
          onPaginationChange={tableState.setPagination}
          manualSorting
          sorting={sorting}
          onSortingChange={handleSortingChange}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={onColumnVisibilityChange}
          isLoading={isLoading}
          searchValue={tableState.searchInput}
          onSearchChange={tableState.onSearchChange}
          searchPlaceholder="Search categories…"
          emptyTitle="No categories"
          emptyDescription="Create your first category to get started."
          enableGrouping={!!groupBy}
          grouping={grouping}
          rowClassName={(row) => (isDeleted(row as AdminCategory) ? "opacity-50" : "")}
          exportConfig={{
            onExport: handleExportCategories,
            isExporting,
            umamiEvent: "category:export-csv",
          }}
          toolbar={
            <div className="flex items-center gap-2">
              <ShowDeletedToggle
                id="show-deleted-categories"
                checked={showDeleted}
                onCheckedChange={setShowDeleted}
                umamiEvent="category:show-deleted-toggle"
              />
              <GroupBySelect
                value={groupBy}
                onValueChange={setGroupBy}
                options={CATEGORY_GROUP_BY_OPTIONS}
                width="w-[180px]"
              />
            </div>
          }
        />
      )}

      <FormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setEditing(null);
        }}
        title={editing ? "Edit category" : "New category"}
        description={editing ? "Update category details" : "Create a new competition category."}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        submitButtonUmami="category:form-submit"
        submitButtonDataAttrs={{ "data-umami-event-mode": editing ? "edit" : "create" }}
      >
        <Form {...form}>
          <div className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Category name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="auto-from-name" />
                  </FormControl>
                  <FormDescription>Lowercase letters, digits, dashes only.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Label</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Display label (defaults to name)" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="iconName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Icon</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ICON_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                      placeholder="Optional description for admin reference"
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <FormLabel className="cursor-pointer">Active</FormLabel>
                    <FormDescription>
                      Inactive categories are hidden from the homepage.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-umami-event="category:toggle-active"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </Form>
      </FormSheet>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete category"
        description={
          <>
            Delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
          </>
        }
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget._id, {
              onSuccess: () => {
                toast.success("Category deleted");
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
