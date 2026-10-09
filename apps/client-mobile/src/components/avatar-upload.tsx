"use client";

import { AlertCircle, Trash2, Upload } from "@oc/icons";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Spinner } from "./ui/spinner";
import { UserAvatar } from "./user-avatar";

const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

function normalizeMime(type: string): string {
  const lower = type.trim().toLowerCase();
  return lower === "image/jpg" ? "image/jpeg" : lower;
}

function isAllowedAvatarFile(file: File): boolean {
  if (file.name.includes("\0") || file.name.includes("/") || file.name.includes("\\")) {
    return false;
  }
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext || !ALLOWED_EXT.has(ext)) return false;
  return ALLOWED_MIME.has(normalizeMime(file.type || ""));
}

export interface AvatarUploadProps {
  value?: string;
  initials: string;
  onUpload: (file: File) => void | Promise<void>;
  onRemove: () => void | Promise<void>;
  onImportGoogle?: () => void | Promise<void>;
  showImportGoogle?: boolean;
  isUploading?: boolean;
  isRemoving?: boolean;
  isImporting?: boolean;
  className?: string;
}

export function AvatarUpload({
  value,
  initials,
  onUpload,
  onRemove,
  onImportGoogle,
  showImportGoogle = false,
  isUploading = false,
  isRemoving = false,
  isImporting = false,
  className,
}: AvatarUploadProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBusy = isUploading || isRemoving || isImporting;

  const validateAndUpload = useCallback(
    async (file: File) => {
      setError(null);

      if (!isAllowedAvatarFile(file)) {
        setError(t("avatar.chooseImage"));
        return;
      }

      if (file.size > MAX_SIZE_BYTES) {
        setError(t("avatar.imageTooLarge"));
        return;
      }

      try {
        await onUpload(file);
        setOpen(false);
      } catch {
        // Parent surfaces errors; keep dialog open for retry.
      }
    },
    [onUpload]
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const file = Array.from(files).find((f) => isAllowedAvatarFile(f));
      if (file) void validateAndUpload(file);
    },
    [validateAndUpload]
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

  async function handleRemove() {
    setError(null);
    try {
      await onRemove();
      setOpen(false);
    } catch {
      // Parent surfaces errors.
    }
  }

  async function handleImportGoogle() {
    if (!onImportGoogle) return;
    setError(null);
    try {
      await onImportGoogle();
      setOpen(false);
    } catch {
      // Parent surfaces errors.
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (isBusy && !nextOpen) return;
    setOpen(nextOpen);
    if (!nextOpen) setError(null);
  }

  return (
    <>
      <button
        type="button"
        disabled={isBusy}
        onClick={() => setOpen(true)}
        data-umami-event="profile:avatar-upload-click"
        className={cn(
          "group relative size-20 shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isBusy && "cursor-not-allowed opacity-60",
          className
        )}
        aria-label={value ? t("avatar.changePicture") : t("avatar.addPicture")}
      >
        <UserAvatar
          avatarUrl={value}
          initials={initials}
          className="size-20"
          fallbackClassName="bg-muted text-xl font-semibold text-primary"
        />
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition-colors",
            !isBusy && "group-hover:bg-black/45"
          )}
        >
          <Upload
            className={cn(
              "size-5 text-white opacity-0 transition-opacity",
              !isBusy && "group-hover:opacity-100"
            )}
            aria-hidden="true"
          />
        </span>
        {isBusy ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
            <Spinner className="size-5 text-white" />
          </span>
        ) : null}
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("avatar.uploadDialogTitle")}</DialogTitle>
            <DialogDescription>{t("avatar.uploadDialogDesc")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4">
            <UserAvatar
              avatarUrl={value}
              initials={initials}
              className="size-24"
              fallbackClassName="bg-muted text-2xl font-semibold text-primary"
            />

            <button
              type="button"
              disabled={isBusy}
              onClick={() => !isBusy && fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "relative flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 text-center transition-colors",
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/50",
                isBusy && "cursor-not-allowed opacity-60"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                className="hidden"
                disabled={isBusy}
                onChange={(e) => {
                  if (e.target.files?.length) handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />

              <div
                className={cn(
                  "rounded-full bg-muted p-3 transition-colors",
                  isDragOver && "bg-primary/10"
                )}
              >
                {isUploading ? (
                  <Spinner className="size-6 text-muted-foreground" />
                ) : (
                  <Upload className="size-6 text-muted-foreground" aria-hidden="true" />
                )}
              </div>

              <div>
                <p className="text-sm font-medium">
                  {isDragOver ? t("avatar.dropHere") : t("avatar.uploadPhoto")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("avatar.dragAndDrop")}</p>
              </div>
            </button>

            {error ? (
              <p className="flex w-full items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                {error}
              </p>
            ) : null}
          </div>

          {(value || (showImportGoogle && onImportGoogle)) && (
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {value ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => void handleRemove()}
                    data-umami-event="profile:remove-avatar"
                  >
                    {isRemoving ? (
                      <>
                        <Spinner data-icon="inline-start" />
                        {t("avatar.removing")}
                      </>
                    ) : (
                      <>
                        <Trash2 data-icon="inline-start" />
                        {t("avatar.removePhoto")}
                      </>
                    )}
                  </Button>
                ) : null}

                {showImportGoogle && onImportGoogle ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => void handleImportGoogle()}
                    data-umami-event="profile:import-avatar"
                  >
                    {isImporting ? (
                      <>
                        <Spinner data-icon="inline-start" />
                        {t("avatar.importing")}
                      </>
                    ) : (
                      t("avatar.importFromGoogle")
                    )}
                  </Button>
                ) : null}
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
