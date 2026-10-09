"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { api } from "@oc/api-admin";
import { LayoutGrid, List, Plus, Upload } from "@oc/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { CompetitionImage } from "@/components/competition/types";
import { S3FilePicker } from "@/components/media/S3FilePicker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { UploadQueueItem } from "./SortableGridTile";
import { SortableGridTile } from "./SortableGridTile";
import { SortableListTile } from "./SortableListTile";

export type { UploadQueueItem };

interface ImageGalleryProps {
  images: CompetitionImage[];
  onChange: (
    images: CompetitionImage[] | ((prev: CompetitionImage[]) => CompetitionImage[])
  ) => void;
  onAssignRole: (url: string, role: "primary" | "hero") => void;
  onClearRole: (role: "primary" | "hero") => void;
  slug?: string;
  maxImages?: number;
  readOnly?: boolean;
  className?: string;
  onUploadsInFlightChange?: (inFlight: boolean) => void;
  onSessionUploadedUrl?: (url: string) => void;
  legend?: string;
  description?: string;
}

interface UploadingTileProps {
  qi: UploadQueueItem;
}

function UploadingTile({ qi }: UploadingTileProps) {
  return (
    <Card className="overflow-hidden py-0 opacity-80">
      <div className="relative aspect-[4/3] bg-muted">
        <div className="flex size-full flex-col items-center justify-center gap-2 bg-background/60">
          <Upload className="size-6 text-muted-foreground/60" aria-hidden="true" />
          <Progress value={qi.progress} className="w-20" />
          <span className="text-[10px] font-medium text-muted-foreground">
            {qi.progress}% — {qi.fileName}
          </span>
        </div>
      </div>
    </Card>
  );
}

export function ImageGallery({
  images,
  onChange,
  onAssignRole,
  onClearRole,
  slug,
  maxImages,
  readOnly = false,
  className,
  onUploadsInFlightChange,
  onSessionUploadedUrl,
}: ImageGalleryProps) {
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window === "undefined") return "list";
    const stored = localStorage.getItem("admin-image-gallery-view-mode");
    if (stored === "grid" || stored === "list") return stored;
    return "list";
  });

  useEffect(() => {
    localStorage.setItem("admin-image-gallery-view-mode", viewMode);
  }, [viewMode]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const DURATION = 3000;
    const interval = setInterval(() => {
      const cutoff = Date.now() - DURATION;
      setQueue((q) =>
        q.filter((item) => !(item.status === "done" && item.doneAt && item.doneAt < cutoff))
      );
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setBrokenImages(new Set());
  }, [images?.map((i) => i.url).join("|")]);

  const primaryUrl = images.find((i) => i.roles.includes("primary"))?.url;
  const heroUrl = images.find((i) => i.roles.includes("hero"))?.url;

  const uploadFile = useCallback(
    async (file: File, itemId: string) => {
      const toastId = toast.loading(`Uploading ${file.name}...`);

      setQueue((q) =>
        q.map((i) => (i.id === itemId ? { ...i, status: "uploading", progress: 10 } : i))
      );

      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const random = Math.random().toString(36).slice(2);
      const key = slug
        ? `prizes/${slug}/${Date.now()}-${random}.${ext}`
        : `uploads/${Date.now()}-${random}.${ext}`;

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("key", key);
        const uploadRes = await fetch("/api/admin/media/upload", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) {
          throw new Error(`Upload failed: ${uploadRes.status}`);
        }
        const uploadData = await uploadRes.json();
        const { publicUrl } = uploadData.data ?? uploadData;

        setQueue((q) =>
          q.map((i) =>
            i.id === itemId
              ? { ...i, progress: 100, status: "done", url: publicUrl, doneAt: Date.now() }
              : i
          )
        );

        onChange((prev) => [...prev, { url: publicUrl, roles: [] }]);
        onSessionUploadedUrl?.(publicUrl);
        toast.success(`Uploaded ${file.name}`, { id: toastId });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setQueue((q) =>
          q.map((i) => (i.id === itemId ? { ...i, status: "error", error: msg } : i))
        );
        toast.error(`Failed: ${file.name}`, { id: toastId, description: msg });
      }
    },
    [slug, onChange, onSessionUploadedUrl]
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (arr.length === 0) return;

      if (maxImages && images.length >= maxImages) {
        toast.error(`Maximum ${maxImages} images reached.`);
        return;
      }

      const remaining = maxImages ? maxImages - images.length : arr.length;
      const toUpload = arr.slice(0, remaining);

      const newItems: UploadQueueItem[] = toUpload.map((file) => {
        const id = Math.random().toString(36).slice(2, 10);
        return { id, fileName: file.name, status: "pending" as const, progress: 0 };
      });
      setQueue((q) => [...q, ...newItems]);

      onUploadsInFlightChange?.(true);

      void (async () => {
        const uploads = toUpload.map(async (file, i) => {
          const itemId = newItems[i]?.id;
          if (itemId) await uploadFile(file, itemId);
        });
        await Promise.all(uploads);
        onUploadsInFlightChange?.(false);
      })();
    },
    [maxImages, images.length, uploadFile, onUploadsInFlightChange]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleRemove = useCallback(
    async (imgUrl: string) => {
      try {
        await api.delete("/api/admin/media/assets", { params: { url: imgUrl } });
        toast.success("Image removed");
        onChange((prev) => prev.filter((i) => i.url !== imgUrl));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to remove image";
        toast.error("Failed to remove image", {
          description: msg,
          action: { label: "Retry", onClick: () => handleRemove(imgUrl) },
        });
      }
    },
    [onChange]
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onChange((prev) => {
      const oldIndex = prev.findIndex((i) => i.url === active.id);
      const newIndex = prev.findIndex((i) => i.url === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function handleBrowseSelect(urls: string[]) {
    onChange((prev) => {
      const existing = new Set(prev.map((i) => i.url));
      const next = [
        ...prev,
        ...urls.filter((u) => !existing.has(u)).map((url) => ({ url, roles: [] })),
      ];
      return next;
    });
  }

  const canAddMore = !maxImages || images.length < maxImages;
  const queueItemForUrl = useCallback((url: string) => queue.find((i) => i.url === url), [queue]);

  const uploadingItems = queue.filter(
    (qi) => !qi.url || (qi.status !== "done" && qi.status !== "error")
  );

  return (
    <div
      className={cn("flex flex-col gap-4", className)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {images.length > 0 || queue.length > 0 ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(v) => v && setViewMode(v as "grid" | "list")}
                size="sm"
              >
                <ToggleGroupItem value="grid" aria-label="Grid view">
                  <LayoutGrid className="size-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="List view">
                  <List className="size-4" />
                </ToggleGroupItem>
              </ToggleGroup>
              <span className="text-sm text-muted-foreground">
                {images.length}
                {maxImages ? ` / ${maxImages}` : ""} images
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!readOnly && canAddMore && (
                <Button type="button" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="size-4" />
                  Upload
                </Button>
              )}
              {!readOnly && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPickerOpen(true)}
                >
                  Browse Storage
                </Button>
              )}
            </div>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={images.map((i) => i.url)}
              strategy={verticalListSortingStrategy}
            >
              {viewMode === "grid" ? (
                <div className="grid grid-cols-2 gap-4 @md:grid-cols-3 @lg:grid-cols-4">
                  {images.map((img) => (
                    <SortableGridTile
                      key={img.url}
                      img={img}
                      isPrimary={img.url === primaryUrl}
                      isHero={img.url === heroUrl}
                      qi={queueItemForUrl(img.url)}
                      brokenImages={brokenImages}
                      setBrokenImages={setBrokenImages}
                      onRemove={handleRemove}
                      onAssignRole={onAssignRole}
                      onClearRole={onClearRole}
                      readOnly={readOnly}
                    />
                  ))}
                  {uploadingItems.map((qi) => (
                    <UploadingTile key={qi.id} qi={qi} />
                  ))}
                  {!readOnly && canAddMore && (
                    <AddImageTile
                      onClick={() => fileInputRef.current?.click()}
                      onPointerDown={(e) => e.stopPropagation()}
                      isDragOver={isDragOver}
                    />
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {images.map((img) => (
                    <SortableListTile
                      key={img.url}
                      img={img}
                      isPrimary={img.url === primaryUrl}
                      isHero={img.url === heroUrl}
                      qi={queueItemForUrl(img.url)}
                      brokenImages={brokenImages}
                      setBrokenImages={setBrokenImages}
                      onRemove={handleRemove}
                      onAssignRole={onAssignRole}
                      onClearRole={onClearRole}
                      readOnly={readOnly}
                    />
                  ))}
                  {uploadingItems.length > 0 && (
                    <div className="grid grid-cols-4 gap-4">
                      {uploadingItems.map((qi) => (
                        <UploadingTile key={qi.id} qi={qi} />
                      ))}
                    </div>
                  )}
                  {!readOnly && canAddMore && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      onPointerDown={(e) => e.stopPropagation()}
                      className={cn(
                        "flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 transition-colors",
                        isDragOver
                          ? "border-primary bg-primary/5"
                          : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50"
                      )}
                    >
                      <Plus className="size-5 text-muted-foreground" aria-hidden="true" />
                      <span className="text-sm font-medium text-muted-foreground">Add images</span>
                    </button>
                  )}
                </div>
              )}
            </SortableContext>
          </DndContext>
        </>
      ) : (
        <div
          role={!readOnly && canAddMore ? "button" : undefined}
          tabIndex={!readOnly && canAddMore ? 0 : undefined}
          onClick={() => {
            if (canAddMore && !readOnly) fileInputRef.current?.click();
          }}
          onKeyDown={(e) => {
            if (!canAddMore || readOnly) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 transition-colors",
            !readOnly && canAddMore && "cursor-pointer",
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50"
          )}
        >
          <div
            className={cn(
              "rounded-full bg-muted p-4 transition-colors",
              isDragOver && "bg-primary/10"
            )}
          >
            <Upload className="size-8 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">
              {isDragOver ? "Drop images here" : "Drag & drop images or click to upload"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Images upload automatically</p>
            {!readOnly && (
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setPickerOpen(true);
                }}
                className="mt-2 h-auto text-xs text-gold underline underline-offset-2"
              >
                Browse Storage
              </Button>
            )}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      <S3FilePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handleBrowseSelect}
        multiple
        initialPrefix={slug ? `prizes/${slug}/` : "prizes/"}
        selectedUrls={images.map((i) => i.url)}
      />
    </div>
  );
}

function AddImageTile({
  onClick,
  onPointerDown,
  isDragOver,
}: {
  onClick: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  isDragOver: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      className={cn(
        "flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors",
        isDragOver
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50"
      )}
    >
      <div className="rounded-full bg-muted p-3">
        <Plus className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <span className="text-xs font-medium text-muted-foreground">Add images</span>
    </button>
  );
}
