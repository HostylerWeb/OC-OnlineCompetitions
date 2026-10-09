"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { GalleryContent } from "./gallery-content";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./ui/sheet";

const sizeClasses = {
  sm: "max-w-lg",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-5xl",
} as const;

type DialogSize = keyof typeof sizeClasses;

interface BrandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  mode?: "dialog" | "sheet" | "fullscreen";

  side?: "top" | "right" | "bottom" | "left";

  images?: string[];
  currentIndex?: number;
  onIndexChange?: (index: number) => void;

  variant?: "default" | "admin" | "gallery";
  size?: DialogSize;
  title?: string;
  description?: string;
  children?: ReactNode;
  className?: string;

  footer?: ReactNode;
  isPending?: boolean;
  confirmLabel?: string;
  onConfirm?: () => void;
}

function BrandDialog({
  open,
  onOpenChange,
  mode = "dialog",
  side = "right",
  images = [],
  currentIndex = 0,
  onIndexChange,
  variant = "default",
  size = "xl",
  title,
  description,
  children,
  className,
  footer,
  isPending,
  confirmLabel,
  onConfirm,
}: BrandDialogProps) {
  if (mode === "fullscreen" || variant === "gallery") {
    if (!open) return null;
    const galleryImages = images.length > 0 ? images : [];
    if (galleryImages.length === 0) return null;

    if (mode === "fullscreen") {
      return (
        <div
          data-slot="brand-dialog-fullscreen"
          className="fixed inset-0 z-[100] bg-black flex flex-col"
        >
          <GalleryContent
            images={galleryImages}
            currentIndex={currentIndex}
            onIndexChange={onIndexChange!}
            onClose={onOpenChange}
            className={className}
          />
        </div>
      );
    }

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          data-slot="dialog-content"
          className={cn(
            "p-0 bg-black/95 border-0 w-full max-h-[90vh] flex flex-col",
            sizeClasses[size]
          )}
          showCloseButton={false}
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">Image gallery</DialogTitle>
          <GalleryContent
            images={galleryImages}
            currentIndex={currentIndex}
            onIndexChange={onIndexChange!}
            onClose={onOpenChange}
            className={className}
          />
        </DialogContent>
      </Dialog>
    );
  }

  if (mode === "sheet") {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={side}
          data-slot="sheet-content"
          className={cn(
            "flex flex-col bg-card border-l border-gold/20 overflow-hidden p-0",
            className
          )}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <div className="h-1 w-full bg-gradient-to-r from-gold-light via-gold to-gold-dark flex-shrink-0" />

          {title ? (
            <div className="px-6 py-5 border-b border-gold/10 flex-shrink-0">
              <div className="flex items-center justify-between pr-8">
                <div>
                  <SheetTitle className="text-xl font-bold text-foreground">{title}</SheetTitle>
                  {description ? (
                    <SheetDescription className="text-muted-foreground text-sm mt-0.5">
                      {description}
                    </SheetDescription>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <SheetTitle className="sr-only">Panel</SheetTitle>
          )}

          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">{children}</div>

            {(footer || confirmLabel || onConfirm) && (
              <div className="px-6 py-5 border-t border-gold/10 bg-card/50 flex-shrink-0">
                <div className="flex items-center gap-3">
                  {onConfirm && (
                    <Button
                      type="submit"
                      disabled={isPending}
                      onClick={onConfirm}
                      className="bg-gold hover:bg-gold-dark text-black font-semibold disabled:opacity-50"
                    >
                      {isPending ? "Saving..." : (confirmLabel ?? "Confirm")}
                    </Button>
                  )}
                  {footer}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={isPending}
                    className="border-gold/20 text-foreground hover:bg-gold/10 hover:text-foreground"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-slot="dialog-content"
        className={cn("sm:max-w-md bg-card border-gold/20", className)}
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        {title ? (
          <div className="text-center">
            <DialogTitle className="text-lg font-bold text-foreground">
              <span className="text-gold">{title}</span>
            </DialogTitle>
            {description ? (
              <DialogDescription className="text-muted-foreground text-sm mt-1">
                {description}
              </DialogDescription>
            ) : null}
          </div>
        ) : (
          <DialogTitle className="sr-only">Dialog</DialogTitle>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}

export type { BrandDialogProps };
export { BrandDialog };
