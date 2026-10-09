"use client";

import { ChevronLeft, ChevronRight, Maximize2, Minimize2, X, ZoomIn, ZoomOut } from "@oc/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";

export type ImagePreviewVariant = "full" | "large" | "medium" | "small";

const variantClasses: Record<ImagePreviewVariant, string> = {
  full: "max-w-[min(96vw,1400px)] h-[min(96dvh,1000px)]",
  large: "max-w-4xl h-[min(90dvh,820px)]",
  medium: "max-w-2xl h-[min(80dvh,680px)]",
  small: "max-w-lg h-[min(70dvh,560px)]",
};

interface ImagePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: string[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  variant?: ImagePreviewVariant;
  alt?: string;
}

export function ImagePreviewDialog({
  open,
  onOpenChange,
  images,
  currentIndex,
  onIndexChange,
  variant = "large",
  alt = "Image preview",
}: ImagePreviewDialogProps) {
  const { t } = useTranslation();
  const safeImages = images.filter(Boolean);
  const total = safeImages.length;
  const currentSrc = safeImages[currentIndex] ?? null;
  const hasMultiple = total > 1;

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{
    x: number;
    y: number;
    px: number;
    py: number;
  } | null>(null);
  const [failed, setFailed] = useState<Set<string>>(new Set());

  const imgRef = useRef<HTMLImageElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [currentIndex]);

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [open]);

  const goPrev = useCallback(() => {
    if (!hasMultiple) return;
    onIndexChange(currentIndex === 0 ? total - 1 : currentIndex - 1);
  }, [currentIndex, hasMultiple, onIndexChange, total]);

  const goNext = useCallback(() => {
    if (!hasMultiple) return;
    onIndexChange(currentIndex === total - 1 ? 0 : currentIndex + 1);
  }, [currentIndex, hasMultiple, onIndexChange, total]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      } else if (e.key === "ArrowLeft") {
        goPrev();
      } else if (e.key === "ArrowRight") {
        goNext();
      } else if (e.key === "+" || e.key === "=") {
        setZoom((z) => Math.min(z + 0.5, 4));
      } else if (e.key === "-") {
        setZoom((z) => Math.max(z - 0.5, 1));
      } else if (e.key === "0") {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, goNext, goPrev, onOpenChange]);

  const visibleImages = safeImages.filter((url) => !failed.has(url));
  const visibleTotal = visibleImages.length;
  const visibleIndex = visibleImages.indexOf(currentSrc ?? "");
  const counterText = hasMultiple
    ? `${visibleIndex >= 0 ? visibleIndex + 1 : currentIndex + 1} / ${visibleTotal}`
    : null;

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.5, 4));
  const handleZoomOut = () => {
    setZoom((z) => {
      const next = Math.max(z - 0.5, 1);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };
  const handleToggleZoom = () => {
    if (zoom > 1) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    } else {
      setZoom(2);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    if (e.button !== 0) return;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    setDragStart({ x: e.clientX, y: e.clientY, px: pan.x, py: pan.y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart || zoom <= 1) return;
    setPan({
      x: dragStart.px + (e.clientX - dragStart.x),
      y: dragStart.py + (e.clientY - dragStart.y),
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStart && (e.currentTarget as HTMLDivElement).hasPointerCapture(e.pointerId)) {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    }
    setDragStart(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(z + 0.25, 4));
    } else {
      setZoom((z) => {
        const next = Math.max(z - 0.25, 1);
        if (next === 1) setPan({ x: 0, y: 0 });
        return next;
      });
    }
  };

  if (!open || !currentSrc) return null;

  const isZoomed = zoom > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-slot="image-preview-dialog"
        showCloseButton={false}
        aria-describedby={undefined}
        className={cn(
          "flex flex-col gap-0 p-0 bg-black/95 border-white/10 shadow-2xl overflow-hidden",
          variantClasses[variant]
        )}
      >
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <DialogDescription className="sr-only">
          {hasMultiple
            ? `Image ${visibleIndex + 1} of ${visibleTotal}. Use arrow keys to navigate.`
            : "Image preview"}
        </DialogDescription>

        <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-2.5 border-b border-white/10 bg-black/60 flex-shrink-0">
          <div className="flex items-center gap-1 min-w-0">
            {counterText ? (
              <span className="text-xs font-medium text-white/80 tabular-nums">{counterText}</span>
            ) : null}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 1}
              aria-label={t("imagePreview.zoomOut")}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ZoomOut className="h-4 w-4 text-white" />
            </button>
            <button
              type="button"
              onClick={handleToggleZoom}
              aria-label={isZoomed ? t("imagePreview.resetZoom") : t("imagePreview.zoomIn")}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
            >
              {isZoomed ? (
                <Minimize2 className="h-4 w-4 text-white" />
              ) : (
                <Maximize2 className="h-4 w-4 text-white" />
              )}
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 4}
              aria-label={t("imagePreview.zoomIn")}
              className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ZoomIn className="h-4 w-4 text-white" />
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label={t("imagePreview.close")}
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
            >
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>

        <div
          ref={viewportRef}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={(e) => {
            if (e.target === e.currentTarget) onOpenChange(false);
          }}
          className={cn(
            "relative flex-1 min-h-0 overflow-hidden bg-black",
            isZoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
          )}
          style={{ touchAction: isZoomed ? "none" : "pan-y" }}
        >
          <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-6">
            <img
              ref={imgRef}
              key={currentSrc}
              src={currentSrc}
              alt={alt}
              draggable={false}
              onError={() => {
                if (currentSrc) {
                  setFailed((prev) => {
                    const next = new Set(prev);
                    next.add(currentSrc);
                    return next;
                  });
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleZoom();
              }}
              className={cn(
                "max-h-full max-w-full select-none object-contain rounded-md transition-transform duration-200",
                isZoomed && "duration-0"
              )}
              style={{
                transform: isZoomed
                  ? `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
                  : undefined,
              }}
            />
          </div>

          {hasMultiple && !isZoomed && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
                aria-label={t("imagePreview.previousImage")}
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition-all hover:bg-black/70 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
                aria-label={t("imagePreview.nextImage")}
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition-all hover:bg-black/70 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </button>
            </>
          )}
        </div>

        {hasMultiple && (
          <div className="flex-shrink-0 border-t border-white/10 bg-black/60 px-3 py-2 sm:px-4">
            <div className="flex gap-1.5 overflow-x-auto sm:gap-2 pb-0.5">
              {visibleImages.map((img, idx) => (
                <button
                  key={img}
                  type="button"
                  onClick={() => onIndexChange(safeImages.indexOf(img))}
                  aria-label={t("imagePreview.goToImage", { index: idx + 1 })}
                  aria-current={idx === visibleIndex ? "true" : undefined}
                  className={cn(
                    "relative h-12 w-12 sm:h-14 sm:w-14 flex-shrink-0 overflow-hidden rounded-md border-2 transition-all",
                    idx === visibleIndex
                      ? "border-gold ring-2 ring-gold/40"
                      : "border-white/20 opacity-60 hover:opacity-100 hover:border-white/40"
                  )}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" draggable={false} />
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
