"use client";

import type { ShopProductOption, ShopProductVariant } from "@oc/api-admin";
import {
  ApiResponseError,
  useAdminShopCategories,
  useAdminShopProductMutations,
  useAdminShopProducts,
  useAdminShopProductVariantMutations,
  useAdminShopProductVariants,
  useServerPagination,
} from "@oc/api-admin";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Filter,
  Image as ImageIcon,
  Layers,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "@oc/icons";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ShowDeletedToggle } from "@/components/admin/ShowDeletedToggle";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable } from "@/components/DataTable";
import { FormSheet } from "@/components/FormSheet";
import { ImagePreview } from "@/components/image-preview";
import { ImageUpload } from "@/components/image-upload";
import { S3FilePicker } from "@/components/media/S3FilePicker";
import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { slugifyName } from "@/lib/slug";
import { createZodResolver } from "@/lib/zod-resolver";

interface ShopProductRow {
  _id: string;
  name: string;
  slug: string;
  shortDescription?: string;
  description?: string;
  price: number;
  compareAtPrice?: number;
  sku: string;
  inventory: number;
  inventoryTracked: boolean;
  categoryId?: string;
  images: string[];
  options?: ShopProductOption[];
  lowStockThreshold?: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

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

function formatPrice(value: number | undefined | null): string {
  if (value == null) return "—";
  return `£${(value / 100).toFixed(2)}`;
}

const SORTABLE_FIELDS = ["name", "sku", "price", "inventory", "sortOrder", "createdAt"];

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, digits, dashes only"),
  shortDescription: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  price: z.coerce.number().min(0, "Price must be >= 0"),
  compareAtPrice: z.coerce.number().min(0).optional().or(z.literal("")),
  sku: z.string().min(1, "SKU is required"),
  inventory: z.coerce.number().int().min(0, "Must be >= 0"),
  inventoryTracked: z.boolean(),
  categoryId: z.string().optional().or(z.literal("")),
  images: z.array(z.string()),
  lowStockThreshold: z.coerce.number().int().min(0).optional().or(z.literal("")),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int(),
});
type ProductFormValues = z.infer<typeof productSchema>;

const DEFAULT_FORM: ProductFormValues = {
  name: "",
  slug: "",
  shortDescription: "",
  description: "",
  price: 0,
  compareAtPrice: "",
  sku: "",
  inventory: 0,
  inventoryTracked: true,
  categoryId: "",
  images: [],
  lowStockThreshold: 5,
  isActive: true,
  sortOrder: 0,
};

const PRESET_OPTIONS: Array<{ name: string; values: string[]; type?: "color" }> = [
  { name: "Color", values: ["Black", "White"], type: "color" },
  { name: "Size", values: ["S", "M", "L", "XL"] },
  { name: "Material", values: ["Cotton", "Polyester"] },
];

function generateSkuSuffixes(optionValues: string[]): string {
  return optionValues
    .map(
      (v) =>
        v
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 4) || "X"
    )
    .join("-");
}

function cartesianProduct<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]];
  return arrays.reduce<T[][]>(
    (acc, curr) => acc.flatMap((combo) => curr.map((item) => [...combo, item])),
    [[]]
  );
}

interface VariantRowProps {
  variant: ShopProductVariant;
  parentPrice?: number;
  parentImages: string[];
  isOrphan: boolean;
  onUpdate: (id: string, payload: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onOpenImages: (variant: ShopProductVariant) => void;
  isSelected: boolean;
  onSelectChange: (id: string, checked: boolean) => void;
  isUpdating: boolean;
}

function VariantRow({
  variant,
  parentPrice,
  parentImages,
  isOrphan,
  onUpdate,
  onDelete,
  onOpenImages,
  isSelected,
  onSelectChange,
  isUpdating,
}: VariantRowProps) {
  const [price, setPrice] = useState(variant.price?.toString() ?? "");
  const [compareAtPrice, setCompareAtPrice] = useState(variant.compareAtPrice?.toString() ?? "");
  const [inventory, setInventory] = useState(variant.inventory.toString());
  const [inventoryTracked, setInventoryTracked] = useState(variant.inventoryTracked);
  const [isActive, setIsActive] = useState(variant.isActive);
  const [sku, setSku] = useState(variant.sku);

  useEffect(() => {
    setPrice(variant.price?.toString() ?? "");
    setCompareAtPrice(variant.compareAtPrice?.toString() ?? "");
    setInventory(variant.inventory.toString());
    setInventoryTracked(variant.inventoryTracked);
    setIsActive(variant.isActive);
    setSku(variant.sku);
  }, [variant]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedUpdate = useCallback(
    (payload: Record<string, unknown>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onUpdate(variant._id, payload), 400);
    },
    [onUpdate, variant._id]
  );

  const variantImageCount = variant.images.length > 0 ? variant.images.length : parentImages.length;
  const isUsingParentImages = variant.images.length === 0;

  return (
    <tr
      className={`border-b border-border/60 hover:bg-muted/30 ${
        isOrphan ? "opacity-60" : ""
      } ${isUpdating ? "bg-muted/40" : ""}`}
    >
      <td className="sticky left-0 z-10 bg-card px-3 py-2 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)]">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelectChange(variant._id, !!checked)}
          aria-label={`Select variant ${variant.name}`}
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <Input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            onBlur={() => {
              if (sku !== variant.sku) onUpdate(variant._id, { sku });
            }}
            className="h-8 w-32 font-mono text-xs"
          />
          {isOrphan && (
            <Badge variant="destructive" className="text-[10px] whitespace-nowrap">
              <AlertTriangle className="mr-1 size-3" />
              Option removed
            </Badge>
          )}
          {isUpdating && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
        </div>
      </td>
      <td className="px-3 py-2 text-sm">
        <div className="flex flex-col">
          <span>{variant.name}</span>
          {variant.optionValues.length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {variant.optionValues.map((ov) => `${ov.optionName}: ${ov.value}`).join(" · ")}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <Input
          type="number"
          min="0"
          step="1"
          className="h-8 w-24"
          value={price}
          placeholder={parentPrice != null ? String(parentPrice) : ""}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={() => {
            const val = price === "" ? undefined : Number(price);
            if (val !== variant.price) onUpdate(variant._id, { price: val });
          }}
        />
      </td>
      <td className="px-3 py-2">
        <Input
          type="number"
          min="0"
          step="1"
          className="h-8 w-24"
          value={compareAtPrice}
          placeholder="—"
          onChange={(e) => setCompareAtPrice(e.target.value)}
          onBlur={() => {
            const val = compareAtPrice === "" ? undefined : Number(compareAtPrice);
            if (val !== variant.compareAtPrice) onUpdate(variant._id, { compareAtPrice: val });
          }}
        />
      </td>
      <td className="px-3 py-2">
        <Input
          type="number"
          min="0"
          step="1"
          className="h-8 w-20"
          value={inventory}
          onChange={(e) => setInventory(e.target.value)}
          onBlur={() => {
            const val = Number(inventory);
            if (val !== variant.inventory) onUpdate(variant._id, { inventory: val });
          }}
        />
      </td>
      <td className="px-3 py-2">
        <Switch
          checked={inventoryTracked}
          onCheckedChange={(checked) => {
            setInventoryTracked(checked);
            debouncedUpdate({ inventoryTracked: checked });
          }}
        />
      </td>
      <td className="px-3 py-2">
        <Switch
          checked={isActive}
          onCheckedChange={(checked) => {
            setIsActive(checked);
            onUpdate(variant._id, { isActive: checked });
          }}
        />
      </td>
      <td className="px-3 py-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              onClick={(e) => {
                e.preventDefault();
                onOpenImages(variant);
              }}
            >
              <ImageIcon className="size-3" />
              <span className="text-xs">{variantImageCount}</span>
            </Button>
          </PopoverTrigger>
        </Popover>
        {isUsingParentImages && (
          <span className="ml-1 text-[10px] text-muted-foreground">parent</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={false}
          onClick={() => onDelete(variant._id)}
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </td>
    </tr>
  );
}

interface VariantImagesPopoverProps {
  variant: ShopProductVariant | null;
  parentImages: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, images: string[]) => void;
  isSaving: boolean;
  productSlug: string;
}

function VariantImagesPopover({
  variant,
  parentImages,
  open,
  onOpenChange,
  onSave,
  isSaving,
  productSlug,
}: VariantImagesPopoverProps) {
  const [images, setImages] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (variant) setImages(variant.images.length > 0 ? [...variant.images] : [...parentImages]);
  }, [variant, parentImages]);

  if (!variant) return null;

  const isUsingParent = images.length === 0;
  const displayImages = images.length > 0 ? images : parentImages;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild />
      <PopoverContent className="w-96 p-4" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Variant images</p>
              <p className="text-xs text-muted-foreground">{variant.name}</p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => onOpenChange(false)}>
              <X className="size-4" />
            </Button>
          </div>

          {displayImages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {displayImages.map((url, i) => (
                <div key={i} className="group relative">
                  <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-border">
                    <ImagePreview src={url} alt={`Variant ${i + 1}`} className="h-full w-full" />
                  </div>
                  {!isUsingParent && (
                    <button
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow-xs transition-opacity hover:opacity-100 group-hover:opacity-100"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {isUsingParent && parentImages.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Using parent product images. Upload or pick images to override.
            </p>
          )}

          <ImageUpload
            slug={`variant-${productSlug}-${variant._id}`}
            onUpload={(url) => {
              if (url && !images.includes(url)) setImages((prev) => [...prev, url]);
            }}
            onError={(msg) => toast.error(msg)}
          />

          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="text-xs font-medium text-gold hover:text-gold-light transition-colors self-start"
          >
            Browse Storage →
          </button>

          <S3FilePicker
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onSelect={(urls) => {
              setImages((prev) => [...new Set([...prev, ...urls])]);
            }}
            multiple
            selectedUrls={images}
          />

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            {images.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setImages([])}>
                Use parent
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSaving}
              onClick={() => {
                onSave(variant._id, images);
                onOpenChange(false);
              }}
            >
              {isSaving ? <Loader2 className="size-3 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface OptionsEditorProps {
  options: ShopProductOption[];
  onChange: (options: ShopProductOption[]) => void;
  existingVariantOptionValues: Set<string>;
}

function OptionsEditor({ options, onChange, existingVariantOptionValues }: OptionsEditorProps) {
  const [newValueInputs, setNewValueInputs] = useState<Record<number, string>>({});

  const addPreset = (preset: { name: string; values: string[]; type?: "color" }) => {
    if (options.some((o) => o.name.toLowerCase() === preset.name.toLowerCase())) {
      toast.error(`"${preset.name}" option already exists`);
      return;
    }
    onChange([
      ...options,
      {
        name: preset.name,
        values: preset.values.map((v) => ({
          value: v,
          ...(preset.type ? { metadata: { type: preset.type } } : {}),
        })),
      },
    ]);
  };

  const addOption = () => {
    onChange([...options, { name: "", values: [] }]);
  };

  const removeOption = (idx: number) => {
    onChange(options.filter((_, i) => i !== idx));
  };

  const updateOptionName = (idx: number, name: string) => {
    onChange(options.map((o, i) => (i === idx ? { ...o, name } : o)));
  };

  const addValue = (idx: number) => {
    const input = (newValueInputs[idx] ?? "").trim();
    if (!input) return;
    onChange(
      options.map((o, i) => {
        if (i !== idx) return o;
        if (o.values.some((v) => v.value.toLowerCase() === input.toLowerCase())) return o;
        return { ...o, values: [...o.values, { value: input }] };
      })
    );
    setNewValueInputs((prev) => ({ ...prev, [idx]: "" }));
  };

  const removeValue = (optionIdx: number, valueIdx: number) => {
    onChange(
      options.map((o, i) => {
        if (i !== optionIdx) return o;
        return { ...o, values: o.values.filter((_, j) => j !== valueIdx) };
      })
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Quick add:</span>
        {PRESET_OPTIONS.map((p) => (
          <Button
            key={p.name}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => addPreset(p)}
            className="h-7 text-xs"
          >
            <Sparkles className="mr-1 size-3" />
            {p.name}
          </Button>
        ))}
        <Button type="button" size="sm" variant="ghost" onClick={addOption} className="h-7 text-xs">
          <Plus className="mr-1 size-3" />
          Custom
        </Button>
      </div>

      {options.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          No options yet. Use the quick-add buttons above or "Custom" to start.
        </p>
      ) : (
        <div className="space-y-2">
          {options.map((opt, i) => {
            const removedValues = opt.values.filter(
              (v) => !existingVariantOptionValues.has(`${opt.name}::${v.value}`)
            );
            const orphanWarning =
              removedValues.length > 0 && existingVariantOptionValues.size > 0
                ? `${removedValues.length} variant${removedValues.length !== 1 ? "s" : ""} will be disabled when you save.`
                : null;
            return (
              <div
                key={i}
                className="rounded-lg border border-border bg-card p-3 transition-colors"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Input
                    value={opt.name}
                    placeholder="Option name (e.g. Color)"
                    onChange={(e) => updateOptionName(i, e.target.value)}
                    className="h-8 max-w-[180px] text-sm font-medium"
                  />
                  <span className="text-xs text-muted-foreground">
                    {opt.values.length} value{opt.values.length !== 1 ? "s" : ""}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeOption(i)}
                    className="ml-auto"
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {opt.values.map((v, j) => (
                    <Badge
                      key={j}
                      variant="secondary"
                      className="gap-1 pr-1"
                      style={
                        v.metadata &&
                        typeof v.metadata === "object" &&
                        "type" in v.metadata &&
                        v.metadata.type === "color"
                          ? { borderLeft: `3px solid ${v.value.toLowerCase()}` }
                          : undefined
                      }
                    >
                      {v.value}
                      <button
                        type="button"
                        onClick={() => removeValue(i, j)}
                        className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                  <div className="flex items-center gap-1">
                    <Input
                      value={newValueInputs[i] ?? ""}
                      placeholder="Add value"
                      className="h-7 w-28 text-xs"
                      onChange={(e) =>
                        setNewValueInputs((prev) => ({ ...prev, [i]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addValue(i);
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => addValue(i)}
                      disabled={!(newValueInputs[i] ?? "").trim()}
                    >
                      <Plus className="size-3" />
                    </Button>
                  </div>
                </div>
                {orphanWarning && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-warning">
                    <AlertTriangle className="size-3" />
                    {orphanWarning}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ShopProductsAdminPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ShopProductRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ShopProductRow | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [imageBlurs, setImageBlurs] = useState<Record<string, string>>({});
  const [productOptions, setProductOptions] = useState<ShopProductOption[]>([]);
  const [optionsOpen, setOptionsOpen] = useState(true);
  const [variantsOpen, setVariantsOpen] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());
  const [imagesVariant, setImagesVariant] = useState<ShopProductVariant | null>(null);
  const [imagesPopoverOpen, setImagesPopoverOpen] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [diffPreview, setDiffPreview] = useState<{
    newCount: number;
    orphanCount: number;
    skippedCount: number;
    newVariants: Array<{
      name: string;
      sku: string;
      optionValues: Array<{ optionName: string; value: string }>;
    }>;
  } | null>(null);

  const tableState = useAdminTableURL({ defaultPageSize: 10 });
  const { sortField, sortDir, toggleSort } = useTableSort("sortOrder", "asc");
  const sorting: SortingState = sortField ? [{ id: sortField, desc: sortDir === "desc" }] : [];
  const handleSortingChange: React.Dispatch<React.SetStateAction<SortingState>> = (updater) => {
    const newSorting = typeof updater === "function" ? updater(sorting) : updater;
    if (newSorting[0]) {
      toggleSort(newSorting[0].id);
    }
  };

  const { data: productsResponse, isLoading } = useAdminShopProducts({
    page: tableState.pagination.pageIndex + 1,
    limit: tableState.pagination.pageSize,
    search: tableState.debouncedSearch,
    sortField: SORTABLE_FIELDS.includes(sortField) ? sortField : undefined,
    sortDir,
    showDeleted,
    categoryId: categoryFilter || undefined,
  });
  const products = (productsResponse?.data ?? []) as ShopProductRow[];
  const { pageCount } = useServerPagination(productsResponse?.meta);

  const { data: categoriesResponse } = useAdminShopCategories({ limit: 999, showDeleted: false });
  const categories = (categoriesResponse?.data ?? []) as { _id: string; name: string }[];

  const { deleteMutation, createMutation, updateMutation, restoreMutation } =
    useAdminShopProductMutations();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const form = useForm<ProductFormValues>({
    resolver: createZodResolver(productSchema),
    defaultValues: DEFAULT_FORM,
  });

  useEffect(() => {
    if (editing) {
      form.reset({
        name: editing.name,
        slug: editing.slug,
        shortDescription: editing.shortDescription || "",
        description: editing.description || "",
        price: editing.price,
        compareAtPrice: editing.compareAtPrice ?? "",
        sku: editing.sku,
        inventory: editing.inventory,
        inventoryTracked: editing.inventoryTracked ?? true,
        categoryId: editing.categoryId || "",
        images: editing.images ?? [],
        lowStockThreshold: editing.lowStockThreshold ?? 5,
        isActive: editing.isActive ?? true,
        sortOrder: editing.sortOrder ?? 0,
      });
      setProductOptions(editing.options ?? []);
      setOptionsOpen(true);
      setVariantsOpen(true);
    } else if (sheetOpen) {
      form.reset(DEFAULT_FORM);
      setProductOptions([]);
      setOptionsOpen(true);
      setVariantsOpen(false);
    }
    setSelectedVariantIds(new Set());
  }, [editing, sheetOpen, form]);

  const watchedName = form.watch("name");
  useEffect(() => {
    if (editing) return;
    const slugField = form.getValues("slug");
    if (!slugField || slugField === slugifyName(form.formState.defaultValues?.name ?? "")) {
      form.setValue("slug", slugifyName(watchedName));
    }
  }, [watchedName, editing, form]);

  const hasOptions = productOptions.length > 0 && productOptions.every((o) => o.values.length > 0);

  const onSubmit = form.handleSubmit(async (values) => {
    const payload: Record<string, unknown> = {
      name: values.name,
      slug: values.slug || slugifyName(values.name),
      shortDescription: values.shortDescription || undefined,
      description: values.description || undefined,
      price: values.price,
      compareAtPrice: values.compareAtPrice || undefined,
      sku: values.sku,
      inventory: values.inventory,
      inventoryTracked: values.inventoryTracked,
      categoryId: values.categoryId || undefined,
      images: values.images,
      lowStockThreshold:
        values.lowStockThreshold === "" || values.lowStockThreshold == null
          ? undefined
          : Number(values.lowStockThreshold),
      isActive: values.isActive,
      sortOrder: values.sortOrder,
      metadata: { imageBlurs },
      options: productOptions.length > 0 ? productOptions : undefined,
    };
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing._id, payload });
        toast.success("Product updated");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Product created");
      }
      setSheetOpen(false);
      setEditing(null);
    } catch (err: unknown) {
      const message =
        err instanceof ApiResponseError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to save product";
      toast.error(message);
    }
  });

  const { data: variantsResponse, isLoading: variantsLoading } = useAdminShopProductVariants(
    editing?._id ?? ""
  );
  const variants = (variantsResponse?.data ?? []) as ShopProductVariant[];

  const {
    updateVariantMutation,
    deleteVariantMutation,
    bulkUpdateVariantsMutation,
    updateVariantImagesMutation,
    syncOptionsMutation,
  } = useAdminShopProductVariantMutations(editing?._id ?? "");

  const existingOptionValueKeys = useMemo(() => {
    const set = new Set<string>();
    for (const v of variants) {
      for (const ov of v.optionValues) {
        set.add(`${ov.optionName}::${ov.value}`);
      }
    }
    return set;
  }, [variants]);

  const orphanVariantIds = useMemo(() => {
    if (productOptions.length === 0) return new Set<string>();
    const validKeys = new Set<string>();
    for (const opt of productOptions) {
      for (const v of opt.values) {
        validKeys.add(`${opt.name}::${v.value}`);
      }
    }
    const orphans = new Set<string>();
    for (const v of variants) {
      const isOrphan = v.optionValues.some((ov) => !validKeys.has(`${ov.optionName}::${ov.value}`));
      if (isOrphan) orphans.add(v._id);
    }
    return orphans;
  }, [productOptions, variants]);

  const handleImageUpload = (url: string, blurDataUrl?: string) => {
    const images = form.getValues("images");
    if (url && !images.includes(url)) {
      form.setValue("images", [...images, url]);
    }
    if (blurDataUrl) {
      setImageBlurs((prev) => ({ ...prev, [url]: blurDataUrl }));
    }
  };

  const handleImageRemove = (index: number) => {
    const images = form.getValues("images");
    const removedUrl = images[index];
    form.setValue(
      "images",
      images.filter((_, i) => i !== index)
    );
    if (removedUrl) {
      setImageBlurs((prev) => {
        const next = { ...prev };
        delete next[removedUrl];
        return next;
      });
    }
  };

  const isDeleted = (row: ShopProductRow) => !!row.deletedAt;

  const handleVariantUpdate = useCallback(
    (id: string, payload: Record<string, unknown>) => {
      updateVariantMutation.mutate(
        { id, payload },
        {
          onSuccess: () => {
            toast.success("Variant updated", { duration: 1500 });
          },
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to update variant"),
        }
      );
    },
    [updateVariantMutation]
  );

  const handleVariantDelete = useCallback(
    (id: string) => {
      deleteVariantMutation.mutate(id, {
        onSuccess: () => {
          toast.success("Variant deleted");
          setSelectedVariantIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to delete variant"),
      });
    },
    [deleteVariantMutation]
  );

  const handleVariantImagesSave = useCallback(
    (id: string, images: string[]) => {
      updateVariantImagesMutation.mutate(
        { id, images },
        {
          onSuccess: () => toast.success("Variant images updated"),
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to update images"),
        }
      );
    },
    [updateVariantImagesMutation]
  );

  const computeVariantCombinations = useCallback(() => {
    if (!editing) return [];
    const optionNames = productOptions.map((o) => o.name);
    const optionValueSets = productOptions.map((o) => o.values.map((v) => v.value));
    const combos = cartesianProduct(optionValueSets);
    const existingKeys = new Set(
      variants.map((v) =>
        v.optionValues
          .map((ov) => `${ov.optionName}::${ov.value}`)
          .sort()
          .join("|")
      )
    );

    const parentSku = editing.sku || "PROD";
    return combos.map((values) => {
      const optionValues = values.map((value, idx) => ({ optionName: optionNames[idx], value }));
      const key = optionValues
        .map((ov) => `${ov.optionName}::${ov.value}`)
        .sort()
        .join("|");
      const exists = existingKeys.has(key);
      const name = values.join(" / ");
      const sku = `${parentSku}-${generateSkuSuffixes(values)}`;
      return { name, sku, optionValues, exists };
    });
  }, [editing, productOptions, variants]);

  const handleGenerateDiff = useCallback(() => {
    const combinations = computeVariantCombinations();
    const newVariants = combinations
      .filter((c) => !c.exists)
      .map((c) => ({
        name: c.name,
        sku: c.sku,
        optionValues: c.optionValues,
      }));
    setDiffPreview({
      newCount: newVariants.length,
      orphanCount: orphanVariantIds.size,
      skippedCount: combinations.length - newVariants.length,
      newVariants,
    });
  }, [computeVariantCombinations, orphanVariantIds]);

  const handleApplyGeneration = useCallback(async () => {
    if (!editing || !diffPreview) return;
    const newVariantsToCreate = diffPreview.newVariants;
    if (newVariantsToCreate.length === 0 && diffPreview.orphanCount === 0) {
      toast.info("Nothing to apply");
      return;
    }
    setBulkProgress({ current: 0, total: newVariantsToCreate.length });
    try {
      const res = await syncOptionsMutation.mutateAsync({
        options: productOptions,
        newVariants: newVariantsToCreate,
      });
      const data = res.data;
      const parts: string[] = [];
      if (data.createdVariants.length > 0) parts.push(`${data.createdVariants.length} created`);
      if (data.disabledVariants > 0) parts.push(`${data.disabledVariants} disabled (orphans)`);
      if (data.skipped.length > 0) parts.push(`${data.skipped.length} skipped`);
      toast.success(parts.length > 0 ? parts.join(", ") : "Done");
      if (data.errors.length > 0) {
        for (const err of data.errors) toast.error(`${err.name}: ${err.error}`);
      }
      setDiffPreview(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sync");
    } finally {
      setBulkProgress(null);
    }
  }, [diffPreview, editing, productOptions, syncOptionsMutation]);

  const handleSelectAllVariants = (checked: boolean) => {
    if (checked) {
      setSelectedVariantIds(new Set(variants.map((v) => v._id)));
    } else {
      setSelectedVariantIds(new Set());
    }
  };

  const handleBulkAction = (
    payload: Partial<
      Pick<ShopProductVariant, "price" | "inventory" | "inventoryTracked" | "isActive">
    >
  ) => {
    if (selectedVariantIds.size === 0) {
      toast.error("No variants selected");
      return;
    }
    const updates = Array.from(selectedVariantIds).map((id) => ({ id, payload }));
    bulkUpdateVariantsMutation.mutate(updates, {
      onSuccess: () => {
        toast.success(`${updates.length} variants updated`);
        setSelectedVariantIds(new Set());
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
    });
  };

  const columns: ColumnDef<ShopProductRow>[] = useMemo(
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
        id: "sku",
        accessorKey: "sku",
        header: () => (
          <SortableHeader
            label="SKU"
            active={sortField === "sku"}
            dir={sortDir}
            onClick={() => toggleSort("sku")}
          />
        ),
        cell: ({ row }) => (
          <code className="rounded bg-muted/50 px-2 py-0.5 font-mono text-xs text-muted-foreground">
            {row.original.sku}
          </code>
        ),
      },
      {
        id: "price",
        accessorKey: "price",
        header: () => (
          <SortableHeader
            label="Price"
            active={sortField === "price"}
            dir={sortDir}
            onClick={() => toggleSort("price")}
            align="right"
          />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums text-sm font-medium">
            {formatPrice(row.original.price)}
          </span>
        ),
      },
      {
        id: "compareAtPrice",
        accessorKey: "compareAtPrice",
        header: "Compare-at",
        cell: ({ row }) => (
          <span className="tabular-nums text-sm text-muted-foreground line-through">
            {formatPrice(row.original.compareAtPrice)}
          </span>
        ),
      },
      {
        id: "inventory",
        accessorKey: "inventory",
        header: () => (
          <SortableHeader
            label="Inventory"
            active={sortField === "inventory"}
            dir={sortDir}
            onClick={() => toggleSort("inventory")}
            align="right"
          />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums text-sm text-muted-foreground">
            {row.original.inventory}
          </span>
        ),
      },
      {
        id: "category",
        header: "Category",
        cell: ({ row }) => {
          const catId = row.original.categoryId;
          const cat = catId ? categories.find((c) => c._id === catId) : undefined;
          return <span className="text-sm text-muted-foreground">{cat ? cat.name : "—"}</span>;
        },
      },
      {
        id: "isActive",
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "default" : "secondary"}>
            {row.original.isActive ? "Active" : "Inactive"}
          </Badge>
        ),
      },
      {
        id: "sortOrder",
        accessorKey: "sortOrder",
        header: () => (
          <SortableHeader
            label="Order"
            active={sortField === "sortOrder"}
            dir={sortDir}
            onClick={() => toggleSort("sortOrder")}
            align="right"
          />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums text-sm text-muted-foreground">
            {row.original.sortOrder ?? 0}
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
                      onSuccess: () => toast.success("Product restored"),
                      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
                    });
                  }}
                  data-umami-event="shop-product:row-restore"
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
                    data-umami-event="shop-product:row-edit"
                  >
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteTarget(row.original)}
                    data-umami-event="shop-product:row-delete"
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
    [sortField, sortDir, toggleSort, restoreMutation, categories]
  );

  const allVariantsSelected = variants.length > 0 && selectedVariantIds.size === variants.length;
  const someVariantsSelected =
    selectedVariantIds.size > 0 && selectedVariantIds.size < variants.length;

  const parentImages = form.watch("images");

  return (
    <PageShell
      title="Products"
      description="Manage shop products, pricing, and inventory."
      actions={
        <Button
          onClick={() => {
            setEditing(null);
            setSheetOpen(true);
          }}
          data-umami-event="shop-product:create-open"
        >
          <Plus className="size-4" />
          New product
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={products}
        pageCount={pageCount}
        pagination={tableState.pagination}
        onPaginationChange={tableState.setPagination}
        manualSorting
        sorting={sorting}
        onSortingChange={handleSortingChange}
        isLoading={isLoading}
        searchValue={tableState.searchInput}
        onSearchChange={tableState.onSearchChange}
        searchPlaceholder="Search products…"
        emptyTitle="No products"
        emptyDescription="Create your first product to get started."
        rowClassName={(row) => (isDeleted(row as ShopProductRow) ? "opacity-50" : "")}
        toolbar={
          <div className="flex items-center gap-2">
            <ShowDeletedToggle
              id="show-deleted-products"
              checked={showDeleted}
              onCheckedChange={setShowDeleted}
              umamiEvent="shop-product:show-deleted-toggle"
            />
            <Select
              value={categoryFilter || "all"}
              onValueChange={(value) => setCategoryFilter(value === "all" ? "" : value)}
            >
              <SelectTrigger className="h-9 w-[180px]">
                <Filter />
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat._id} value={cat._id}>
                    {cat.name}
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
          if (!open) {
            setEditing(null);
            setDiffPreview(null);
            setSelectedVariantIds(new Set());
          }
        }}
        title={editing ? "Edit product" : "New product"}
        description={editing ? "Update product details" : "Create a new shop product."}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        size="xl"
        submitButtonUmami="shop-product:form-submit"
      >
        <Form {...form}>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Product name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="PROD-001" />
                    </FormControl>
                    <FormDescription>Used as a prefix for variant SKUs.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="product-slug" />
                  </FormControl>
                  <FormDescription>Lowercase letters, digits, dashes only.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="shortDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Short description</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Brief description" />
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
                    <Textarea {...field} placeholder="Full product description" rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price (pence)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="1" {...field} />
                    </FormControl>
                    <FormDescription>e.g. 1700 = £17.00</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="compareAtPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Compare-at price (pence)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Optional"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormDescription>Strikethrough original price</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {variants.length === 0 && (
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="inventory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inventory</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lowStockThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Low stock at</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="1" {...field} />
                      </FormControl>
                      <FormDescription>Show warning below this</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sortOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sort order</FormLabel>
                      <FormControl>
                        <Input type="number" step="1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {variants.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="lowStockThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Low stock threshold</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="1" {...field} />
                      </FormControl>
                      <FormDescription>
                        Show low-stock warning on shop below this count
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sortOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sort order</FormLabel>
                      <FormControl>
                        <Input type="number" step="1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    value={field.value || "none"}
                    onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No category</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat._id} value={cat._id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <FormLabel>Images</FormLabel>
              <FormDescription>Upload or browse product images.</FormDescription>
              <FormField
                control={form.control}
                name="images"
                render={({ field }) => (
                  <FormItem>
                    {field.value.length > 0 ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {field.value.map((url, i) => (
                          <div key={i} className="group relative">
                            <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-border">
                              <ImagePreview
                                src={url}
                                alt={`Product ${i + 1}`}
                                className="h-full w-full"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleImageRemove(i)}
                              className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow-xs transition-opacity hover:opacity-100 group-hover:opacity-100"
                            >
                              <X className="size-3" />
                              <span className="sr-only">Remove</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <ImageUpload
                      slug={`shop-product-${Date.now()}`}
                      onUpload={handleImageUpload}
                      onError={(msg) => toast.error(msg)}
                    />
                    <button
                      type="button"
                      onClick={() => setPickerOpen(true)}
                      className="text-xs font-medium text-gold hover:text-gold-light transition-colors self-start"
                    >
                      Browse Storage →
                    </button>
                  </FormItem>
                )}
              />
              <S3FilePicker
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                onSelect={(urls) => {
                  const existing = form.getValues("images");
                  const combined = [...new Set([...existing, ...urls])];
                  form.setValue("images", combined);
                }}
                multiple
                selectedUrls={form.watch("images")}
              />
            </div>

            {variants.length === 0 && (
              <FormField
                control={form.control}
                name="inventoryTracked"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <FormLabel className="cursor-pointer">Track inventory</FormLabel>
                      <FormDescription>When disabled, inventory count is ignored.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <FormLabel className="cursor-pointer">Active</FormLabel>
                    <FormDescription>Inactive products are hidden from the shop.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* ── Product Options ── */}
            <div className="rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setOptionsOpen(!optionsOpen)}
                className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-muted/50"
              >
                <Layers className="size-4 text-muted-foreground" />
                Product Options
                <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  {productOptions.length} option
                  {productOptions.length !== 1 ? "s" : ""} ·{" "}
                  {productOptions.reduce((sum, o) => sum + o.values.length, 0)} values
                  {optionsOpen ? (
                    <ChevronUp className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                </span>
              </button>
              {optionsOpen && (
                <div className="space-y-3 border-t border-border p-4">
                  <OptionsEditor
                    options={productOptions}
                    onChange={setProductOptions}
                    existingVariantOptionValues={existingOptionValueKeys}
                  />
                </div>
              )}
            </div>

            {/* ── Variants ── */}
            <div className="rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setVariantsOpen(!variantsOpen)}
                className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-muted/50"
              >
                Variants
                <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  {editing
                    ? `${variants.filter((v) => v.isActive).length} active / ${variants.length} total`
                    : "Save the product first to manage variants"}
                  {variantsOpen ? (
                    <ChevronUp className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                </span>
              </button>
              {variantsOpen && (
                <div className="space-y-3 border-t border-border p-4">
                  {!editing ? (
                    <p className="text-sm text-muted-foreground">
                      Save the product first to manage variants.
                    </p>
                  ) : variantsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Loading variants…
                    </div>
                  ) : (
                    <>
                      {/* Generation toolbar */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!hasOptions || syncOptionsMutation.isPending}
                          onClick={handleGenerateDiff}
                        >
                          <Sparkles className="mr-1 size-4" />
                          Generate from options
                        </Button>
                        {orphanVariantIds.size > 0 && (
                          <span className="flex items-center gap-1 text-xs text-warning">
                            <AlertTriangle className="size-3" />
                            {orphanVariantIds.size} variant
                            {orphanVariantIds.size !== 1 ? "s" : ""} will be disabled on next save
                          </span>
                        )}
                      </div>

                      {diffPreview && (
                        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Sparkles className="size-4 text-gold" />
                            Diff preview
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="rounded-md border border-border bg-card p-2">
                              <span className="block font-semibold text-success">
                                {diffPreview.newCount}
                              </span>
                              <span className="text-muted-foreground">new variants</span>
                            </div>
                            <div className="rounded-md border border-border bg-card p-2">
                              <span className="block font-semibold text-warning">
                                {diffPreview.orphanCount}
                              </span>
                              <span className="text-muted-foreground">will be disabled</span>
                            </div>
                            <div className="rounded-md border border-border bg-card p-2">
                              <span className="block font-semibold text-muted-foreground">
                                {diffPreview.skippedCount}
                              </span>
                              <span className="text-muted-foreground">already exist</span>
                            </div>
                          </div>
                          {diffPreview.newCount > 0 && (
                            <div className="max-h-32 overflow-y-auto rounded-md border border-border bg-card p-2 text-xs">
                              <p className="mb-1 font-medium text-muted-foreground">Will create:</p>
                              <div className="flex flex-wrap gap-1">
                                {diffPreview.newVariants.map((v) => (
                                  <Badge
                                    key={v.sku}
                                    variant="secondary"
                                    className="font-mono text-[10px]"
                                  >
                                    {v.sku}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {bulkProgress && (
                            <p className="text-xs text-muted-foreground">
                              Applying {bulkProgress.current}/{bulkProgress.total}…
                            </p>
                          )}
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setDiffPreview(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              disabled={syncOptionsMutation.isPending}
                              onClick={handleApplyGeneration}
                            >
                              {syncOptionsMutation.isPending ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Check className="size-3" />
                              )}
                              Apply
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Bulk actions */}
                      {selectedVariantIds.size > 0 && (
                        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gold/30 bg-gold/5 p-2">
                          <span className="text-xs font-medium">
                            {selectedVariantIds.size} selected
                          </span>
                          <span className="text-xs text-muted-foreground">Bulk set:</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleBulkAction({ isActive: true })}
                          >
                            Enable
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleBulkAction({ isActive: false })}
                          >
                            Disable
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleBulkAction({ inventoryTracked: true })}
                          >
                            Track stock
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleBulkAction({ inventoryTracked: false })}
                          >
                            Untracked
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs ml-auto"
                            onClick={() => setSelectedVariantIds(new Set())}
                          >
                            Clear selection
                          </Button>
                        </div>
                      )}

                      {variants.length > 0 ? (
                        <div className="overflow-x-auto rounded-lg border border-border">
                          <table className="w-full min-w-[900px] text-sm">
                            <thead className="bg-muted/40">
                              <tr className="border-b border-border">
                                <th className="sticky left-0 z-10 w-10 bg-muted/40 px-3 py-2">
                                  <Checkbox
                                    checked={allVariantsSelected}
                                    onCheckedChange={handleSelectAllVariants}
                                    aria-label="Select all variants"
                                    className={
                                      someVariantsSelected
                                        ? "data-[state=indeterminate]:bg-gold/30"
                                        : ""
                                    }
                                  />
                                </th>
                                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                                  SKU
                                </th>
                                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                                  Name
                                </th>
                                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                                  Price
                                </th>
                                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                                  Compare
                                </th>
                                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                                  Inventory
                                </th>
                                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                                  Tracked
                                </th>
                                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                                  Active
                                </th>
                                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                                  Images
                                </th>
                                <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                                  <span className="sr-only">Actions</span>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {variants.map((variant) => (
                                <VariantRow
                                  key={variant._id}
                                  variant={variant}
                                  parentPrice={editing?.price}
                                  parentImages={parentImages}
                                  isOrphan={orphanVariantIds.has(variant._id)}
                                  onUpdate={handleVariantUpdate}
                                  onDelete={handleVariantDelete}
                                  onOpenImages={(v) => {
                                    setImagesVariant(v);
                                    setImagesPopoverOpen(true);
                                  }}
                                  isSelected={selectedVariantIds.has(variant._id)}
                                  onSelectChange={(id, checked) => {
                                    setSelectedVariantIds((prev) => {
                                      const next = new Set(prev);
                                      if (checked) next.add(id);
                                      else next.delete(id);
                                      return next;
                                    });
                                  }}
                                  isUpdating={
                                    updateVariantMutation.isPending &&
                                    updateVariantMutation.variables?.id === variant._id
                                  }
                                />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                          No variants yet. Add options above, then click "Generate from options".
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </Form>
      </FormSheet>

      <VariantImagesPopover
        variant={imagesVariant}
        parentImages={parentImages}
        open={imagesPopoverOpen}
        onOpenChange={setImagesPopoverOpen}
        onSave={handleVariantImagesSave}
        isSaving={updateVariantImagesMutation.isPending}
        productSlug={editing?.slug ?? "product"}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete product"
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
                toast.success("Product deleted");
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
