"use client";

import type { S3Asset } from "@oc/api-storage/s3";
import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { MediaGrid } from "./MediaGrid";
import { FRAME_PREFIX } from "./types";

interface S3FilePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (urls: string[]) => void;
  multiple?: boolean;
  title?: string;
  initialPrefix?: string;
  selectedUrls?: string[];
}

export function S3FilePicker({
  open,
  onOpenChange,
  onSelect,
  multiple = false,
  title = "S3 Explorer",
  initialPrefix = "",
  selectedUrls = [],
}: S3FilePickerProps) {
  const isMobile = useMediaQuery("(max-width: 639px)");

  const handleSelect = (urls: string[]) => {
    if (multiple) {
      onSelect(urls);
    } else {
      onSelect(urls.slice(0, 1));
    }
    onOpenChange(false);
  };

  const safeInitialPrefix = useMemo(() => {
    if (initialPrefix?.startsWith(FRAME_PREFIX)) return "";
    return initialPrefix;
  }, [initialPrefix]);

  const content = (
    <MediaGrid
      key={open ? "open" : "closed"}
      initialPrefix={safeInitialPrefix}
      initialType="all"
      initialSort="newest"
      initialView="grid"
      selectable
      selectedUrls={selectedUrls}
      onSelect={handleSelect}
      layout="modal"
      multiple={multiple}
      showSelectButton
      previewable
    />
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex h-[92vh] max-h-[92vh] flex-col gap-0 overflow-hidden p-0"
          showCloseButton
        >
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle className="text-base">{title}</SheetTitle>
            <SheetDescription className="text-xs">
              Browse and select files from S3 storage.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-4">{content}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-dvh w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-none sm:rounded-lg sm:border">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Browse and select files from S3 storage.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">{content}</div>
      </DialogContent>
    </Dialog>
  );
}

export type { S3Asset };
