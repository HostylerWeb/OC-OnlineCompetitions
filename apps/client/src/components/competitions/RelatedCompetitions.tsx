"use client";

import { Trophy } from "@oc/icons";
import type { Competition } from "@oc/types";
import { CompetitionProgressBar } from "@/components/ui/competition-progress-bar";
import { formatCurrency, useTranslation } from "@/lib/i18n";

export default function RelatedCompetitions({ competitions }: { competitions: Competition[] }) {
  const { t, locale } = useTranslation();

  return (
    <section className="pt-6 lg:pt-8 mt-6 lg:mt-8">
      <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-4 lg:mb-6 text-center">
        {t("competitions.related.heading")}
      </h2>
      <div className="grid onlinecompetitions-grid-competitions">
        {competitions.map((comp) => {
          return (
            <a key={comp._id} href={`/competitions/${comp.slug}`} className="group block">
              <div className="relative overflow-hidden rounded-[1.5rem]">
                <div className="p-1.5 rounded-[1.5rem] bg-white/5 ring-1 ring-white/10 hover:ring-gold/30 transition-all duration-500">
                  <div className="rounded-[calc(1.5rem-0.375rem)] bg-card overflow-hidden">
                    <div className="aspect-square bg-gradient-to-br from-gold/10 to-gold/5 relative">
                      {comp.prizeImageUrl || comp.imageUrl ? (
                        <img
                          src={(comp.prizeImageUrl || comp.imageUrl)!}
                          alt={comp.title}
                          className="object-cover"
                          style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Trophy className="w-10 h-10 text-gold/30" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="font-semibold text-foreground text-sm truncate group-hover:text-gold transition-colors">
                        {comp.title}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-gold font-bold text-sm">
                          {comp.originalPrice != null &&
                          comp.originalPrice > (comp.ticketPrice ?? 0) ? (
                            <>
                              <span className="line-through text-muted-foreground mr-1">
                                {formatCurrency(comp.originalPrice, locale, "GBP")}
                              </span>
                              {formatCurrency(comp.ticketPrice ?? 0, locale, "GBP")}
                            </>
                          ) : (
                            formatCurrency(comp.ticketPrice ?? 0, locale, "GBP")
                          )}
                        </span>
                      </div>
                      <CompetitionProgressBar competition={comp} variant="card" />
                    </div>
                  </div>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
