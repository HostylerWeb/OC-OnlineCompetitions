"use client";

import { GalleryContent } from "./gallery-content";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";

interface ZoomableImageGalleryProps {
  images: string[];
  open: boolean;
  onClose: (open: boolean) => void;
  currentIndex: number;
  onIndexChange: (index: number) => void;
  variant?: "dialog" | "fullscreen";
  className?: string;
}

export function ZoomableImageGallery({
  images,
  open,
  onClose,
  currentIndex,
  onIndexChange,
  variant = "dialog",
  className,
}: ZoomableImageGalleryProps) {
  if (!open) return null;

  if (variant === "fullscreen") {
    return (
      <div
        data-slot="brand-dialog-fullscreen"
        className={`fixed inset-0 z-[100] flex flex-col bg-black ${className ?? ""}`}
      >
        <GalleryContent
          images={images}
          currentIndex={currentIndex}
          onIndexChange={onIndexChange}
          onClose={onClose}
        />
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="flex max-h-[90vh] w-full max-w-5xl flex-col border-0 bg-black/95 p-0"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Image gallery</DialogTitle>
        <GalleryContent
          images={images}
          currentIndex={currentIndex}
          onIndexChange={onIndexChange}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
