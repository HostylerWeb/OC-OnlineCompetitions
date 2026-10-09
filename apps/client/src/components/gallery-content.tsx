"use client";

import { ChevronLeft, ChevronRight, Minus, Plus, X } from "@oc/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const SWIPE_THRESHOLD = 60;
const SWIPE_COMMIT_RATIO = 0.22;

interface GalleryContentProps {
  images: string[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onClose: (open: boolean) => void;
  className?: string;
}

export function GalleryContent({
  images,
  currentIndex,
  onIndexChange,
  onClose,
  className,
}: GalleryContentProps) {
  const { t } = useTranslation();
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isHorizontalSwipe = useRef(false);

  const [isZoomed, setIsZoomed] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [slideTransition, setSlideTransition] = useState(true);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  useEffect(() => {
    setFailedImages(new Set());
  }, [images]);

  const visibleImages = images.filter((url) => !failedImages.has(url));

  const resetZoom = useCallback(() => {
    transformRef.current?.resetTransform();
    setIsZoomed(false);
  }, []);

  const goToIndex = useCallback(
    (index: number) => {
      if (index === currentIndex) return;
      setSlideTransition(true);
      setDragOffset(0);
      resetZoom();
      onIndexChange(index);
    },
    [currentIndex, onIndexChange, resetZoom]
  );

  const handlePrev = useCallback(() => {
    if (images.length <= 1) return;
    goToIndex(currentIndex === 0 ? images.length - 1 : currentIndex - 1);
  }, [currentIndex, goToIndex, images.length]);

  const handleNext = useCallback(() => {
    if (images.length <= 1) return;
    goToIndex(currentIndex === images.length - 1 ? 0 : currentIndex + 1);
  }, [currentIndex, goToIndex, images.length]);

  const handleThumbnailSelect = (index: number) => {
    if (index !== currentIndex) {
      goToIndex(index);
    } else {
      resetZoom();
    }
  };

  useEffect(() => {
    resetZoom();
    setDragOffset(0);
    setIsDragging(false);
  }, [currentIndex, resetZoom]);

  useEffect(() => {
    thumbnailRefs.current[currentIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [currentIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose(false);
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev, onClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isZoomed || e.touches.length !== 1) return;
    touchStartX.current = e.touches[0]?.clientX ?? null;
    touchStartY.current = e.touches[0]?.clientY ?? null;
    isHorizontalSwipe.current = false;
    setSlideTransition(false);
    setIsDragging(true);
    setDragOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isZoomed || touchStartX.current === null || e.touches.length !== 1) return;

    const touch = e.touches[0];
    if (!touch) return;

    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - (touchStartY.current ?? touch.clientY);

    if (!isHorizontalSwipe.current) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
      isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY);
    }

    if (!isHorizontalSwipe.current) return;

    e.preventDefault();
    setDragOffset(deltaX);
  };

  const handleTouchEnd = () => {
    if (isZoomed || touchStartX.current === null) return;

    const viewportWidth = viewportRef.current?.clientWidth ?? window.innerWidth;
    const commitThreshold = Math.max(SWIPE_THRESHOLD, viewportWidth * SWIPE_COMMIT_RATIO);

    setSlideTransition(true);
    setIsDragging(false);

    if (dragOffset > commitThreshold) {
      handlePrev();
    } else if (dragOffset < -commitThreshold) {
      handleNext();
    } else {
      setDragOffset(0);
    }

    touchStartX.current = null;
    touchStartY.current = null;
    isHorizontalSwipe.current = false;
  };

  const handleTransformed = (_ref: ReactZoomPanPinchRef, state: { scale: number }) => {
    setIsZoomed(state.scale > 1.02);
  };

  const handleImageLoad = useCallback(() => {
    requestAnimationFrame(() => {
      transformRef.current?.resetTransform();
    });
  }, []);

  return (
    <div className={cn("relative flex h-full w-full flex-col", className)}>
      <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-white/10 bg-black/80 px-4 backdrop-blur-lg">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => transformRef.current?.zoomIn()}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
            aria-label={t("imagePreview.zoomIn")}
          >
            <Plus className="h-4 w-4 text-white" />
          </button>
          <button
            type="button"
            onClick={() => transformRef.current?.zoomOut()}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
            aria-label={t("imagePreview.zoomOut")}
          >
            <Minus className="h-4 w-4 text-white" />
          </button>
          <span className="ml-2 text-sm font-medium text-white/80">
            {currentIndex + 1} / {visibleImages.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onClose(false)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
          aria-label={t("imagePreview.close")}
        >
          <X className="h-4 w-4 text-white" />
        </button>
      </div>

      <div
        ref={viewportRef}
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{ touchAction: isZoomed ? "none" : "pan-x pinch-zoom" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <div
          className={cn(
            "absolute inset-0 will-change-transform",
            slideTransition && !isDragging && !isZoomed
              ? "transition-transform duration-300 ease-out"
              : ""
          )}
          style={!isZoomed ? { transform: `translateX(${dragOffset}px)` } : undefined}
        >
          <TransformWrapper
            ref={transformRef}
            initialScale={1}
            minScale={1}
            maxScale={4}
            centerOnInit
            centerZoomedOut
            limitToBounds
            panning={{ disabled: !isZoomed, velocityDisabled: true }}
            pinch={{ step: 5 }}
            wheel={{ disabled: true }}
            doubleClick={{ mode: "toggle", step: 0.7 }}
            onTransform={handleTransformed}
            onInit={() => {
              requestAnimationFrame(() => {
                transformRef.current?.resetTransform();
              });
            }}
          >
            <TransformComponent
              wrapperClass="!h-full !w-full"
              contentClass="!flex !h-full !w-full items-center justify-center"
            >
              {/* next/image skip — react-zoom-pan-pinch needs DOM img */}
              {(() => {
                const src = visibleImages[currentIndex];
                if (!src) return null;
                return (
                  <img
                    key={src}
                    src={src}
                    alt={t("imagePreview.galleryItem", {
                      current: currentIndex + 1,
                      total: images.length,
                    })}
                    className="block h-auto max-h-full w-auto max-w-full select-none object-contain object-center"
                    draggable={false}
                    onLoad={handleImageLoad}
                    onError={() => setFailedImages((prev) => new Set(prev).add(src))}
                  />
                );
              })()}
            </TransformComponent>
          </TransformWrapper>
        </div>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-colors hover:bg-black/55 sm:left-4 sm:h-12 sm:w-12"
              aria-label={t("imagePreview.previousImage")}
            >
              <ChevronLeft className="h-6 w-6 text-white" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-colors hover:bg-black/55 sm:right-4 sm:h-12 sm:w-12"
              aria-label={t("imagePreview.nextImage")}
            >
              <ChevronRight className="h-6 w-6 text-white" />
            </button>
          </>
        )}
      </div>

      {visibleImages.length > 1 && (
        <div className="flex-shrink-0 border-t border-white/10 bg-black/80">
          <div className="flex gap-2 overflow-x-auto px-4 py-3 sm:gap-3">
            {visibleImages.map((img, idx) => (
              <button
                key={idx}
                ref={(el) => {
                  thumbnailRefs.current[idx] = el;
                }}
                type="button"
                onClick={() => handleThumbnailSelect(idx)}
                className={cn(
                  "relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border-2 transition-all sm:h-20 sm:w-20 md:h-24 md:w-24",
                  idx === currentIndex
                    ? "border-gold ring-2 ring-gold/40"
                    : "border-white/20 opacity-80 hover:border-gold/50 hover:opacity-100"
                )}
                aria-label={t("imagePreview.goToImage", { index: idx + 1 })}
                aria-current={idx === currentIndex ? "true" : undefined}
              >
                <img
                  src={img}
                  alt=""
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                  draggable={false}
                  onError={() => setFailedImages((prev) => new Set(prev).add(img))}
                />
              </button>
            ))}
          </div>
          <div className="flex justify-center gap-1.5 pb-3">
            {visibleImages.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleThumbnailSelect(idx)}
                className={cn(
                  "h-2 rounded-full transition-all",
                  idx === currentIndex ? "w-4 bg-gold" : "w-2 bg-white/40 hover:bg-white/60"
                )}
                aria-label={t("imagePreview.goToImage", { index: idx + 1 })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
