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
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface UploadQueueItem {
  id: string;
  fileName: string;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  url?: string;
  error?: string;
  doneAt?: number;
}

interface SortableImageTileProps {
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

export function SortableGridTile({
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
}: SortableImageTileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: img.url,
    disabled: readOnly,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isItemUploading = qi?.status === "pending" || qi?.status === "uploading";

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        className={cn(
          "group/card relative overflow-hidden py-0 transition-all",
          isItemUploading && "opacity-60",
          isDragging && "opacity-40"
        )}
      >
        <div className="relative aspect-[4/3] bg-muted">
          {!readOnly && (
            <button
              type="button"
              className={cn(
                "absolute top-2 left-2 z-10 flex cursor-grab touch-none items-center justify-center rounded bg-background/80 p-1 text-foreground backdrop-blur-sm opacity-0 transition-all group-hover/card:opacity-100",
                isItemUploading
                  ? "cursor-not-allowed text-muted-foreground/40"
                  : "hover:bg-background"
              )}
              aria-label="Drag to reorder"
              {...attributes}
              {...listeners}
              tabIndex={-1}
            >
              <GripVertical className="size-3.5" aria-hidden="true" />
            </button>
          )}
          <div className="absolute top-2 right-2 z-10 flex items-start gap-1">
            {(isPrimary || isHero) && (
              <div className="flex gap-1">
                {isPrimary && (
                  <span className="flex items-center gap-1 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground backdrop-blur-sm">
                    <Star className="size-3" aria-hidden="true" />
                    Primary
                  </span>
                )}
                {isHero && (
                  <span className="flex items-center gap-1 rounded-full bg-foreground/80 px-2 py-0.5 text-[10px] font-semibold text-background backdrop-blur-sm">
                    <Flag className="size-3" aria-hidden="true" />
                    Hero
                  </span>
                )}
              </div>
            )}
            {!readOnly && !isItemUploading && (
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
            )}
          </div>
          {brokenImages.has(img.url) ? (
            <div className="flex size-full items-center justify-center">
              <ImageIcon className="size-8 text-muted-foreground/50" aria-hidden="true" />
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
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80">
              <Progress value={qi.progress} className="w-24" />
              <span className="text-xs font-medium">{qi.progress}%</span>
            </div>
          ) : null}
        </div>
        {!readOnly && !isItemUploading && (
          <div className="flex items-center border-t bg-muted/30 px-2 py-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  aria-label="Image actions"
                >
                  <MoreVertical className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
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
          </div>
        )}
      </Card>
    </div>
  );
}
