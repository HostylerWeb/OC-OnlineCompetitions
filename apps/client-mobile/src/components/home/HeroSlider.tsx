import { ArrowRight, ChevronLeft, ChevronRight, TrendingUp } from "@oc/icons";
import type { Competition } from "@oc/types";
import { cn } from "@oc/utils";

import { useCallback, useEffect, useRef, useState } from "react";
import { GoldOutlineButton } from "@/components/buttons";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, useTranslation } from "@/lib/i18n";

const SLIDE_MIN_HEIGHT = "min-h-[420px] sm:min-h-[480px] md:aspect-video md:max-h-[80vh]";

const CAROUSEL_BOTTOM = "bottom-4 sm:bottom-6 lg:bottom-8 xl:bottom-10";

const SLIDE_PADDING = "pt-2 sm:pt-3 pb-8 sm:pb-10 lg:pb-12 xl:pb-14";

const AUTOPLAY_MS = 7000;

const HERO_TITLE_SHADOW =
  "[text-shadow:0_2px_4px_rgba(0,0,0,0.95),0_4px_14px_rgba(0,0,0,0.7),0_0_28px_rgba(0,0,0,0.5)]";
const HERO_TEXT_SHADOW =
  "[text-shadow:0_1px_3px_rgba(0,0,0,0.9),0_3px_10px_rgba(0,0,0,0.65),0_0_20px_rgba(0,0,0,0.45)]";

function HeroCtaRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-row flex-wrap items-stretch gap-2.5 sm:gap-3 w-full">{children}</div>
  );
}

function HeroCtaLink({
  to,
  children,
  className,
  ...rest
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href={to}
      className={cn("flex-1 min-w-[calc(50%-0.375rem)] sm:min-w-[8.5rem]", className)}
      {...rest}
    >
      {children}
    </a>
  );
}

function SlideIndicators({
  count,
  current,
  onSelect,
  className,
}: {
  count: number;
  current: number;
  onSelect: (index: number) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  if (count <= 1) return null;

  return (
    <div
      className={cn("flex items-center justify-center gap-1.5 sm:gap-2", className)}
      role="tablist"
      aria-label={t("home.hero.carouselNav")}
    >
      {Array.from({ length: count }, (_, index) => (
        <button
          key={index}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(index);
          }}
          aria-label={t("home.hero.goToSlide", { current: index + 1, total: count })}
          aria-selected={index === current}
          role="tab"
          data-umami-event="hero:slide-select"
          data-umami-event-slide={index}
          className="group relative flex h-11 min-w-[44px] items-center justify-center touch-manipulation active:scale-90 transition-transform duration-150"
        >
          <span
            className={cn(
              "block rounded-full transition-all duration-300 shadow-sm",
              index === current
                ? "h-2 w-8 bg-gold ring-2 ring-gold/30"
                : "h-2 w-2 bg-white/50 group-hover:bg-white/80 group-active:bg-white"
            )}
          />
        </button>
      ))}
    </div>
  );
}

function SlideScrim() {
  return (
    <>
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div className="absolute inset-0 z-10 hidden md:block bg-gradient-to-r from-black/30 via-black/5 to-transparent" />
    </>
  );
}

function FeaturedBadge() {
  const { t } = useTranslation();
  return (
    <Badge className="inline-flex max-w-full items-center bg-gold/90 text-primary-foreground border-0 px-3 py-1.5 text-xs sm:text-sm font-semibold tracking-wide uppercase whitespace-normal text-left shadow-sm">
      <TrendingUp className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" aria-hidden />
      {t("home.hero.featured")}
    </Badge>
  );
}

function BottomContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative z-20 mx-auto flex h-full w-full flex-col oc-container-wide",
        SLIDE_PADDING,
        className
      )}
    >
      {children}
    </div>
  );
}

export function HeroSlider({ competitions }: { competitions: Competition[] }) {
  const { t, locale } = useTranslation();
  const slides = competitions;

  const [currentSlide, setCurrentSlide] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

  const dragStartX = useRef<number | null>(null);
  const hasDragged = useRef(false);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAutoPlay = useCallback(() => {
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
      autoPlayRef.current = null;
    }
  }, []);

  const startAutoPlay = useCallback(() => {
    if (slides.length <= 1) return;
    stopAutoPlay();
    autoPlayRef.current = setInterval(() => {
      setCurrentSlide((i) => (i + 1) % slides.length);
    }, AUTOPLAY_MS);
  }, [slides.length, stopAutoPlay]);

  const goToNext = useCallback(() => {
    setCurrentSlide((i) => (i + 1) % slides.length);
    startAutoPlay();
  }, [slides.length, startAutoPlay]);

  const goToPrev = useCallback(() => {
    setCurrentSlide((i) => (i - 1 + slides.length) % slides.length);
    startAutoPlay();
  }, [slides.length, startAutoPlay]);

  const goToSlide = useCallback(
    (index: number) => {
      setCurrentSlide(index);
      startAutoPlay();
    },
    [startAutoPlay]
  );

  useEffect(() => {
    startAutoPlay();
    return () => stopAutoPlay();
  }, [startAutoPlay, stopAutoPlay]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (slides.length <= 1) return;
    dragStartX.current = e.clientX;
    hasDragged.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragStartX.current === null) return;
    if (Math.abs(e.clientX - dragStartX.current) > 5) hasDragged.current = true;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragStartX.current === null) return;
    const target = e.target as HTMLElement;
    if (target.closest("a, button")) return;
    const diff = e.clientX - dragStartX.current;
    dragStartX.current = null;
    if (hasDragged.current) {
      if (Math.abs(diff) > 50) {
        if (diff > 0) goToPrev();
        else goToNext();
      }
    } else {
      const current = slides[currentSlide];
      if (current) window.location.href = `/competitions/${current.slug || current.id}`;
    }
  };

  if (slides.length === 0) {
    return (
      <section className={cn("relative w-full overflow-hidden", SLIDE_MIN_HEIGHT)}>
        <div className="absolute inset-0 bg-gradient-to-br from-gold/20 via-background to-background" />
        <div className="absolute top-0 left-1/4 h-64 w-64 rounded-full bg-gold/15 blur-3xl opacity-40" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-gold/15 blur-3xl opacity-40" />
        <SlideScrim />

        <BottomContent>
          <div className="shrink-0 pt-2 sm:pt-3">
            <FeaturedBadge />
          </div>
          <div className="flex-1 min-h-0" />
          <div className="shrink-0 mb-32 sm:mb-36 lg:mb-40">
            <h1 className="max-w-4xl text-[clamp(1.75rem,5vw,3.5rem)] font-bold leading-[1.08] tracking-tight text-foreground break-words drop-shadow-sm">
              <span className="text-gold">{t("home.hero.fallbackHeading")}</span>{" "}
              {t("home.hero.fallbackSubheading")}
            </h1>
            <p className="max-w-2xl text-[clamp(0.9375rem,1.2vw+0.5rem,1.125rem)] leading-relaxed text-muted-foreground break-words mt-3 sm:mt-4">
              {t("home.hero.fallbackDescription")}
            </p>
            <div className="mt-4 sm:mt-5">
              <HeroCtaRow>
                <HeroCtaLink
                  to="/competitions"
                  data-umami-event="hero:cta-click"
                  data-umami-event-cta="Enter Now"
                >
                  <GoldOutlineButton>
                    {t("home.hero.enterNow")}
                    <ArrowRight className="ml-2 h-4 w-4 shrink-0" />
                  </GoldOutlineButton>
                </HeroCtaLink>
                <HeroCtaLink
                  to="/competitions"
                  data-umami-event="hero:cta-click"
                  data-umami-event-cta="View All"
                >
                  <GoldOutlineButton>{t("home.hero.viewAll")}</GoldOutlineButton>
                </HeroCtaLink>
              </HeroCtaRow>
            </div>
          </div>
        </BottomContent>
      </section>
    );
  }

  return (
    <section
      className="relative z-0 w-full overflow-hidden select-none"
      style={{ cursor: slides.length > 1 ? "grab" : "pointer", touchAction: "manipulation" }}
      aria-label={t("home.hero.featuredCarousel")}
      aria-roledescription="carousel"
      onMouseEnter={stopAutoPlay}
      onMouseLeave={startAutoPlay}
      onFocusCapture={stopAutoPlay}
      onBlurCapture={startAutoPlay}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        className="flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: `translateX(-${currentSlide * 100}%)`, touchAction: "pan-y" }}
      >
        {slides.map((s, index) => {
          const heroImage = s.heroImageUrl ?? s.imageUrl;
          const isActive = index === currentSlide;

          return (
            <div
              key={s.slug}
              className={cn("relative w-full shrink-0", SLIDE_MIN_HEIGHT)}
              role="group"
              aria-roledescription="slide"
              aria-label={t("home.hero.slideOf", { current: index + 1, total: slides.length })}
              aria-hidden={!isActive}
              data-umami-event="hero:slide-click"
              data-umami-event-id={s.slug}
            >
              <div className="absolute inset-0 overflow-hidden">
                {heroImage && !failedImages.has(index) ? (
                  <img
                    src={heroImage}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-[8000ms] ease-linear"
                    sizes="100vw"
                    loading={index === 0 ? "eager" : undefined}
                    draggable={false}
                    onError={() => setFailedImages((prev) => new Set(prev).add(index))}
                    style={{ transform: isActive ? "scale(1.05)" : "scale(1)" }}
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-gold/30 via-background to-background" />
                )}
                <SlideScrim />
              </div>

              <BottomContent>
                <div className="shrink-0 pt-2 sm:pt-3">
                  <FeaturedBadge />
                </div>
                <div className="flex-1 min-h-0" />
                <div className="shrink-0 mb-32 sm:mb-36 lg:mb-40">
                  <h1
                    className={cn(
                      "text-[clamp(1.5rem,4vw,3.25rem)] font-bold leading-[1.08] tracking-tight text-gold break-words",
                      HERO_TITLE_SHADOW
                    )}
                  >
                    {s.title}
                  </h1>
                  {(s.shortDescription || s.description) && (
                    <p
                      className={cn(
                        "max-w-2xl text-[clamp(1rem,1.4vw+0.55rem,1.375rem)] leading-relaxed text-white/90 break-words line-clamp-2 sm:line-clamp-3",
                        HERO_TEXT_SHADOW
                      )}
                    >
                      {s.shortDescription || s.description}
                    </p>
                  )}
                  <p className="text-[clamp(1.125rem,3vw,2.4375rem)] font-bold leading-[1.08] tracking-tight text-white/85 mt-2 sm:mt-3">
                    {s.ticketPrice === 0 ? (
                      t("home.free")
                    ) : s.originalPrice != null && s.originalPrice > s.ticketPrice ? (
                      <>
                        <span className="line-through text-white/50 mr-1.5">
                          {formatCurrency(s.originalPrice, locale, "GBP")}
                        </span>
                        {formatCurrency(s.ticketPrice, locale, "GBP")}
                        {t("home.perTicket")}
                      </>
                    ) : (
                      <>
                        {formatCurrency(s.ticketPrice, locale, "GBP")}
                        {t("home.perTicket")}
                      </>
                    )}
                  </p>
                </div>
              </BottomContent>
            </div>
          );
        })}
      </div>

      {slides.length > 1 && (
        <SlideIndicators
          count={slides.length}
          current={currentSlide}
          onSelect={goToSlide}
          className={cn("absolute left-1/2 z-30 -translate-x-1/2", CAROUSEL_BOTTOM)}
        />
      )}

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
            aria-label={t("home.hero.previousSlide")}
            data-umami-event="hero:slide-prev"
            className="absolute top-0 bottom-0 left-0 z-30 flex w-11 items-center justify-start pl-0.5 sm:w-14 sm:pl-2 md:w-20 md:pl-4 touch-manipulation group"
          >
            <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-r from-black/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <ChevronLeft className="relative h-[9.375rem] w-20 text-white opacity-50 transition-opacity duration-300 group-hover:opacity-100" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            aria-label={t("home.hero.nextSlide")}
            data-umami-event="hero:slide-next"
            className="absolute top-0 bottom-0 right-0 z-30 flex w-11 items-center justify-end pr-0.5 sm:w-14 sm:pr-2 md:w-20 md:pr-4 touch-manipulation group"
          >
            <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-l from-black/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <ChevronRight className="relative h-[9.375rem] w-20 text-white opacity-50 transition-opacity duration-300 group-hover:opacity-100" />
          </button>
        </>
      )}
    </section>
  );
}
