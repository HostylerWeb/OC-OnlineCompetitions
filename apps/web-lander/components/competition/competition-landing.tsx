"use client";

import { ArrowRight, Award, CheckCircle2, Clock, Trophy, Users } from "lucide-react";
import React from "react";
import {
  Counter,
  FrameScroll,
  Kino,
  Progress,
  Reveal,
  Scene,
  StickyHeader,
} from "@/components/kino";
import { CountdownTimer } from "@/components/shared/countdown-timer";
import { formatCurrency, formatDate, formatWinnerName } from "@/components/shared/format";
import { ProgressBar } from "@/components/shared/progress-bar";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { useCompetitionStream } from "@/hooks/use-competition-stream";
import type {
  Competition,
  CompetitionInstantPrize,
  CompetitionWinner,
  LandingPageAvailability,
  LandingPageOtherCompetition,
  LandingPageWinnerStats,
} from "@/lib/api";
import { getCompetitionEntryUrl } from "@/lib/config";

/* ── Types ───────────────────────────────────────────────── */

interface CompetitionLandingProps {
  competition: Competition;
  availability: LandingPageAvailability;
  winners: CompetitionWinner[];
  instantPrizes?: CompetitionInstantPrize[];
  winnerStats?: LandingPageWinnerStats;
  otherCompetitions?: LandingPageOtherCompetition[];
}

/* ── AutoReveal (mount-triggered, not scroll) ────────────── */

const AR_MAP = {
  fade: "ar-fade",
  "fade-up": "ar-fade-up",
  scale: "ar-scale",
} as const;

function AutoReveal({
  animation = "fade",
  delay = 0,
  children,
  className,
}: {
  animation?: "fade" | "fade-up" | "scale";
  delay?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        animation: `${AR_MAP[animation]} 600ms cubic-bezier(0.32, 0.72, 0, 1) ${delay}ms both`,
      }}
    >
      {children}
    </div>
  );
}

/* ── FAQ Parser ───────────────────────────────────────────── */

interface QAPair {
  question: string;
  answer: string;
}

function parseFAQ(raw?: string): QAPair[] {
  if (!raw) return [];
  const pairs: QAPair[] = [];
  const blocks = raw.split(/\n\n+/);
  let currentQ = "";
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const qMatch = trimmed.match(/^(?:Q|Question|Q:|Question:)\s*[:.]?\s*(.+)/i);
    const aMatch = trimmed.match(/^(?:A|Answer|A:|Answer:)\s*[:.]?\s*(.+)/i);
    if (qMatch) {
      if (currentQ && pairs.length === 0) {
        pairs.push({ question: currentQ, answer: trimmed });
        currentQ = "";
      } else if (currentQ) {
        currentQ = qMatch[1].trim();
      } else {
        currentQ = qMatch[1].trim();
      }
    } else if (aMatch && currentQ) {
      pairs.push({ question: currentQ, answer: aMatch[1].trim() });
      currentQ = "";
    } else if (currentQ) {
      pairs.push({ question: currentQ, answer: trimmed });
      currentQ = "";
    }
  }
  if (currentQ) pairs.push({ question: currentQ, answer: "" });
  return pairs;
}

/* ── Hero Overlay ─────────────────────────────────────────── */

function HeroOverlay({ competition }: { competition: Competition }) {
  const drawDate = competition.drawDate ?? competition.endDate;
  const hasDiscount =
    competition.originalPrice && competition.originalPrice > competition.ticketPrice;
  const discountPct = hasDiscount
    ? Math.round((1 - competition.ticketPrice / competition.originalPrice!) * 100)
    : 0;
  const isNearingDraw = drawDate && (new Date(drawDate).getTime() - Date.now()) / 86400000 < 7;
  const isNotStarted =
    competition.startDate && new Date(competition.startDate).getTime() > Date.now();

  return (
    <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 pt-16">
      <div className="flex w-full max-w-5xl flex-col items-center gap-8">
        <AutoReveal animation="fade" delay={100}>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2.5 rounded-full border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/10 px-5 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.25em] text-[var(--color-gold)] backdrop-blur-md">
              <Trophy className="h-3.5 w-3.5" />
              {competition.category ?? "Competition"}
            </span>
            {hasDiscount && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-400 animate-pulse">
                Save {discountPct}%
              </span>
            )}
          </div>
        </AutoReveal>

        <AutoReveal animation="fade-up" delay={200}>
          <h1 className="text-center text-[clamp(2.75rem,8vw,6rem)] font-bold leading-[1.05] tracking-tight text-white drop-shadow-[0_4px_48px_rgba(0,0,0,0.9)]">
            {competition.title}
          </h1>
        </AutoReveal>

        {competition.shortDescription && (
          <AutoReveal animation="fade-up" delay={300}>
            <p className="max-w-3xl text-center text-[clamp(1rem,2vw,1.25rem)] leading-[1.75] text-white/55">
              {competition.shortDescription}
            </p>
          </AutoReveal>
        )}

        <AutoReveal animation="scale" delay={400}>
          <span className="block font-mono text-5xl font-bold text-[var(--color-gold)] sm:text-6xl md:text-7xl tabular-nums">
            {formatCurrency(competition.prizeValue, competition.currency)}
          </span>
        </AutoReveal>

        <AutoReveal animation="fade" delay={450}>
          <p className="text-center text-white/50">
            Tickets from{" "}
            {hasDiscount ? (
              <>
                <span className="line-through">
                  {formatCurrency(competition.originalPrice!, competition.currency)}
                </span>{" "}
              </>
            ) : null}
            {formatCurrency(competition.ticketPrice, competition.currency)}
            {drawDate ? <>  -  Draw: {formatDate(drawDate)}</> : null}
          </p>
        </AutoReveal>

        {(isNearingDraw || isNotStarted) && (
          <AutoReveal animation="scale" delay={500}>
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-gold)]/20 bg-[var(--color-gold)]/5 px-6 py-4 backdrop-blur-md">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-gold)]">
                {isNotStarted ? "Starts in" : "Draw in"}
              </span>
              <CountdownTimer targetDate={isNotStarted ? competition.startDate! : drawDate!} />
            </div>
          </AutoReveal>
        )}

        <AutoReveal animation="fade-up" delay={600}>
          <a href={getCompetitionEntryUrl(competition.slug)} target="_blank" rel="noreferrer">
            <Button
              size="lg"
              className="rounded-full bg-[var(--color-gold)] px-10 py-5 text-base font-semibold tracking-wide text-black shadow-[0_8px_48px_var(--color-gold-glow)] transition-all duration-300 ease-[var(--ease-premium)] hover:scale-[1.04] hover:bg-[var(--color-gold)]/90 hover:shadow-[0_16px_64px_var(--color-gold-glow-strong)] sm:px-12 sm:py-6 sm:text-lg"
              style={{ animation: "pulseGold 3s ease-in-out infinite" }}
            >
              Enter now  -  {formatCurrency(competition.ticketPrice, competition.currency)}
            </Button>
          </a>
        </AutoReveal>

        <AutoReveal animation="fade" delay={800}>
          <div className="mt-12 flex flex-col items-center gap-3 text-white/25">
            <span className="font-mono text-[10px] uppercase tracking-[0.25em]">
              Scroll to explore
            </span>
            <div className="h-14 w-px animate-pulse bg-gradient-to-b from-white/40 to-transparent" />
          </div>
        </AutoReveal>
      </div>
    </section>
  );
}

/* ── Section: Ticket availability ───────────────────────── */

function AvailabilityScene({
  competition,
  availability,
}: {
  competition: Competition;
  availability: LandingPageAvailability;
}) {
  const pct = availability.percentageTaken ?? availability.percentageSold ?? 0;
  const ticketsLeft = availability.available ?? 0;
  const isFullyClaimed = ticketsLeft === 0 && pct >= 100;

  const stats = [
    {
      icon: <Users className="h-5 w-5 sm:h-6 sm:w-6" />,
      label: "Tickets sold",
      value: availability.sold,
      format: (n: number) => n.toLocaleString(),
    },
    {
      icon: <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6" />,
      label: "Remaining",
      value: ticketsLeft,
      format: (n: number) => n.toLocaleString(),
    },
    {
      icon: <Award className="h-5 w-5 sm:h-6 sm:w-6" />,
      label: "Max per user",
      value: availability.maxPerUser,
      format: (n: number) => String(n),
    },
    {
      icon: <Clock className="h-5 w-5 sm:h-6 sm:w-6" />,
      label: "Free tickets given",
      value: availability.instantPrizeGrantedTickets,
      format: (n: number) => n.toLocaleString(),
    },
  ];

  return (
    <Scene duration="400vh">
      {(progress) => (
        <section className="flex min-h-screen flex-col items-center justify-center gap-14 px-6 py-28 sm:gap-16 sm:py-32">
          <Reveal animation="fade-up" at={0} progress={progress}>
            <div className="flex flex-col items-center gap-4 text-center">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-gold)]">
                Limited availability
              </span>
              <h2 className="text-4xl font-bold text-white sm:text-5xl md:text-6xl">
                Don&apos;t miss your chance
              </h2>
              <p className="max-w-lg text-base leading-[1.75] text-white/50">
                Secure your entry before the draw. Limited tickets remain.
              </p>
            </div>
          </Reveal>

          <Reveal animation="scale" at={0.08} progress={progress}>
            <div className="grid w-full max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-5">
              {stats.map(({ icon, label, value, format }) => (
                <GlassCard
                  key={label}
                  variant="surface"
                  glow
                  className="flex flex-col items-center gap-4 p-5 sm:p-7"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-gold)]/10">
                    <span className="text-[var(--color-gold)]">{icon}</span>
                  </div>
                  <Counter
                    from={0}
                    to={value}
                    at={0.12}
                    span={0.35}
                    format={format}
                    progress={progress}
                    className="font-mono text-2xl font-bold text-white sm:text-3xl tabular-nums"
                  />
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
                    {label}
                  </span>
                </GlassCard>
              ))}
            </div>
          </Reveal>

          <Reveal animation="fade-up" at={0.2} progress={progress}>
            <div className="w-full max-w-5xl space-y-4">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-white/40">
                  {isFullyClaimed ? "100% claimed" : `${Math.round(pct)}% claimed`}
                </span>
                {isFullyClaimed ? (
                  <span className="text-amber-400">Fully claimed  -  held tickets may expire</span>
                ) : (
                  <span className="text-[var(--color-gold)]">
                    {ticketsLeft.toLocaleString()} remaining
                  </span>
                )}
              </div>
              <ProgressBar percentage={pct} />
            </div>
          </Reveal>

          {competition.startDate && new Date(competition.startDate).getTime() > Date.now() && (
            <Reveal animation="fade-up" at={0.25} progress={progress}>
              <div className="flex flex-col items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/40">
                  <Clock className="mr-1.5 inline h-3 w-3" />
                  Opens in
                </span>
                <CountdownTimer targetDate={competition.startDate} />
              </div>
            </Reveal>
          )}

          <Reveal animation="fade-up" at={0.28} progress={progress}>
            <a href={getCompetitionEntryUrl(competition.slug)} target="_blank" rel="noreferrer">
              <Button
                size="lg"
                className="rounded-full bg-[var(--color-gold)] px-10 py-5 text-base font-semibold tracking-wide text-black shadow-[0_8px_40px_var(--color-gold-glow)] transition-all duration-300 ease-[var(--ease-premium)] hover:scale-[1.04] hover:bg-[var(--color-gold)]/90 sm:px-12 sm:py-6 sm:text-lg"
                style={{ animation: "pulseGold 3s ease-in-out infinite" }}
              >
                {isFullyClaimed ? "Get notified if tickets re-open" : "Secure your tickets"}
              </Button>
            </a>
          </Reveal>
        </section>
      )}
    </Scene>
  );
}

/* ── Section: Description ───────────────────────────────── */

function DescriptionScene({ competition }: { competition: Competition }) {
  const body = competition.longDescription ?? competition.description;
  if (!body) return null;

  const prizeImages = competition.prizeImages ?? [];
  const allImages: string[] = [];
  if (competition.prizeImageUrl) allImages.push(competition.prizeImageUrl);
  allImages.push(...prizeImages.filter(Boolean));

  return (
    <Scene duration="500vh">
      {(progress) => (
        <section className="flex min-h-screen flex-col items-center justify-center gap-16 px-6 py-28 sm:gap-20 sm:py-32">
          {allImages.length > 0 && (
            <Reveal animation="fade" at={0} progress={progress}>
              <div className="grid w-full max-w-6xl gap-4 sm:grid-cols-2">
                {allImages.slice(0, 4).map((img) => (
                  <div key={img} className="relative">
                    <div className="overflow-hidden rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.7)] sm:rounded-3xl">
                      <img
                        src={img}
                        alt="Prize"
                        loading="lazy"
                        decoding="async"
                        className="w-full object-cover transition-transform duration-700 ease-[var(--ease-premium)] hover:scale-105"
                        style={{ aspectRatio: img === allImages[0] ? "4/5" : "1" }}
                      />
                    </div>
                    <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/10 sm:rounded-3xl" />
                  </div>
                ))}
              </div>
            </Reveal>
          )}

          <Reveal animation="fade-up" at={0.06} progress={progress} className="w-full max-w-4xl">
            <div className="flex flex-col gap-6">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-gold)]">
                About the prize
              </span>
              <h2 className="text-3xl font-bold text-white leading-[1.1] sm:text-4xl md:text-5xl">
                {competition.title}
              </h2>
              <p className="text-base leading-[1.8] text-white/55 sm:text-lg">{body}</p>

              {competition.question && (
                <div className="card-bezel mt-6 w-full">
                  <div className="card-bezel-inner p-5 sm:p-6">
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-gold)]">
                      Skill question
                    </p>
                    <p className="text-sm leading-relaxed text-white/80 sm:text-base">
                      {competition.question}
                    </p>
                    {competition.questionOptions && competition.questionOptions.length > 0 && (
                      <ul className="mt-4 flex flex-col gap-2.5">
                        {competition.questionOptions.map((opt) => (
                          <li key={opt} className="flex items-center gap-3 text-sm text-white/50">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--color-gold)]" />
                            {opt}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Reveal>
        </section>
      )}
    </Scene>
  );
}

/* ── Section: FAQ ────────────────────────────────────────── */

function FaqScene({ competition }: { competition: Competition }) {
  const faq = parseFAQ(competition.faq);
  if (faq.length === 0) return null;

  return (
    <Scene duration={`${faq.length * 60 + 200}vh`}>
      {(progress) => (
        <section className="flex min-h-screen flex-col items-center justify-center gap-14 px-6 py-28 sm:gap-16 sm:py-32">
          <Reveal animation="fade-up" at={0} progress={progress}>
            <div className="flex flex-col items-center gap-4 text-center">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-gold)]">
                Got questions?
              </span>
              <h2 className="text-4xl font-bold text-white sm:text-5xl md:text-6xl">
                Frequently asked
              </h2>
            </div>
          </Reveal>

          <div className="flex w-full max-w-3xl flex-col gap-4">
            {faq.map((pair) => {
              const revealAt = 0.08 + faq.indexOf(pair) * 0.04;
              return (
                <Reveal
                  key={pair.question}
                  animation="fade-up"
                  at={Math.min(revealAt, 0.6)}
                  progress={progress}
                >
                  <div className="card-bezel-sm w-full">
                    <div className="card-bezel-inner-sm p-5 sm:p-6">
                      <h3 className="text-lg font-semibold text-white sm:text-xl">
                        {pair.question}
                      </h3>
                      {pair.answer && (
                        <p className="mt-3 text-sm leading-relaxed text-white/55 sm:text-base">
                          {pair.answer}
                        </p>
                      )}
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>
      )}
    </Scene>
  );
}

/* ── Section: Instant Prizes ─────────────────────────────── */

function InstantPrizesSection({ instantPrizes }: { instantPrizes: CompetitionInstantPrize[] }) {
  if (instantPrizes.length === 0) return null;

  const active = instantPrizes.filter((p) => !p.isArchived);
  if (active.length === 0) return null;

  const activePrizes = active.slice(0, 6);

  return (
    <Scene duration={`${Math.min(activePrizes.length, 4) * 80 + 200}vh`}>
      {(progress) => (
        <section className="flex min-h-screen flex-col items-center justify-center gap-14 px-6 py-28 sm:gap-16 sm:py-32">
          <Reveal animation="fade-up" at={0} progress={progress}>
            <div className="flex flex-col items-center gap-4 text-center">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-gold)]">
                Instant wins
              </span>
              <h2 className="text-4xl font-bold text-white sm:text-5xl md:text-6xl">
                Every ticket wins something
              </h2>
              <p className="max-w-lg text-base leading-[1.75] text-white/50">
                Every entry comes with a chance to win instant prizes alongside the main draw.
              </p>
            </div>
          </Reveal>

          <div className="grid w-full max-w-5xl gap-5 sm:grid-cols-2">
            {activePrizes.map((prize, i) => {
              const p = prize.instantPrize;
              const isTicket = p.type === "competition_ticket";
              const linked = p.linkedCompetition;
              const revealAt = 0.06 + i * 0.04;

              return (
                <Reveal
                  key={prize.id}
                  animation="fade-up"
                  at={Math.min(revealAt, 0.5)}
                  progress={progress}
                >
                  <GlassCard
                    variant="surface"
                    glow
                    className="flex flex-col gap-4 overflow-hidden p-0"
                  >
                    {p.images[0] && (
                      <div className="overflow-hidden">
                        <img
                          src={p.images[0]}
                          alt={p.title}
                          loading="lazy"
                          decoding="async"
                          className="aspect-[16/9] w-full object-cover transition-transform duration-700 ease-[var(--ease-premium)] hover:scale-105"
                        />
                      </div>
                    )}

                    <div className="flex flex-col gap-3 p-5 sm:p-6">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-[var(--color-gold)]/10 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--color-gold)]">
                          {isTicket ? "Free entry" : "Instant prize"}
                        </span>
                        {prize.quantity > 1 && (
                          <span className="font-mono text-[9px] text-white/30">
                            {prize.claimedCount}/{prize.quantity} claimed
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-semibold text-white sm:text-xl">{p.title}</h3>
                      {p.description && (
                        <p className="text-sm leading-relaxed text-white/55">{p.description}</p>
                      )}
                      {p.value && (
                        <span className="font-mono text-sm text-[var(--color-gold)]">
                          {formatCurrency(p.value, "GBP")}
                        </span>
                      )}

                      {isTicket && linked?.slug && (
                        <a
                          href={`/${linked.slug}`}
                          className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-gold)] px-5 py-2.5 text-sm font-semibold text-black transition-all duration-300 ease-[var(--ease-premium)] hover:bg-[var(--color-gold)]/90 hover:scale-[1.02]"
                        >
                          Enter {linked.title} <ArrowRight className="h-4 w-4" />
                        </a>
                      )}

                      {prize.winnerEntries.length > 0 && (
                        <div className="mt-1 border-t border-white/5 pt-3">
                          <span className="block font-mono text-[9px] uppercase tracking-[0.15em] text-white/30">
                            Recent winners
                          </span>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {prize.winnerEntries.slice(0, 5).map((entry) => (
                              <span
                                key={entry.ticketNumber}
                                className="rounded-full bg-white/5 px-2.5 py-1 font-mono text-[10px] text-white/50"
                              >
                                #{entry.ticketNumber} {entry.userFullName.split(" ")[0]}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </GlassCard>
                </Reveal>
              );
            })}
          </div>
        </section>
      )}
    </Scene>
  );
}

/* ── Section: Winners ───────────────────────────────────── */

function WinnersScene({
  winners,
  winnerStats,
  slug,
}: {
  winners: CompetitionWinner[];
  winnerStats?: LandingPageWinnerStats;
  slug: string;
}) {
  if (winners.length === 0) return null;

  const sorted = [...winners].sort(
    (a, b) => new Date(b.drawnAt).getTime() - new Date(a.drawnAt).getTime()
  );

  return (
    <Scene duration={`${Math.min(sorted.length, 6) * 60 + 200}vh`}>
      {(progress) => (
        <section className="flex min-h-screen flex-col items-center justify-center gap-14 px-6 py-28 sm:gap-18 sm:py-32">
          <Reveal animation="fade-up" at={0} progress={progress}>
            <div className="flex flex-col items-center gap-4 text-center">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-gold)]">
                Hall of fame
              </span>
              <h2 className="text-4xl font-bold text-white sm:text-5xl md:text-6xl">
                Previous winners
              </h2>
              <p className="max-w-lg text-base text-white/50">
                Real people, real prizes. See who&apos;s already changed their life.
              </p>
            </div>
          </Reveal>

          {winnerStats && winnerStats.totalWinners > 0 && (
            <Reveal animation="scale" at={0.06} progress={progress}>
              <div className="flex items-center gap-8 rounded-2xl border border-[var(--color-gold)]/20 bg-[var(--color-gold)]/5 px-8 py-4 backdrop-blur-md">
                <div className="flex flex-col items-center">
                  <span className="font-mono text-2xl font-bold text-white tabular-nums">
                    {winnerStats.totalWinners.toLocaleString()}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
                    Winners
                  </span>
                </div>
                <div className="h-8 w-px bg-white/10" />
                <div className="flex flex-col items-center">
                  <span className="font-mono text-2xl font-bold text-[var(--color-gold)] tabular-nums">
                    {formatCurrency(winnerStats.totalPrizeValue, "GBP")}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
                    Awarded
                  </span>
                </div>
              </div>
            </Reveal>
          )}

          <Reveal animation="fade-up" at={0.1} progress={progress}>
            <div className="grid w-full max-w-6xl gap-4 sm:grid-cols-3 sm:gap-5">
              {sorted[0] && (
                <div className="relative sm:row-span-2">
                  <GlassCard variant="surface" glow className="h-full overflow-hidden p-0">
                    {sorted[0].winnerPhotoUrl && (
                      <div className="overflow-hidden">
                        <img
                          src={sorted[0].winnerPhotoUrl}
                          alt={sorted[0].displayName ?? "Winner"}
                          loading="lazy"
                          decoding="async"
                          className="aspect-[3/4] w-full object-cover transition-transform duration-700 ease-[var(--ease-premium)] hover:scale-105"
                        />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--color-void)] to-transparent p-5">
                      <span className="block text-xl font-semibold text-white">
                        {formatWinnerName(sorted[0].displayName, sorted[0].showFullName)}
                      </span>
                      <span className="block font-mono text-[10px] uppercase tracking-wider text-[var(--color-gold)]">
                        {sorted[0].prizeTitle}
                      </span>
                      {sorted[0].prizeValue && (
                        <span className="mt-1 block font-mono text-xs text-white/50">
                          {formatCurrency(sorted[0].prizeValue, "GBP")}
                        </span>
                      )}
                      <span className="mt-0.5 block font-mono text-[9px] text-white/30">
                        Ticket #{sorted[0].ticketNumber} &middot; {formatDate(sorted[0].drawnAt)}
                      </span>
                    </div>
                  </GlassCard>
                </div>
              )}

              {sorted.slice(1, 5).map((winner) => (
                <GlassCard key={winner._id} variant="surface" className="overflow-hidden p-0">
                  {winner.winnerPhotoUrl && (
                    <img
                      src={winner.winnerPhotoUrl}
                      alt={winner.displayName ?? "Winner"}
                      loading="lazy"
                      decoding="async"
                      className="aspect-square w-full object-cover transition-transform duration-700 ease-[var(--ease-premium)] hover:scale-105"
                    />
                  )}
                  <div className="p-4">
                    <span className="block text-base font-semibold text-white">
                      {formatWinnerName(winner.displayName, winner.showFullName)}
                    </span>
                    {winner.location && (
                      <span className="mt-0.5 block text-xs text-white/35">{winner.location}</span>
                    )}
                    {winner.prizeTitle && (
                      <span className="mt-1 block font-mono text-[10px] uppercase tracking-wider text-[var(--color-gold)]">
                        {winner.prizeTitle}
                      </span>
                    )}
                    {winner.prizeValue && (
                      <span className="mt-1 block font-mono text-xs text-white/40">
                        {formatCurrency(winner.prizeValue, "GBP")}
                      </span>
                    )}
                    {winner.testimonial && (
                      <p className="mt-2 text-xs italic text-white/40 line-clamp-2">
                        &ldquo;{winner.testimonial}&rdquo;
                      </p>
                    )}
                    <span className="mt-1.5 block font-mono text-[9px] text-white/25">
                      Ticket #{winner.ticketNumber} &middot; {formatDate(winner.drawnAt)}
                    </span>
                  </div>
                </GlassCard>
              ))}
            </div>
          </Reveal>

          <Reveal animation="fade-up" at={0.25} progress={progress}>
            <a href={getCompetitionEntryUrl(slug)} target="_blank" rel="noreferrer">
              <Button
                size="lg"
                className="rounded-full bg-[var(--color-gold)] px-10 py-5 text-base font-semibold tracking-wide text-black shadow-[0_8px_40px_var(--color-gold-glow)] transition-all duration-300 ease-[var(--ease-premium)] hover:scale-[1.04] hover:bg-[var(--color-gold)]/90 sm:px-12 sm:py-6 sm:text-lg"
                style={{ animation: "pulseGold 3s ease-in-out infinite" }}
              >
                Enter now <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </a>
          </Reveal>
        </section>
      )}
    </Scene>
  );
}

/* ── Section: Other Competitions ─────────────────────────── */

function OtherCompetitionsSection({
  otherCompetitions,
}: {
  otherCompetitions?: LandingPageOtherCompetition[];
}) {
  if (!otherCompetitions || otherCompetitions.length === 0) return null;

  return (
    <section className="flex min-h-screen flex-col items-center justify-center gap-14 px-10 py-24 sm:gap-20 sm:py-32">
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-gold)]">
          More prizes
        </span>
        <h2 className="text-3xl font-bold text-white sm:text-4xl md:text-5xl">
          Other competitions
        </h2>
      </div>

      <div className="mt-6 flex w-full gap-8 overflow-x-auto px-4 snap-x snap-mandatory scrollbar-none">
        {otherCompetitions.map((comp) => {
          const imgUrl = comp.imageUrl;
          return (
            <a
              key={comp.slug}
              href={`/${comp.slug}`}
              className="group block w-[320px] shrink-0 snap-start"
            >
              <GlassCard
                variant="surface"
                glow
                className="flex h-full flex-col p-0 transition-all duration-300 ease-[var(--ease-premium)] hover:scale-[1.02] hover:border-[var(--color-gold)]/40"
              >
                {imgUrl ? (
                  <div className="overflow-hidden">
                    <img
                      src={imgUrl}
                      alt={comp.title}
                      loading="lazy"
                      decoding="async"
                      className="aspect-[4/3] w-full object-cover transition-transform duration-700 ease-[var(--ease-premium)] group-hover:scale-105"
                    />
                  </div>
                ) : (
                  <div className="aspect-[4/3] w-full bg-gradient-to-br from-[var(--color-gold)]/10 to-[var(--color-surface)]" />
                )}

                <div className="flex flex-1 flex-col gap-5 p-8">
                  <h3 className="truncate text-base font-semibold text-white">{comp.title}</h3>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-white/40">
                        Prize value
                      </span>
                      <span className="block font-mono text-base font-bold text-[var(--color-gold)]">
                        {formatCurrency(comp.prizeValue, "GBP")}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-white/40">
                        Entry
                      </span>
                      <span className="block font-mono text-base font-bold text-white">
                        {formatCurrency(comp.ticketPrice, "GBP")}
                      </span>
                    </div>
                  </div>

                  <span className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-gold)]/10 px-6 py-4 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-gold)] transition-all duration-300 ease-[var(--ease-premium)] group-hover:bg-[var(--color-gold)] group-hover:text-black">
                    Enter now <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </GlassCard>
            </a>
          );
        })}
      </div>
    </section>
  );
}

/* ── Section: Footer CTA ────────────────────────────────── */

function FooterCta({ competition }: { competition: Competition }) {
  return (
    <Scene duration="200vh">
      {(progress) => (
        <section className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-6 py-24">
          <Reveal animation="fade" at={0} progress={progress}>
            <div className="h-px w-24 bg-gradient-to-r from-transparent via-[var(--color-gold)] to-transparent" />
          </Reveal>

          <Reveal animation="scale" at={0.1} progress={progress}>
            <h2 className="text-center text-4xl font-bold text-white sm:text-5xl md:text-6xl leading-[1.05]">
              {competition.title}
            </h2>
          </Reveal>

          <Reveal animation="fade-up" at={0.2} progress={progress}>
            <p className="text-center text-white/50">
              Entry from {formatCurrency(competition.ticketPrice, competition.currency)}
              {competition.drawDate ? <>  -  Draw: {formatDate(competition.drawDate)}</> : null}
            </p>
          </Reveal>

          <Reveal animation="fade-up" at={0.3} progress={progress}>
            <a href={getCompetitionEntryUrl(competition.slug)} target="_blank" rel="noreferrer">
              <Button
                size="lg"
                className="rounded-full bg-[var(--color-gold)] px-12 py-6 text-lg font-semibold tracking-wide text-black shadow-[0_12px_64px_var(--color-gold-glow)] transition-all duration-300 ease-[var(--ease-premium)] hover:scale-[1.05] hover:bg-[var(--color-gold)]/90 sm:px-16 sm:py-7"
                style={{ animation: "pulseGold 3s ease-in-out infinite" }}
              >
                Enter now  -  {formatCurrency(competition.ticketPrice, competition.currency)}
              </Button>
            </a>
          </Reveal>
        </section>
      )}
    </Scene>
  );
}

/* ── Root component ──────────────────────────────────────── */

export function CompetitionLanding({
  competition,
  availability,
  winners,
  instantPrizes,
  winnerStats,
  otherCompetitions,
}: CompetitionLandingProps) {
  const { liveAvailable } = useCompetitionStream(competition._id ?? competition.id);
  const displayAvailability = {
    ...availability,
    ...(liveAvailable !== null ? { available: liveAvailable } : {}),
  };
  const entryUrl = getCompetitionEntryUrl(competition.slug);
  const posterImage = competition.heroImageUrl ?? competition.prizeImageUrl ?? competition.imageUrl;

  const fp = competition.landingPageVideoFramesPrefix;
  const fc = competition.landingPageVideoFrameCount;
  const hasFrames = fp && typeof fp === "string" && fc != null && fc > 0;

  return (
    <Kino>
      <Progress className="fixed left-0 right-0 top-0 z-50 h-1 bg-white/5">
        <Progress.Bar className="bg-gradient-to-r from-[var(--color-gold)] to-amber-400" />
      </Progress>

      <StickyHeader
        className="fixed left-0 right-0 top-0 z-40 border-b border-white/5 backdrop-blur-md transition-all"
        showAt={0.1}
        background="rgba(0,0,0,0.3)"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <span className="text-base font-semibold text-white sm:text-lg">{competition.title}</span>
          <a href={entryUrl} target="_blank" rel="noreferrer">
            <Button
              size="sm"
              className="rounded-full bg-[var(--color-gold)] px-4 py-2 text-sm font-semibold text-black shadow-[0_4px_24px_var(--color-gold-glow)] transition-all duration-300 ease-[var(--ease-premium)] hover:bg-[var(--color-gold)]/90 sm:px-6"
            >
              Enter now
            </Button>
          </a>
        </div>
      </StickyHeader>

      {hasFrames && (
        <FrameScroll
          framePrefix={fp!}
          totalFrames={fc!}
          fps={competition.landingPageVideoFps}
          poster={posterImage}
        />
      )}

      <HeroOverlay competition={competition} />
      <AvailabilityScene competition={competition} availability={displayAvailability} />
      <DescriptionScene competition={competition} />
      {(instantPrizes ?? []).length > 0 && <InstantPrizesSection instantPrizes={instantPrizes!} />}
      <FaqScene competition={competition} />
      <WinnersScene winners={winners} winnerStats={winnerStats} slug={competition.slug} />
      {otherCompetitions && otherCompetitions.length > 0 && (
        <OtherCompetitionsSection otherCompetitions={otherCompetitions} />
      )}
      <FooterCta competition={competition} />
    </Kino>
  );
}
