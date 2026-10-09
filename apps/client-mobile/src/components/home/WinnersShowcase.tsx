import { ArrowRight, Sparkles, Trophy } from "@oc/icons";
import type { Winner } from "@oc/types";
import { useState } from "react";
import { GoldOutlineButton } from "@/components/buttons";
import { Link } from "@/components/Link";
import { BrandDialog } from "@/components/brand-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, useTranslation } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";

function getCompetitionTitle(w: Winner): string {
  if (typeof w.competitionId === "object" && w.competitionId !== null) {
    return w.competitionId.title ?? "";
  }
  return w.competitionTitle ?? w.competition?.title ?? "";
}

function getWinnerImage(w: Winner): string | undefined {
  return w.prizeImageUrl ?? w.winnerPhotoUrl;
}

export function WinnersShowcase({ winners: winnersRaw }: { winners: Winner[] }) {
  const { t, locale } = useTranslation();
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);

  function mapWinner(w: Winner) {
    return {
      id: w._id || w.id || "",
      name: w.displayName || t("home.winners.anonymousWinner"),
      initials: (w.displayName || t("home.winners.anonymousWinner"))
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2),
      prize: w.prizeTitle || t("home.winners.luxuryPrize"),
      prizeValue: w.prizeValue || 0,
      imageUrl: getWinnerImage(w),
      testimonial: w.testimonial,
      competitionTitle: getCompetitionTitle(w),
      winDate: w.drawnAt || new Date().toISOString(),
    };
  }

  const winners = winnersRaw.map(mapWinner);

  function openLightbox(winnerId: string) {
    const winner = winners.find((w) => w.id === winnerId);
    if (!winner?.imageUrl) return;
    setLightboxImages([winner.imageUrl]);
    setLightboxOpen(true);
  }

  if (winners.length === 0) return null;

  const featuredWinner = winners[0];
  const otherWinners = winners.slice(1, 6);

  return (
    <section className="py-16 sm:py-20 md:py-24 lg:py-28 bg-gradient-to-br from-gold/5 via-background to-gold/5 border-y border-gold/10 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-gold/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gold/10 rounded-full blur-3xl" />

      <div className="oc-container-wide relative z-10">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Trophy className="w-8 h-8 text-gold" />
            <h2 className="font-sans text-3xl sm:text-4xl md:text-5xl font-bold text-foreground tracking-tight">
              <span className="text-gold">{t("home.winners.heading")}</span>
            </h2>
            <Sparkles className="w-6 h-6 text-gold/60" />
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("home.winners.subtitle")}
          </p>
        </div>

        {otherWinners.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 mb-16 animate-fade-in-stagger">
            {otherWinners.map((winner) => (
              <button
                key={winner.id}
                type="button"
                onClick={() => openLightbox(winner.id)}
                aria-label={t("home.winners.viewImage", { name: winner.name })}
                data-umami-event="home:winners-thumbnail-click"
                data-umami-event-winner={winner.id}
                className="relative group cursor-pointer text-left w-full"
              >
                <div className="relative aspect-square overflow-hidden rounded-xl border border-gold/20 bg-card shadow-sm transition-colors duration-500 sm:rounded-2xl hover:border-gold/30">
                  {winner.imageUrl && !failedImages.has(winner.id) ? (
                    <img
                      src={winner.imageUrl}
                      alt={winner.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
                      onError={() => setFailedImages((prev) => new Set(prev).add(winner.id))}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gold/20 to-gold/5">
                      <Trophy className="w-10 h-10 text-gold/40" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 sm:opacity-0 flex items-end p-3 sm:p-4">
                    <div className="text-white">
                      <p className="font-semibold text-xs sm:text-sm mb-0.5">{winner.name}</p>
                      <p className="text-[10px] sm:text-xs text-gray-300 line-clamp-2">
                        {winner.competitionTitle}
                      </p>
                      {winner.prizeValue > 0 && (
                        <p className="text-xs sm:text-sm font-bold text-gold mt-1">
                          {formatCurrency(winner.prizeValue, locale)}
                        </p>
                      )}
                    </div>
                  </div>

                  {winner.prizeValue > 0 && (
                    <div className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-gold/90 backdrop-blur-sm text-primary-foreground text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                      £{(winner.prizeValue / 1000).toFixed(0)}k
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {featuredWinner && (
          <Card className="border-gold/20 bg-gradient-to-br from-card to-gold/5 overflow-hidden">
            <CardContent className="p-5 sm:p-6 md:p-8">
              <div className="flex flex-col md:flex-row gap-6 sm:gap-8 items-center">
                <button
                  type="button"
                  onClick={() => openLightbox(featuredWinner.id)}
                  aria-label={t("home.winners.viewImage", { name: featuredWinner.name })}
                  data-umami-event="home:winners-featured-click"
                  className="relative flex-shrink-0 cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 rounded-full"
                >
                  <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-gold/30 shadow-xl shadow-gold/10">
                    {featuredWinner.imageUrl && !failedImages.has(featuredWinner.id) ? (
                      <img
                        src={featuredWinner.imageUrl}
                        alt={featuredWinner.name}
                        className="w-full h-full object-cover"
                        sizes="(max-width: 768px) 96px, 128px"
                        loading="eager"
                        onError={() =>
                          setFailedImages((prev) => new Set(prev).add(featuredWinner.id))
                        }
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gold/10">
                        <Trophy className="w-12 h-12 text-gold/40" />
                      </div>
                    )}
                  </div>
                </button>

                <div className="flex-1 text-center md:text-left">
                  <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-2 sm:gap-3 mb-4">
                    <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-gold" />
                    <h3 className="font-sans text-xl sm:text-2xl font-bold text-foreground">
                      {featuredWinner.name}
                    </h3>
                    <div className="bg-gold text-primary-foreground text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md shadow-gold/20">
                      <Sparkles className="w-3 h-3" />
                      {t("home.winners.featuredWinner")}
                    </div>
                  </div>

                  {featuredWinner.testimonial && (
                    <blockquote className="text-sm sm:text-base text-muted-foreground italic mb-6 relative whitespace-pre-wrap">
                      <span className="text-3xl sm:text-4xl text-gold/20 absolute -top-2 -left-1">
                        &ldquo;
                      </span>
                      {featuredWinner.testimonial}
                      <span className="text-3xl sm:text-4xl text-gold/20 absolute -bottom-4 -right-1">
                        &rdquo;
                      </span>
                    </blockquote>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <p className="font-bold text-lg sm:text-xl text-gold">
                        {featuredWinner.prize}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Won {formatDate(featuredWinner.winDate)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-center mt-10 md:mt-12">
          <GoldOutlineButton asChild size="lg">
            <Link href="/winners" data-umami-event="home:winners-view-all">
              {t("home.winners.viewAll")}
              <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
            </Link>
          </GoldOutlineButton>
        </div>
      </div>

      <BrandDialog
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        mode="fullscreen"
        images={lightboxImages}
        currentIndex={0}
        onIndexChange={() => {}}
      />
    </section>
  );
}
