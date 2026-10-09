"use client";

import { api } from "@oc/api-admin";
import { Image as ImageIcon, Trash2, Upload } from "@oc/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ImagePreview } from "@/components/image-preview";
import { ImageUpload } from "@/components/image-upload";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface WinnerPortraitUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  winnerId: string;
  winnerLabel: string;
  competitionSlug: string;
  currentPortraitUrl?: string | null;
}

export function WinnerPortraitUploadDialog({
  open,
  onOpenChange,
  winnerId,
  winnerLabel,
  competitionSlug,
  currentPortraitUrl,
}: WinnerPortraitUploadDialogProps) {
  const queryClient = useQueryClient();
  const [pendingUrl, setPendingUrl] = useState<string | null>(currentPortraitUrl ?? null);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    if (open) {
      setPendingUrl(currentPortraitUrl ?? null);
      setUploadError("");
    }
  }, [open, currentPortraitUrl]);

  const saveMutation = useMutation({
    mutationFn: (payload: { winnerPhotoUrl: string | null }) =>
      api.put<{ _id: string; winnerPhotoUrl?: string | null }>(
        `/api/admin/winners/${winnerId}`,
        payload
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "winners"] });
      toast.success(pendingUrl ? "Portrait updated" : "Portrait removed");
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to update portrait");
    },
  });

  function handleSave() {
    saveMutation.mutate({ winnerPhotoUrl: pendingUrl });
  }

  function handleRemove() {
    if (currentPortraitUrl) {
      api
        .delete("/api/admin/media/assets", { params: { url: currentPortraitUrl } })
        .catch(() => {});
    }
    setPendingUrl(null);
  }

  function handleUploadError(message: string) {
    setUploadError(message);
  }

  const hasChanges = (pendingUrl ?? null) !== (currentPortraitUrl ?? null);
  const showRemoveButton = !!currentPortraitUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-gold/15 text-gold">
              <ImageIcon className="size-5" />
            </div>
            <div className="flex flex-col gap-1">
              <DialogTitle>Winner portrait</DialogTitle>
              <DialogDescription>{winnerLabel}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {pendingUrl ? (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Current portrait
              </p>
              <div className="mx-auto w-48">
                <ImagePreview
                  src={pendingUrl}
                  alt={`Portrait ${winnerLabel}`}
                  aspectRatio="square"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gold/30 bg-gradient-to-br from-gold/5 to-transparent p-6 text-center">
              <div className="rounded-full bg-gold/10 p-3">
                <Upload className="size-5 text-gold" />
              </div>
              <p className="text-sm font-semibold text-gold">No portrait uploaded</p>
              <p className="text-xs text-muted-foreground">
                The winners page will show initials until you upload a portrait.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {pendingUrl ? "Replace portrait" : "Upload portrait"}
            </p>
            <ImageUpload
              value={pendingUrl ?? ""}
              onUpload={(url) => {
                setPendingUrl(url || null);
                setUploadError("");
              }}
              onError={handleUploadError}
              slug={competitionSlug}
              maxSizeMB={10}
            />
            {uploadError ? (
              <p className="text-xs font-medium text-destructive">{uploadError}</p>
            ) : null}
          </div>

          {showRemoveButton ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRemove}
              className="self-start text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" />
              Remove portrait
            </Button>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saveMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saveMutation.isPending || !hasChanges}
          >
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
