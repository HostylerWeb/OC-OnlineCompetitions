"use client";

import { api } from "@oc/api-admin";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  FileText,
  Folder,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  List,
  Loader2,
  Search,
  Trash2,
  Video,
} from "@oc/icons";
import { formatDistanceToNow } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AssetImage } from "@/components/AssetImage";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ZoomableImageGallery } from "@/components/zoomable-image-gallery";
import { cn } from "@/lib/utils";
import {
  type AssetSort,
  type AssetTypeFilter,
  type AssetView,
  type DeleteBatchResponse,
  FRAME_PREFIX,
  type Meta,
  type MetadataResponse,
  type S3Asset,
  type Usage,
  type UsageResponse,
} from "./types";

// frames/ is video-frame extraction output — hidden from media library

const VIEW_MODE_KEY = "admin-media-view-mode";

const TYPE_FILTER_VALUES: AssetTypeFilter[] = ["all", "image", "video", "other"];
const SORT_VALUES: AssetSort[] = ["newest", "name", "size"];

function isFrameKey(key: string): boolean {
  return key.startsWith(FRAME_PREFIX);
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

function getExtension(key: string): string {
  const last = key.split("/").pop() ?? "";
  const dot = last.lastIndexOf(".");
  if (dot < 0) return "";
  return last.slice(dot + 1).toUpperCase();
}

function isImageFile(key: string): boolean {
  return /\.(png|jpg|jpeg|webp|gif|svg|avif)$/i.test(key);
}

function isVideoFile(key: string): boolean {
  return /\.(mp4|mov|webm|avi|mkv|flv)$/i.test(key);
}

function FileTypeIcon({ assetKey, className }: { assetKey: string; className?: string }) {
  if (isVideoFile(assetKey)) return <Video className={className} aria-hidden="true" />;
  if (isImageFile(assetKey)) return <ImageIcon className={className} aria-hidden="true" />;
  return <FileText className={className} aria-hidden="true" />;
}

function extractSubfolders(assets: S3Asset[], prefix: string): string[] {
  const normalizedPrefix = prefix && !prefix.endsWith("/") ? `${prefix}/` : prefix;
  const folders = new Set<string>();
  for (const asset of assets) {
    if (isFrameKey(asset.key)) continue;
    const rest = normalizedPrefix ? asset.key.slice(normalizedPrefix.length) : asset.key;
    const slashIdx = rest.indexOf("/");
    if (slashIdx >= 0) {
      const folderPrefix = normalizedPrefix + rest.slice(0, slashIdx + 1);
      if (folderPrefix.startsWith(FRAME_PREFIX)) continue;
      folders.add(folderPrefix);
    }
  }
  return Array.from(folders).sort();
}

function extractDirectFiles(assets: S3Asset[], prefix: string): S3Asset[] {
  const normalizedPrefix = prefix && !prefix.endsWith("/") ? `${prefix}/` : prefix;
  return assets.filter((a) => {
    if (isFrameKey(a.key)) return false;
    const rest = normalizedPrefix ? a.key.slice(normalizedPrefix.length) : a.key;
    return !rest.includes("/");
  });
}

interface Breadcrumb {
  label: string;
  prefix: string;
}

function parseBreadcrumbs(prefix: string): Breadcrumb[] {
  const crumbs: Breadcrumb[] = [{ label: "Root", prefix: "" }];
  if (!prefix) return crumbs;
  const parts = prefix.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    const nextPrefix = `${current}${part}/`;
    if (nextPrefix.startsWith(FRAME_PREFIX)) continue;
    current = nextPrefix;
    crumbs.push({ label: part, prefix: current });
  }
  return crumbs;
}

type PickerState = "loading" | "loaded" | "empty" | "error";

interface AssetsResponse {
  assets: S3Asset[];
  nextCursor?: string;
}

function useMetadataCache(visibleKeys: string[]): Map<string, Meta> {
  const [cache, setCache] = useState<Map<string, Meta>>(() => new Map());
  const cacheRef = useRef(cache);
  cacheRef.current = cache;
  const keysSig = visibleKeys.join(",");

  useEffect(() => {
    if (visibleKeys.length === 0) return;
    const timeoutId = setTimeout(async () => {
      const missing = visibleKeys.filter((k) => !cacheRef.current.has(k));
      if (missing.length === 0) return;
      try {
        const res = await api.get<MetadataResponse>(
          `/api/admin/media/metadata?keys=${encodeURIComponent(missing.join(","))}`
        );
        const updates = res.data.metadata;
        if (!updates) return;
        setCache((prev) => {
          const next = new Map(prev);
          let changed = false;
          for (const [k, m] of Object.entries(updates)) {
            next.set(k, m);
            changed = true;
          }
          return changed ? next : prev;
        });
      } catch {
        // fall back to no metadata — endpoint not ready or errored
      }
    }, 200);
    return () => clearTimeout(timeoutId);
  }, [keysSig]);

  return cache;
}

interface UsageCacheApi {
  cache: Map<string, Usage[]>;
  prefetch: (url: string) => void;
}

function useUsageCache(): UsageCacheApi {
  const [cache, setCache] = useState<Map<string, Usage[]>>(() => new Map());
  const cacheRef = useRef(cache);
  cacheRef.current = cache;
  const inFlightRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef<Set<string>>(new Set());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prefetch = useCallback((url: string) => {
    if (cacheRef.current.has(url)) return;
    if (inFlightRef.current.has(url)) return;
    if (pendingRef.current.has(url)) return;
    pendingRef.current.add(url);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      const urls = Array.from(pendingRef.current);
      pendingRef.current.clear();
      for (const u of urls) inFlightRef.current.add(u);
      try {
        const res = await api.get<UsageResponse>(
          `/api/admin/media/usage?urls=${encodeURIComponent(urls.join(","))}`
        );
        const updates = res.data.usages;
        if (!updates) return;
        setCache((prev) => {
          const next = new Map(prev);
          let changed = false;
          for (const [u, usages] of Object.entries(updates)) {
            next.set(u, usages);
            changed = true;
          }
          return changed ? next : prev;
        });
      } catch {
        // fall back — endpoint not ready or errored
      } finally {
        for (const u of urls) inFlightRef.current.delete(u);
      }
    }, 200);
  }, []);

  return { cache, prefetch };
}

export interface MediaGridProps {
  initialPrefix?: string;
  initialSearch?: string;
  initialType?: AssetTypeFilter;
  initialSort?: AssetSort;
  initialView?: AssetView;
  initialBrowseFlat?: boolean;
  onStateChange?: (state: {
    prefix: string;
    search: string;
    type: AssetTypeFilter;
    sort: AssetSort;
    view: AssetView;
    browseFlat?: boolean;
  }) => void;
  onSelect?: (urls: string[]) => void;
  selectable?: boolean;
  selectedUrls?: string[];
  onCopyUrl?: (url: string) => void;
  layout?: "page" | "modal";
  showSelectButton?: boolean;
  multiple?: boolean;
  previewable?: boolean;
}

export function MediaGrid({
  initialPrefix = "",
  initialSearch = "",
  initialType = "all",
  initialSort = "newest",
  initialView = "grid",
  initialBrowseFlat,
  onStateChange,
  onSelect,
  selectable = false,
  selectedUrls = [],
  onCopyUrl,
  layout = "modal",
  showSelectButton,
  multiple = true,
  previewable,
}: MediaGridProps) {
  const isManagePage = layout === "page";
  const effectiveSelectable = selectable || isManagePage;
  const [browseFlat, setBrowseFlat] = useState(
    initialBrowseFlat ?? (layout === "page")
  );
  const [assets, setAssets] = useState<S3Asset[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState<PickerState>("loading");
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [prefix, setPrefix] = useState(initialPrefix);
  const [typeFilter, setTypeFilter] = useState<AssetTypeFilter>(
    TYPE_FILTER_VALUES.includes(initialType) ? initialType : "all"
  );
  const [sort, setSort] = useState<AssetSort>(
    SORT_VALUES.includes(initialSort) ? initialSort : "newest"
  );
  const [view, setView] = useState<AssetView>(initialView);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteForce, setDeleteForce] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedViewRef = useRef(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (initializedViewRef.current) return;
    if (typeof window === "undefined") return;
    initializedViewRef.current = true;
    const stored = window.localStorage.getItem(VIEW_MODE_KEY);
    if (stored === "grid" || stored === "list") {
      setView(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VIEW_MODE_KEY, view);
  }, [view]);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [search]);

  useEffect(() => {
    if (!onStateChange) return;
    onStateChange({
      prefix,
      search: debouncedSearch,
      type: typeFilter,
      sort,
      view,
      browseFlat: isManagePage ? browseFlat : undefined,
    });
  }, [prefix, debouncedSearch, typeFilter, sort, view, browseFlat, isManagePage, onStateChange]);

  const visibleKeys = useMemo(() => {
    if (browseFlat && isManagePage) {
      return assets.filter((a) => !isFrameKey(a.key)).map((a) => a.key);
    }
    const directFiles = extractDirectFiles(assets, prefix);
    return directFiles.map((a) => a.key);
  }, [assets, prefix, browseFlat, isManagePage]);

  const metaCache = useMetadataCache(visibleKeys);
  const { cache: usageCache, prefetch: prefetchUsage } = useUsageCache();

  const fetchAssets = useCallback(
    async (cursorToken?: string) => {
      const requestId = ++requestIdRef.current;
      if (!cursorToken) setLoading("loading");
      try {
        const params = new URLSearchParams();
        if (isManagePage && browseFlat) {
          params.set("flat", "1");
        } else {
          params.set("prefix", prefix);
        }
        params.set("limit", "24");
        if (cursorToken) params.set("cursor", cursorToken);
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (typeFilter !== "all") params.set("type", typeFilter);
        if (sort !== "newest") params.set("sort", sort);

        const res = await api.get<AssetsResponse>(`/api/admin/media/assets?${params.toString()}`);
        if (requestId !== requestIdRef.current) return;
        const data = res.data;
        const filtered = (data.assets ?? []).filter((a) => !isFrameKey(a.key));
        if (cursorToken) {
          setAssets((prev) => [...prev, ...filtered]);
        } else {
          setAssets(filtered);
        }
        setCursor(data.nextCursor);
        if (!cursorToken) setLoading(filtered.length === 0 ? "empty" : "loaded");
      } catch {
        if (requestId !== requestIdRef.current) return;
        setLoading("error");
        toast.error("Failed to load files");
      }
    },
    [prefix, debouncedSearch, typeFilter, sort, browseFlat, isManagePage]
  );

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  function handleLoadMore() {
    if (cursor) fetchAssets(cursor);
  }

  function handleFolderClick(folderPrefix: string) {
    if (folderPrefix.startsWith(FRAME_PREFIX)) return;
    setLoading("loading");
    setPrefix(folderPrefix);
    setAssets([]);
    setCursor(undefined);
  }

  function handleBreadcrumbClick(targetPrefix: string) {
    if (targetPrefix.startsWith(FRAME_PREFIX)) return;
    setLoading("loading");
    setPrefix(targetPrefix);
    setAssets([]);
    setCursor(undefined);
  }

  function handleRootClick() {
    setLoading("loading");
    setPrefix("");
    setAssets([]);
    setCursor(undefined);
  }

  function toggleSelection(url: string) {
    setSelected((prev) => {
      const next = multiple ? new Set(prev) : new Set<string>();
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  }

  function handleConfirm() {
    onSelect?.(Array.from(selected));
  }

  function handleCopy(url: string) {
    if (onCopyUrl) {
      onCopyUrl(url);
      return;
    }
    navigator.clipboard.writeText(url).then(
      () => toast.success("URL copied"),
      () => toast.error("Failed to copy URL")
    );
  }

  function handleCopyMany() {
    if (selected.size === 0) return;
    const urls = Array.from(selected).join("\n");
    navigator.clipboard.writeText(urls).then(
      () => toast.success(`Copied ${selected.size} URLs`),
      () => toast.error("Failed to copy URLs")
    );
  }

  function handleDeleteClick() {
    setDeleteForce(false);
    for (const url of selected) {
      prefetchUsage(url);
    }
    setDeleteOpen(true);
  }

  async function handleDeleteConfirm() {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      const keysToDelete = Array.from(selected);
      const keyByUrl = new Map<string, string>();
      for (const asset of assets) {
        keyByUrl.set(asset.url, asset.key);
      }
      const keys = keysToDelete
        .map((url) => keyByUrl.get(url))
        .filter((k): k is string => Boolean(k));
      if (keys.length === 0) {
        setDeleting(false);
        setDeleteOpen(false);
        return;
      }
      await api.post<DeleteBatchResponse>("/api/admin/media/delete-batch", {
        keys,
        force: deleteForce,
      });
      toast.success(`Deleted ${keys.length} file${keys.length === 1 ? "" : "s"}`);
      setSelected(new Set());
      setAssets((prev) => prev.filter((a) => !keys.includes(a.key)));
      setDeleteOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      toast.error("Delete failed", { description: msg });
    } finally {
      setDeleting(false);
    }
  }

  function handleDeselectAll() {
    setSelected(new Set());
  }

  const breadcrumbs = parseBreadcrumbs(prefix);
  const subfolders = browseFlat && isManagePage ? [] : extractSubfolders(assets, prefix);
  const directFiles =
    browseFlat && isManagePage
      ? assets.filter((a) => !isFrameKey(a.key))
      : extractDirectFiles(assets, prefix);
  const showSelect = showSelectButton ?? Boolean(onSelect);
  const inUseCount = useMemo(() => {
    let count = 0;
    for (const url of selected) {
      const usages = usageCache.get(url);
      if (usages && usages.length > 0) count += 1;
    }
    return count;
  }, [selected, usageCache]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search files…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {isManagePage ? (
            <div className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5">
              <Switch
                id="media-browse-flat"
                checked={browseFlat}
                onCheckedChange={(checked) => {
                  setBrowseFlat(checked);
                  setLoading("loading");
                  setAssets([]);
                  setCursor(undefined);
                  if (checked) {
                    setPrefix("");
                  }
                }}
                aria-label="Show all images in a flat list"
              />
              <Label htmlFor="media-browse-flat" className="cursor-pointer text-sm font-medium">
                All images
              </Label>
            </div>
          ) : (
            <div />
          )}
          <ToggleGroup
            type="single"
            value={typeFilter}
            onValueChange={(v) => v && setTypeFilter(v as AssetTypeFilter)}
            size="sm"
            spacing={1}
            data-umami-event="media:type-filter"
          >
            <ToggleGroupItem value="all" aria-label="Show all files">
              All
            </ToggleGroupItem>
            <ToggleGroupItem value="image" aria-label="Show images">
              <ImageIcon className="size-3.5" />
              Images
            </ToggleGroupItem>
            <ToggleGroupItem value="video" aria-label="Show videos">
              <Video className="size-3.5" />
              Videos
            </ToggleGroupItem>
            <ToggleGroupItem value="other" aria-label="Show other files">
              <FileText className="size-3.5" />
              Other
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="flex items-center gap-2">
            <Select value={sort} onValueChange={(v) => setSort(v as AssetSort)}>
              <SelectTrigger
                size="sm"
                className="w-[140px]"
                aria-label="Sort files"
                data-umami-event="media:sort-change"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="name">Name (A–Z)</SelectItem>
                <SelectItem value="size">Size (Largest)</SelectItem>
              </SelectContent>
            </Select>
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(v) => v && setView(v as AssetView)}
              size="sm"
              spacing={1}
              data-umami-event="media:view-toggle"
            >
              <ToggleGroupItem value="grid" aria-label="Grid view">
                <LayoutGrid className="size-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="List view">
                <List className="size-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </div>

      {(!browseFlat || !isManagePage) && breadcrumbs.length > 1 && (
        <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.prefix || "root"} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground/40" />}
              {i === breadcrumbs.length - 1 ? (
                <span className="font-medium text-foreground">{crumb.label}</span>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    crumb.prefix === "" ? handleRootClick() : handleBreadcrumbClick(crumb.prefix)
                  }
                  className="transition-colors hover:text-gold"
                >
                  {crumb.label}
                </button>
              )}
            </span>
          ))}
        </nav>
      )}

      <MediaGridBody
        assets={assets}
        subfolders={subfolders}
        directFiles={directFiles}
        loading={loading}
        prefix={prefix}
        cursor={cursor}
        view={view}
        layout={layout}
        selectable={effectiveSelectable}
        manageMode={isManagePage}
        selected={selected}
        selectedUrls={selectedUrls}
        metaCache={metaCache}
        usageCache={usageCache}
        debouncedSearch={debouncedSearch}
        onFolderClick={handleFolderClick}
        onLoadMore={handleLoadMore}
        onToggleSelection={toggleSelection}
        onCopy={handleCopy}
        onPrefetchUsage={prefetchUsage}
        previewable={previewable}
      />

      {layout === "modal" && showSelect && (
        <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t border-border bg-card px-4 py-3 sm:-mx-6 sm:px-6">
          <Button variant="outline" onClick={() => onSelect?.([])}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selected.size === 0}
            className="bg-gold font-semibold text-black hover:bg-gold-light"
          >
            Select
            {selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>
        </div>
      )}

      {isManagePage && selected.size >= 1 && (
        <BulkActionBar
          count={selected.size}
          onCopy={handleCopyMany}
          onDelete={handleDeleteClick}
          onDeselect={handleDeselectAll}
        />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selected.size} file{selected.size === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {inUseCount > 0 ? (
                <span className="flex flex-col gap-2">
                  <span className="flex items-start gap-2 text-amber-600">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>
                      {inUseCount} of these are used by competitions — deleting will break
                      references.
                    </span>
                  </span>
                  <span>This cannot be undone.</span>
                </span>
              ) : (
                <span>This cannot be undone.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {inUseCount > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Checkbox
                id="force-delete"
                checked={deleteForce}
                onCheckedChange={(v) => setDeleteForce(v === true)}
              />
              <label htmlFor="force-delete">Force delete referenced files</label>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteConfirm();
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="size-4" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface MediaGridBodyProps {
  assets: S3Asset[];
  subfolders: string[];
  directFiles: S3Asset[];
  loading: PickerState;
  prefix: string;
  cursor: string | undefined;
  view: AssetView;
  layout: "page" | "modal";
  selectable: boolean;
  manageMode?: boolean;
  selected: Set<string>;
  selectedUrls: string[];
  metaCache: Map<string, Meta>;
  usageCache: Map<string, Usage[]>;
  debouncedSearch: string;
  onFolderClick: (prefix: string) => void;
  onLoadMore: () => void;
  onToggleSelection: (url: string) => void;
  onCopy: (url: string) => void;
  onPrefetchUsage: (url: string) => void;
  previewable?: boolean;
  onPreview?: (url: string) => void;
}

function MediaGridBody({
  assets,
  subfolders,
  directFiles,
  loading,
  prefix,
  cursor,
  view,
  layout,
  selectable,
  manageMode = false,
  selected,
  selectedUrls,
  metaCache,
  usageCache,
  debouncedSearch,
  onFolderClick,
  onLoadMore,
  onToggleSelection,
  onCopy,
  onPrefetchUsage,
  previewable,
  onPreview: _onPreview,
}: MediaGridBodyProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const previewableAssets = useMemo(
    () => directFiles.filter((a) => isImageFile(a.key) || isVideoFile(a.key)).map((a) => a.url),
    [directFiles]
  );

  function handlePreview(url: string) {
    const idx = previewableAssets.indexOf(url);
    if (idx >= 0) {
      setPreviewIndex(idx);
      setPreviewOpen(true);
    }
  }

  const folderStats = useMemo(() => {
    const stats = new Map<string, { count: number; size: number }>();
    for (const folder of subfolders) {
      let count = 0;
      let size = 0;
      for (const asset of assets) {
        if (asset.key.startsWith(folder) && asset.key !== folder) {
          count++;
          size += asset.size;
        }
      }
      stats.set(folder, { count, size });
    }
    return stats;
  }, [assets, subfolders]);

  if (loading === "loading") {
    return (
      <div
        className={cn(
          "grid gap-4",
          layout === "page"
            ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        )}
      >
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2" aria-hidden="true">
            <div className="aspect-square animate-pulse rounded-xl bg-muted" />
            <div className="space-y-1.5 px-1">
              <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted/60" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (loading === "error") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-sm font-medium text-red-500">Failed to load files</p>
        <p className="text-xs text-muted-foreground">Try again or check the connection.</p>
      </div>
    );
  }

  if (loading === "empty" && debouncedSearch) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">
        No files matching &ldquo;{debouncedSearch}&rdquo;
      </p>
    );
  }

  if (loading === "empty") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="rounded-full bg-muted p-4">
          <ImageIcon className="size-8 text-muted-foreground" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">This folder is empty</p>
        {prefix && (
          <button
            type="button"
            className="text-xs text-gold underline underline-offset-2 hover:text-gold-light"
            onClick={() => onFolderClick("")}
          >
            Go back to root
          </button>
        )}
      </div>
    );
  }

  const gridCols =
    layout === "page"
      ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";

  const preselectedSet = new Set(selectedUrls);

  return (
    <>
      {(subfolders.length > 0 || directFiles.length > 0) && view === "grid" ? (
        <div className={cn("grid gap-4", gridCols)}>
          {subfolders.map((folder) => {
            const name = folder.slice(prefix.length).replace(/\/$/, "");
            const stats = folderStats.get(folder);
            return (
              <FolderGridTile
                key={folder}
                folderPrefix={folder}
                folderName={name}
                fileCount={stats?.count ?? 0}
                totalSize={stats?.size ?? 0}
                view="grid"
                onFolderClick={onFolderClick}
              />
            );
          })}
          {directFiles.map((asset) => (
            <GridTile
              key={asset.key}
              asset={asset}
              selectable={selectable}
              manageMode={manageMode}
              selected={selected}
              preselected={preselectedSet}
              previewable={previewable}
              meta={metaCache.get(asset.key)}
              usages={usageCache.get(asset.url)}
              onToggleSelection={onToggleSelection}
              onCopy={onCopy}
              onPrefetchUsage={onPrefetchUsage}
              onPreview={handlePreview}
            />
          ))}
        </div>
      ) : view === "list" ? (
        <>
          {subfolders.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Folders
              </p>
              {subfolders.map((folder) => {
                const name = folder.slice(prefix.length).replace(/\/$/, "");
                const stats = folderStats.get(folder);
                return (
                  <FolderGridTile
                    key={folder}
                    folderPrefix={folder}
                    folderName={name}
                    fileCount={stats?.count ?? 0}
                    totalSize={stats?.size ?? 0}
                    view="list"
                    onFolderClick={onFolderClick}
                  />
                );
              })}
            </div>
          )}
          {directFiles.length > 0 && (
            <div>
              {subfolders.length > 0 && (
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Files
                </p>
              )}
              <div className="flex flex-col gap-1">
                {directFiles.map((asset) => (
                  <ListRow
                    key={asset.key}
                    asset={asset}
                    selectable={selectable}
                    manageMode={manageMode}
                    selected={selected}
                    preselected={preselectedSet}
                    previewable={previewable}
                    usages={usageCache.get(asset.url)}
                    onToggleSelection={onToggleSelection}
                    onCopy={onCopy}
                    onPrefetchUsage={onPrefetchUsage}
                    onPreview={handlePreview}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}

      {subfolders.length === 0 && directFiles.length === 0 && !cursor && loading === "loaded" && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <p className="text-sm font-medium text-muted-foreground">No files found</p>
        </div>
      )}

      {cursor && (
        <Button variant="outline" className="w-full" onClick={onLoadMore}>
          Load more
        </Button>
      )}

      {previewable && previewableAssets.length > 0 && (
        <ZoomableImageGallery
          images={previewableAssets}
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          currentIndex={previewIndex}
          onIndexChange={setPreviewIndex}
          variant="fullscreen"
        />
      )}
    </>
  );
}

interface TileProps {
  asset: S3Asset;
  selectable: boolean;
  manageMode?: boolean;
  selected: Set<string>;
  preselected: Set<string>;
  meta?: Meta;
  usages?: Usage[];
  onToggleSelection: (url: string) => void;
  onCopy: (url: string) => void;
  onPrefetchUsage: (url: string) => void;
  previewable?: boolean;
  onPreview?: (url: string) => void;
}

function GridTile({
  asset,
  selectable,
  manageMode = false,
  selected,
  preselected,
  meta,
  usages,
  onToggleSelection,
  onCopy,
  onPrefetchUsage,
  previewable,
  onPreview,
}: TileProps) {
  const filename = asset.key.split("/").pop() ?? asset.key;
  const isImage = isImageFile(asset.key);
  const ext = getExtension(asset.key);
  const [imgError, setImgError] = useState(false);
  const isSelected = selected.has(asset.url);
  const isPreselected = preselected.has(asset.url);
  const relativeDate = useMemo(() => {
    const d = new Date(asset.lastModified);
    if (Number.isNaN(d.getTime())) return "";
    return formatDistanceToNow(d, { addSuffix: true });
  }, [asset.lastModified]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected || isPreselected || undefined}
      onClick={() => {
        if (manageMode) {
          if (previewable && (isImageFile(asset.key) || isVideoFile(asset.key)))
            onPreview?.(asset.url);
          else window.open(asset.url, "_blank", "noopener,noreferrer");
          return;
        }
        if (selectable) onToggleSelection(asset.url);
        else if (previewable && (isImageFile(asset.key) || isVideoFile(asset.key)))
          onPreview?.(asset.url);
        else window.open(asset.url, "_blank", "noopener,noreferrer");
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (manageMode) {
            if (previewable && (isImageFile(asset.key) || isVideoFile(asset.key)))
              onPreview?.(asset.url);
            else window.open(asset.url, "_blank", "noopener,noreferrer");
            return;
          }
          if (selectable) onToggleSelection(asset.url);
          else if (previewable && (isImageFile(asset.key) || isVideoFile(asset.key)))
            onPreview?.(asset.url);
          else window.open(asset.url, "_blank", "noopener,noreferrer");
        }
      }}
      className={cn(
        "group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border-2 text-left transition-all",
        isSelected || isPreselected
          ? "border-gold ring-1 ring-gold"
          : "border-border hover:border-gold/40"
      )}
    >
      <div className="relative aspect-square bg-muted">
        {manageMode && (
          <div
            className="absolute left-2 top-2 z-10 flex size-7 items-center justify-center rounded-md bg-background/90 shadow-sm backdrop-blur"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Checkbox
              aria-label={`Select ${filename}`}
              checked={isSelected}
              onCheckedChange={() => onToggleSelection(asset.url)}
              className="border-muted-foreground data-[state=checked]:border-gold data-[state=checked]:bg-gold"
            />
          </div>
        )}
        {isImage && !imgError ? (
          <AssetImage
            src={asset.url}
            alt={filename}
            fill
            className="object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <FileTypeIcon assetKey={asset.key} className="size-8 text-muted-foreground" />
          </div>
        )}

        {(isSelected || isPreselected) && (
          <div className="pointer-events-none absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-gold">
            <Check className="size-4 text-black" aria-hidden="true" />
          </div>
        )}

        <button
          type="button"
          aria-label={`Copy ${filename} URL`}
          onClick={(e) => {
            e.stopPropagation();
            onCopy(asset.url);
          }}
          className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-background/80 backdrop-blur transition-opacity hover:bg-background max-sm:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          style={isSelected || isPreselected ? { right: "2.25rem" } : undefined}
        >
          <Copy className="size-3.5" aria-hidden="true" />
        </button>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-[10px] text-white">
          {ext && (
            <Badge
              variant="secondary"
              className="pointer-events-auto h-4 border-0 bg-white/20 px-1.5 text-[9px] uppercase text-white"
            >
              {ext}
            </Badge>
          )}
          <UsageBadge url={asset.url} usages={usages} onHover={() => onPrefetchUsage(asset.url)} />
        </div>
      </div>

      <div className="flex flex-col gap-1 px-2.5 py-2">
        <p className="truncate text-xs font-medium">{filename}</p>
        <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span className="truncate">{formatSize(asset.size)}</span>
          {meta?.width && meta.height ? (
            <span className="shrink-0">
              {meta.width}×{meta.height}
            </span>
          ) : relativeDate ? (
            <span className="shrink-0">{relativeDate}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface FolderGridTileProps {
  folderPrefix: string;
  folderName: string;
  fileCount: number;
  totalSize: number;
  view: "grid" | "list";
  onFolderClick: (prefix: string) => void;
}

function FolderGridTile({
  folderPrefix,
  folderName,
  fileCount,
  totalSize,
  view,
  onFolderClick,
}: FolderGridTileProps) {
  if (view === "list") {
    return (
      <button
        type="button"
        onClick={() => onFolderClick(folderPrefix)}
        className="flex items-center gap-3 rounded-lg border border-l-[3px] border-border border-l-border px-3 py-2 text-left transition-all hover:border-gold/40"
      >
        <Folder className="size-5 shrink-0 text-gold" aria-hidden="true" />
        <span className="truncate text-sm font-medium">{folderName}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onFolderClick(folderPrefix)}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border-2 border-border text-left transition-all hover:border-gold/40"
    >
      <div className="relative flex aspect-square items-center justify-center bg-gradient-to-b from-amber-50/50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/20">
        <Folder className="size-12 text-gold/60" aria-hidden="true" />

        {fileCount > 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5 pt-6">
            <span className="text-[11px] font-medium text-white/90">
              {fileCount} file{fileCount !== 1 ? "s" : ""} &middot; {formatSize(totalSize)}
            </span>
          </div>
        )}
      </div>

      <div className="px-2.5 py-2">
        <p className="truncate text-xs font-medium">{folderName}</p>
      </div>
    </button>
  );
}

function ListRow({
  asset,
  selectable,
  manageMode = false,
  selected,
  preselected,
  usages,
  onToggleSelection,
  onCopy,
  onPrefetchUsage,
  previewable,
  onPreview,
}: TileProps) {
  const filename = asset.key.split("/").pop() ?? asset.key;
  const isImage = isImageFile(asset.key);
  const ext = getExtension(asset.key);
  const [imgError, setImgError] = useState(false);
  const isSelected = selected.has(asset.url);
  const isPreselected = preselected.has(asset.url);
  const relativeDate = useMemo(() => {
    const d = new Date(asset.lastModified);
    if (Number.isNaN(d.getTime())) return "";
    return formatDistanceToNow(d, { addSuffix: true });
  }, [asset.lastModified]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected || isPreselected || undefined}
      onClick={() => {
        if (manageMode) {
          if (previewable && (isImageFile(asset.key) || isVideoFile(asset.key)))
            onPreview?.(asset.url);
          else window.open(asset.url, "_blank", "noopener,noreferrer");
          return;
        }
        if (selectable) onToggleSelection(asset.url);
        else if (previewable && (isImageFile(asset.key) || isVideoFile(asset.key)))
          onPreview?.(asset.url);
        else window.open(asset.url, "_blank", "noopener,noreferrer");
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (manageMode) {
            if (previewable && (isImageFile(asset.key) || isVideoFile(asset.key)))
              onPreview?.(asset.url);
            else window.open(asset.url, "_blank", "noopener,noreferrer");
            return;
          }
          if (selectable) onToggleSelection(asset.url);
          else if (previewable && (isImageFile(asset.key) || isVideoFile(asset.key)))
            onPreview?.(asset.url);
          else window.open(asset.url, "_blank", "noopener,noreferrer");
        }
      }}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg border border-l-[3px] px-3 py-2 text-left transition-colors",
        isSelected || isPreselected
          ? "border-gold/60 border-l-gold bg-gold/5"
          : "border-border border-l-border hover:border-gold/40"
      )}
    >
      {manageMode && (
        <div
          className="shrink-0"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Checkbox
            aria-label={`Select ${filename}`}
            checked={isSelected}
            onCheckedChange={() => onToggleSelection(asset.url)}
            className="border-muted-foreground data-[state=checked]:border-gold data-[state=checked]:bg-gold"
          />
        </div>
      )}
      <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
        {isImage && !imgError ? (
          <AssetImage
            src={asset.url}
            alt={filename}
            fill
            className="object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <FileTypeIcon assetKey={asset.key} className="size-5 text-muted-foreground" />
          </div>
        )}
        {(isSelected || isPreselected) && (
          <div className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-gold">
            <Check className="size-2.5 text-black" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{filename}</p>
        <p className="flex items-center gap-2 truncate text-[10px] text-muted-foreground">
          {ext && (
            <Badge variant="outline" className="h-4 px-1 text-[9px] uppercase">
              {ext}
            </Badge>
          )}
          <span>{formatSize(asset.size)}</span>
          {relativeDate && <span>· {relativeDate}</span>}
        </p>
      </div>
      <UsageBadge url={asset.url} usages={usages} onHover={() => onPrefetchUsage(asset.url)} />
      <button
        type="button"
        aria-label={`Copy ${filename} URL`}
        onClick={(e) => {
          e.stopPropagation();
          onCopy(asset.url);
        }}
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Copy className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

interface UsageBadgeProps {
  url: string;
  usages?: Usage[];
  onHover: () => void;
}

function UsageBadge({ usages, onHover }: UsageBadgeProps) {
  const cached = usages !== undefined;
  const count = usages?.length ?? 0;
  const label = cached ? (count === 0 ? "Unused" : `Used by ${count}`) : "Used by …";

  const badge = (
    <Badge
      variant={count > 0 ? "secondary" : "outline"}
      className={cn(
        "pointer-events-auto gap-1 px-1.5 text-[9px]",
        count > 0
          ? "border-0 bg-white/20 text-white"
          : "border-white/30 bg-transparent text-white/80"
      )}
    >
      <Link2 className="size-2.5" aria-hidden="true" />
      {label}
    </Badge>
  );

  if (!cached || count === 0) {
    return (
      <span onMouseEnter={onHover} onFocus={onHover} className="pointer-events-auto">
        {badge}
      </span>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseEnter={onHover}
          onFocus={onHover}
          className="pointer-events-auto"
          aria-label="Show usage details"
        >
          {badge}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        className="w-64"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          onHover();
        }}
      >
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Used by
        </p>
        <ul className="flex flex-col gap-1.5">
          {usages?.map((u, i) => (
            <li key={`${u.type}-${u.id}-${i}`} className="flex items-center gap-2 text-xs">
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                {u.type}
              </span>
              <span className="flex-1 truncate">{u.label}</span>
              {u.url && (
                <a
                  href={u.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-gold hover:text-gold-light"
                  aria-label={`Open ${u.label}`}
                >
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              )}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

interface BulkActionBarProps {
  count: number;
  onCopy: () => void;
  onDelete: () => void;
  onDeselect: () => void;
}

function BulkActionBar({ count, onCopy, onDelete, onDeselect }: BulkActionBarProps) {
  return (
    <div
      role="region"
      aria-label={`${count} files selected`}
      className="sticky bottom-0 -mx-4 flex items-center justify-between gap-2 rounded-lg border bg-muted/50 px-4 py-3 sm:-mx-6 sm:px-6"
    >
      <span className="text-sm font-medium">{count} selected</span>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCopy}>
          <Copy className="size-4" />
          Copy URLs
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDelete}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" />
          Delete
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDeselect}>
          Deselect
        </Button>
      </div>
    </div>
  );
}
