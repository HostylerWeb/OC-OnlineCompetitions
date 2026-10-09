"use client";

import {
  ApiResponseError,
  useAdminShopCategories,
  useAdminShopCategoryMutations,
  useServerPagination,
} from "@oc/api-admin";
import { MoreHorizontal, Plus, RefreshCw, Trash2, X } from "@oc/icons";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ShowDeletedToggle } from "@/components/admin/ShowDeletedToggle";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable } from "@/components/DataTable";
import { FormSheet } from "@/components/FormSheet";
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
import { useAdminTableURL, useColumnVisibility } from "@/hooks/use-admin-table-url";
import { useTableSort } from "@/hooks/use-table-sort";
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

const CATEGORY_COLUMN_IDS = [
  "name",
  "slug",
  "description",
  "sortOrder",
  "productCount",
  "isActive",
  "actions",
];

interface ShopCategoryRow {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: string;
  productCount?: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, digits, dashes only"),
  description: z.string().optional().or(z.literal("")),
  sortOrder: z.coerce.number().int(),
  image: z.string().optional().or(z.literal("")),
  parentId: z.string().optional().or(z.literal("")),
  isActive: z.boolean(),
});
type CategoryFormValues = z.infer<typeof categorySchema>;

const DEFAULT_FORM: CategoryFormValues = {
  name: "",
  slug: "",
  description: "",
  sortOrder: 0,
  image: "",
  parentId: "",
  isActive: true,
};

export default function ShopCategoriesAdminPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ShopCategoryRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ShopCategoryRow | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  const tableState = useAdminTableURL({ defaultPageSize: 10 });
  const { sortField, sortDir, toggleSort } = useTableSort("sortOrder", "asc");
  const sorting: SortingState = sortField ? [{ id: sortField, desc: sortDir === "desc" }] : [];
  const handleSortingChange: React.Dispatch<React.SetStateAction<SortingState>> = (updater) => {
    const newSorting = typeof updater === "function" ? updater(sorting) : updater;
    if (newSorting[0]) {
      toggleSort(newSorting[0].id);
    }
  };
  const { columnVisibility, onColumnVisibilityChange } = useColumnVisibility(CATEGORY_COLUMN_IDS);

  const { data: categoriesResponse, isLoading } = useAdminShopCategories({
    page: tableState.pagination.pageIndex + 1,
    limit: tableState.pagination.pageSize,
    search: tableState.debouncedSearch,
    sortField,
    sortDir,
    showDeleted,
  });
  const categories = (categoriesResponse?.data ?? []) as unknown as ShopCategoryRow[];
  const { pageCount } = useServerPagination(categoriesResponse?.meta);
  const { deleteMutation, createMutation, updateMutation, restoreMutation } =
    useAdminShopCategoryMutations();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const form = useForm<CategoryFormValues>({
    resolver: createZodResolver(categorySchema),
    defaultValues: DEFAULT_FORM,
  });

  useEffect(() => {
    if (editing) {
      form.reset({
        name: editing.name,
        slug: editing.slug,
        description: editing.description || "",
        sortOrder: editing.sortOrder ?? 0,
        image: editing.image || "",
        parentId: editing.parentId || "",
        isActive: editing.isActive ?? true,
      });
    } else if (sheetOpen) {
      form.reset(DEFAULT_FORM);
    }
  }, [editing, sheetOpen, form]);

  const watchedName = form.watch("name");
  useEffect(() => {
    if (editing) return;
    const slugField = form.getValues("slug");
    if (!slugField || slugField === slugifyName(form.formState.defaultValues?.name ?? "")) {
      form.setValue("slug", slugifyName(watchedName));
    }
  }, [watchedName, editing, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const payload: Record<string, unknown> = {
      name: values.name,
      slug: values.slug || slugifyName(values.name),
      description: values.description || undefined,
      sortOrder: values.sortOrder,
      image: values.image || undefined,
      parentId: values.parentId || undefined,
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
      const message =
        err instanceof ApiResponseError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to save category";
      toast.error(message);
    }
  });

  const isDeleted = (row: ShopCategoryRow) => !!row.deletedAt;

  const columns: ColumnDef<ShopCategoryRow>[] = useMemo(
    () => [
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
        id: "description",
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => (
          <span className="max-w-[200px] truncate text-sm text-muted-foreground">
            {row.original.description || "-"}
          </span>
        ),
      },
      {
        id: "sortOrder",
        accessorKey: "sortOrder",
        header: () => (
          <SortableHeader
            label="Sort Order"
            active={sortField === "sortOrder"}
            dir={sortDir}
            onClick={() => toggleSort("sortOrder")}
          />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums text-sm text-muted-foreground">
            {row.original.sortOrder ?? 0}
          </span>
        ),
      },
      {
        id: "productCount",
        header: "Products",
        cell: ({ row }) => (
          <span className="text-sm tabular-nums text-muted-foreground">
            {row.original.productCount ?? 0}
          </span>
        ),
        enableSorting: false,
      },
      {
        id: "isActive",
        accessorKey: "isActive",
        header: () => (
          <SortableHeader
            label="Status"
            active={sortField === "isActive"}
            dir={sortDir}
            onClick={() => toggleSort("isActive")}
          />
        ),
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.isActive === false ? (
              <span className="text-muted-foreground">Inactive</span>
            ) : (
              <span className="text-green-600 dark:text-green-400">Active</span>
            )}
          </span>
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
                      onError: (err: Error) => toast.error(err.message),
                    });
                  }}
                  data-umami-event="shop-category:row-restore"
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
                    data-umami-event="shop-category:row-edit"
                  >
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteTarget(row.original)}
                    data-umami-event="shop-category:row-delete"
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
      title="Shop Categories"
      description="Manage product categories for the shop."
      actions={
        <Button
          onClick={() => {
            setEditing(null);
            setSheetOpen(true);
          }}
          data-umami-event="shop-category:create-open"
        >
          <Plus className="size-4" />
          New category
        </Button>
      }
    >
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
        emptyDescription="Create your first shop category to get started."
        rowClassName={(row) => (isDeleted(row as unknown as ShopCategoryRow) ? "opacity-50" : "")}
        toolbar={
          <div className="flex items-center gap-2">
            <ShowDeletedToggle
              id="show-deleted-categories"
              checked={showDeleted}
              onCheckedChange={setShowDeleted}
              umamiEvent="shop-category:show-deleted-toggle"
            />
          </div>
        }
      />

      <FormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setEditing(null);
        }}
        title={editing ? "Edit category" : "New category"}
        description={editing ? "Update category details" : "Create a new shop category."}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        submitButtonUmami="shop-category:form-submit"
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
              name="sortOrder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sort Order</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} placeholder="0" />
                  </FormControl>
                  <FormDescription>Categories are sorted ascending by this value.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent category</FormLabel>
                  <Select
                    value={field.value || "none"}
                    onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="No parent" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No parent</SelectItem>
                      {categories
                        .filter((c) => c._id !== editing?._id)
                        .map((cat) => (
                          <SelectItem key={cat._id} value={cat._id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Optional parent category for hierarchy.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="image"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image</FormLabel>
                  <FormDescription>Optional category image.</FormDescription>
                  {field.value ? (
                    <div className="group relative w-fit">
                      <div className="relative h-24 w-36 overflow-hidden rounded-lg border border-border">
                        <ImagePreview
                          src={field.value}
                          alt="Category image"
                          className="h-full w-full"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => form.setValue("image", "")}
                        className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow-xs transition-opacity hover:opacity-100 group-hover:opacity-100"
                      >
                        <X className="size-3" />
                        <span className="sr-only">Remove</span>
                      </button>
                    </div>
                  ) : null}
                  <ImageUpload
                    slug={`shop-category-${Date.now()}`}
                    onUpload={(url) => form.setValue("image", url)}
                    onError={(msg) => toast.error(msg)}
                  />
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
                    <FormDescription>Inactive categories are hidden from the shop.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
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
              onError: (err: Error) => toast.error(err.message),
            });
          }
        }}
      />
    </PageShell>
  );
}
