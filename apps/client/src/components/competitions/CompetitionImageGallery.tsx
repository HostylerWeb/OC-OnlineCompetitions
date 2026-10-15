import { ChevronLeft, ChevronRight, Trophy, ZoomIn } from "@oc/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type CompetitionImageGalleryProps = {
  images: string[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  title: string;
  slug: string;
  failedImages: Set<string>;
  onImageError: (url: string) => void;
  onOpenLightbox: () => void;
  statusBadge: { label: string; className: string };
  soldOutLabel: string;
  isSoldOut: boolean;
};

export function CompetitionImageGallery({
  images,
  currentIndex,
  onIndexChange,
  title,
  slug,
  failedImages,
  onImageError,
  onOpenLightbox,
  statusBadge,
  soldOutLabel,
  isSoldOut,
}: CompetitionImageGalleryProps) {
  const mainImageUrl = images[currentIndex] ?? null;
  const hasMultiple = images.length > 1;

  const goPrev = () => {
    onIndexChange(currentIndex === 0 ? images.length - 1 : currentIndex - 1);
  };

  const goNext = () => {
    onIndexChange(currentIndex === images.length - 1 ? 0 : currentIndex + 1);
  };

  return (
    <div
      className="overflow-hidden rounded-2xl border border-white/10 bg-card/40 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.65)] ring-1 ring-white/5"
    >
      <div className="relative aspect-square bg-gradient-to-br from-gold/15 via-background to-background group">
        {mainImageUrl && !failedImages.has(mainImageUrl) ? (
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-zoom-in border-0 bg-transparent p-0"
            onClick={onOpenLightbox}
            aria-label="View full size"
            data-umami-event="competition:image-click"
            data-umami-event-id={slug}
          >
            <img
              key={mainImageUrl}
              src={mainImageUrl}
              alt={title}
              className="h-full w-full object-cover transition-opacity duration-300"
              onError={() => onImageError(mainImageUrl)}
            />
          </button>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Trophy className="h-24 w-24 text-gold/40" />
          </div>
        )}

        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30",
            hasMultiple ? "via-transparent" : ""
          )}
          aria-hidden
        />

        <button
          type="button"
          className="pointer-events-none absolute left-1/2 top-[42%] z-[1] flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white/90 opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
          tabIndex={-1}
          aria-hidden
        >
          <ZoomIn className="h-5 w-5" />
        </button>

        {hasMultiple && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 z-20 h-9 w-9 -translate-y-1/2 rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-md hover:bg-black/65 hover:text-white sm:left-3 sm:h-10 sm:w-10"
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              aria-label="Previous image"
              data-umami-event="competition:image-prev"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 z-20 h-9 w-9 -translate-y-1/2 rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-md hover:bg-black/65 hover:text-white sm:right-3 sm:h-10 sm:w-10"
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              aria-label="Next image"
              data-umami-event="competition:image-next"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}

        <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-wrap items-center gap-2">
          {isSoldOut ? (
            <Badge className="pointer-events-auto border-red-500/30 bg-red-500/25 text-red-300 backdrop-blur-sm">
              {soldOutLabel}
            </Badge>
          ) : (
            <Badge className={cn("pointer-events-auto backdrop-blur-sm", statusBadge.className)}>
              {statusBadge.label}
            </Badge>
          )}
        </div>

        {hasMultiple && (
          <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-col items-center gap-2 sm:bottom-4">
            <div
              className="flex max-w-full items-center gap-1.5 overflow-x-auto rounded-xl border border-white/15 bg-black/60 p-1.5 shadow-lg backdrop-blur-md scrollbar-hide"
              role="tablist"
              aria-label="Competition images"
            >
              {images.map((img, idx) => {
                const isActive = idx === currentIndex;
                return (
                  <button
                    type="button"
                    key={img}
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`Image ${idx + 1} of ${images.length}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onIndexChange(idx);
                    }}
                    data-umami-event="competition:thumbnail-click"
                    data-umami-event-index={idx}
                    className={cn(
                      "relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-md transition-all sm:h-12 sm:w-12",
                      isActive
                        ? "ring-2 ring-gold scale-105 opacity-100"
                        : "opacity-50 hover:opacity-90 ring-1 ring-white/20"
                    )}
                  >
                    <img
                      src={img}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={() => onImageError(img)}
                    />
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1.5" aria-hidden>
              {images.map((_, idx) => (
                <span
                  key={idx}
                  className={cn(
                    "h-1 rounded-full transition-all",
                    idx === currentIndex ? "w-4 bg-gold" : "w-1 bg-white/35"
                  )}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
