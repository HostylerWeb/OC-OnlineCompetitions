"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  Flag,
  GripVertical,
  Image as ImageIcon,
  MoreVertical,
  RotateCcw,
  Star,
  Trash2,
  X,
} from "@oc/icons";
import { AssetImage } from "@/components/AssetImage";
import type { CompetitionImage } from "@/components/competition/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { UploadQueueItem } from "./SortableGridTile";

interface SortableListTileProps {
  img: CompetitionImage;
  isPrimary: boolean;
  isHero: boolean;
  qi?: UploadQueueItem;
  brokenImages: Set<string>;
  setBrokenImages: React.Dispatch<React.SetStateAction<Set<string>>>;
  onRemove: (url: string) => void;
  onAssignRole: (url: string, role: "primary" | "hero") => void;
  onClearRole: (role: "primary" | "hero") => void;
  readOnly: boolean;
}

export function SortableListTile({
  img,
  isPrimary,
  isHero,
  qi,
  brokenImages,
  setBrokenImages,
  onRemove,
  onAssignRole,
  onClearRole,
  readOnly,
}: SortableListTileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: img.url,
    disabled: readOnly,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isItemUploading = qi?.status === "pending" || qi?.status === "uploading";

  const fileName = img.url.split("?")[0].split("/").pop() ?? img.url.split("/").pop();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-lg border p-2.5 transition-all",
        isItemUploading && "opacity-60",
        isDragging && "opacity-40"
      )}
    >
      {!readOnly && (
        <button
          type="button"
          className={cn(
            "flex cursor-grab touch-none items-center justify-center rounded p-1 text-muted-foreground opacity-70 transition-colors hover:text-foreground",
            isItemUploading && "cursor-not-allowed text-muted-foreground/40"
          )}
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
          tabIndex={-1}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
      )}
      <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-muted">
        {brokenImages.has(img.url) ? (
          <div className="flex size-full items-center justify-center">
            <ImageIcon className="size-6 text-muted-foreground/50" aria-hidden="true" />
          </div>
        ) : (
          <AssetImage
            src={img.url}
            alt=""
            fill
            className="object-cover"
            onError={() => setBrokenImages((prev) => new Set(prev).add(img.url))}
          />
        )}
        {isItemUploading && qi ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/80">
            <Progress value={qi.progress} className="w-14" />
            <span className="text-[10px] font-medium">{qi.progress}%</span>
          </div>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{fileName}</span>
        <div className="flex flex-wrap gap-1">
          {isPrimary && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
              <Star className="size-2.5" aria-hidden="true" />
              Primary
            </span>
          )}
          {isHero && (
            <span className="inline-flex items-center gap-1 rounded-full bg-foreground/80 px-2 py-0.5 text-[10px] font-semibold text-background">
              <Flag className="size-2.5" aria-hidden="true" />
              Hero
            </span>
          )}
          {!isPrimary && !isHero && (
            <span className="text-xs text-muted-foreground">Pool image</span>
          )}
        </div>
      </div>
      {!readOnly && !isItemUploading && (
        <div className="flex shrink-0 items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                aria-label="Image actions"
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={() => onAssignRole(img.url, "primary")}
                disabled={isPrimary}
              >
                {isPrimary ? <Check className="size-4" /> : <Star className="size-4" />}
                {isPrimary ? "Primary" : "Set as Primary"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAssignRole(img.url, "hero")} disabled={isHero}>
                {isHero ? <Check className="size-4" /> : <Flag className="size-4" />}
                {isHero ? "Hero" : "Set as Hero"}
              </DropdownMenuItem>
              {isPrimary || isHero ? (
                <>
                  <DropdownMenuItem onClick={() => onClearRole(isPrimary ? "primary" : "hero")}>
                    <RotateCcw className="size-4" />
                    Clear role
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuItem variant="destructive" onClick={() => onRemove(img.url)}>
                <Trash2 className="size-4" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="flex size-7 items-center justify-center rounded-full bg-destructive/10 text-destructive opacity-80 transition-all hover:bg-destructive hover:text-destructive-foreground"
                aria-label="Remove image"
              >
                <X className="size-3.5" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove image?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the image from storage and unassign it from any
                  roles.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onRemove(img.url)}>Remove</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
