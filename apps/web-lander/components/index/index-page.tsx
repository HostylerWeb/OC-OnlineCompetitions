"use client";

import {
  ArrowRight,
  Award,
  CheckCircle2,
  ChevronDown,
  Gift,
  MousePointerClick,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AutoReveal } from "@/components/shared/auto-reveal";
import { formatCurrency } from "@/components/shared/format";
import { ProgressBar } from "@/components/shared/progress-bar";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import type { Competition, GlobalStats } from "@/lib/api";
import { getFrontendUrl } from "@/lib/config";
import { cn } from "@/lib/utils";

interface IndexPageProps {
  competitions: Competition[];
  stats: GlobalStats;
}

function AnimatedCounter({
  value,
  format,
  className,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (value === 0) return;
    const duration = 1500;
    const steps = 30;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);

  return <span className={className}>{format(count)}</span>;
}

function Header() {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/5 bg-[var(--color-bg-deep)]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <span className="flex items-center gap-2 text-base font-semibold text-white sm:text-lg">
          <Award className="h-5 w-5 text-[var(--color-gold)]" />
          Online Competitions
        </span>
        <a href={getFrontendUrl()} target="_blank" rel="noreferrer">
          <Button
            size="sm"
            className="rounded-full bg-[var(--color-gold)] px-4 py-2 text-sm font-semibold text-black sm:px-6"
          >
            Visit Online Competitions
          </Button>
        </a>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative flex flex-col items-center justify-center px-6 pt-36 pb-16 sm:pb-20">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[30%] h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-gold)] opacity-[0.04] blur-[120px] sm:h-[700px] sm:w-[700px]" />
      </div>

      <div className="flex w-full max-w-4xl flex-col items-center gap-6 text-center">
        <AutoReveal animation="fade-up" delay={100}>
          <h1 className="text-[clamp(2.5rem,6vw,5rem)] font-bold leading-[1.05] tracking-tight text-white">
            Win{" "}
            <span className="bg-gradient-to-r from-[var(--color-gold)] to-amber-300 bg-clip-text text-transparent">
              incredible
            </span>{" "}
            prizes
          </h1>
        </AutoReveal>

        <AutoReveal animation="fade-up" delay={200}>
          <p className="max-w-xl text-lg leading-relaxed text-white/55 sm:text-xl">
            Enter premium competitions for your chance to win life-changing prizes. Every ticket
            could change your life.
          </p>
        </AutoReveal>

        <AutoReveal animation="fade-up" delay={300}>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a href="#competitions">
              <Button
                size="lg"
                className="rounded-full bg-[var(--color-gold)] px-8 py-5 text-base font-semibold text-black shadow-[0_8px_48px_var(--color-gold-glow)] transition-all duration-300 ease-[var(--ease-premium)] hover:scale-[1.04] hover:bg-[var(--color-gold)]/90 sm:px-10 sm:py-5 sm:text-lg"
              >
                Browse competitions
              </Button>
            </a>
            <a href={getFrontendUrl()} target="_blank" rel="noreferrer">
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-white/20 px-8 py-5 text-base font-semibold text-white transition-all duration-300 ease-[var(--ease-premium)] hover:bg-white/5 sm:px-10 sm:py-5 sm:text-lg"
              >
                Visit Online Competitions <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>
        </AutoReveal>
      </div>
    </section>
  );
}

function TrustBar({ stats }: { stats: GlobalStats }) {
  const items = [
    {
      icon: <Award className="h-5 w-5 sm:h-6 sm:w-6" />,
      label: "Awarded in prizes",
      value: stats.totalPrizeValue,
      format: (n: number) => formatCurrency(n, "GBP"),
      show: stats.totalPrizeValue > 0,
    },
    {
      icon: <Users className="h-5 w-5 sm:h-6 sm:w-6" />,
      label: "Registered users",
      value: stats.totalUsers,
      format: (n: number) => n.toLocaleString(),
      show: stats.totalUsers > 0,
    },
    {
      icon: <Ticket className="h-5 w-5 sm:h-6 sm:w-6" />,
      label: "Tickets sold",
      value: stats.totalEntries,
      format: (n: number) => n.toLocaleString(),
      show: stats.totalEntries > 0,
    },
  ].filter((item) => item.show);

  return (
    <section className="px-6 py-12">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-12 gap-y-6">
        {items.map(({ icon, label, value, format: fmt }) => (
          <div key={label} className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-gold)]/10">
              <span className="text-[var(--color-gold)]">{icon}</span>
            </div>
            <div>
              <AnimatedCounter
                value={value}
                format={fmt}
                className="font-mono text-xl font-bold text-white tabular-nums sm:text-2xl"
              />
              <span className="block font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
                {label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CompetitionsGrid({ competitions }: { competitions: Competition[] }) {
  if (competitions.length === 0) return null;

  const active = competitions.filter((c) => {
    if (c.status !== "active") return false;
    const pct = c.percentageTaken ?? c.percentageSold ?? 0;
    if (pct >= 100) return false;
    return true;
  });

  return (
    <section
      id="competitions"
      className="flex flex-col items-center gap-10 px-6 py-16 sm:gap-14 sm:py-20"
    >
      <AutoReveal animation="fade-up">
        <h2 className="text-center text-3xl font-bold text-white sm:text-4xl md:text-5xl">
          Active competitions
        </h2>
      </AutoReveal>

      <AutoReveal animation="fade-up" delay={100}>
        <div className="flex w-full max-w-6xl gap-5 overflow-x-auto snap-x snap-mandatory scrollbar-none sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible sm:snap-none">
          {active.map((comp) => {
            const hasDiscount = comp.originalPrice && comp.originalPrice > comp.ticketPrice;
            const discountPct = hasDiscount
              ? Math.round((1 - comp.ticketPrice / comp.originalPrice!) * 100)
              : 0;
            const pct = comp.percentageTaken ?? comp.percentageSold ?? 0;
            const ticketsLeft = comp.availableTickets ?? 0;
            const isSoldOut = pct >= 100 || ticketsLeft === 0;
            const imgUrl = comp.prizeImageUrl ?? comp.imageUrl ?? comp.heroImageUrl;
            const isNearingDraw =
              comp.drawDate && (new Date(comp.drawDate).getTime() - Date.now()) / 86400000 < 7;

            return (
              <a
                key={comp.slug}
                href={`/${comp.slug}`}
                className="group block min-w-[75vw] snap-start sm:min-w-0"
              >
                <GlassCard
                  variant="surface"
                  glow
                  className="flex flex-col overflow-hidden p-0 transition-all duration-300 ease-[var(--ease-premium)] hover:scale-[1.02] hover:border-[var(--color-gold)]/40 sm:hover:scale-[1.02]"
                >
                  {imgUrl && (
                    <div className="relative overflow-hidden">
                      <img
                        src={imgUrl}
                        alt={comp.title}
                        loading="lazy"
                        decoding="async"
                        className="aspect-[4/3] w-full object-cover transition-transform duration-700 ease-[var(--ease-premium)] group-hover:scale-105"
                      />
                      {hasDiscount && (
                        <span className="absolute left-3 top-3 rounded-full bg-amber-500/90 px-3 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-black shadow-lg">
                          Save {discountPct}%
                        </span>
                      )}
                      {isSoldOut && (
                        <span className="absolute right-3 top-3 rounded-full bg-white/10 px-3 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-white/60 shadow-lg">
                          Sold out
                        </span>
                      )}
                      {isNearingDraw && !isSoldOut && (
                        <span className="absolute right-3 top-3 rounded-full bg-red-500/80 px-3 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-white shadow-lg">
                          Ending soon
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col gap-3 p-5 sm:p-6">
                    <h3 className="truncate text-lg font-semibold text-white">{comp.title}</h3>

                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-white/40">
                          Prize value
                        </span>
                        <span className="block font-mono text-lg font-bold text-[var(--color-gold)]">
                          {formatCurrency(comp.prizeValue, comp.currency)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-white/40">
                          Entry
                        </span>
                        <span className="block font-mono text-lg font-bold text-white">
                          {formatCurrency(comp.ticketPrice, comp.currency)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between font-mono text-[10px]">
                        <span className="text-white/40">
                          {pct >= 100 ? "100%" : `${Math.round(pct)}%`} claimed
                        </span>
                        <span className="text-white/50">{ticketsLeft.toLocaleString()} left</span>
                      </div>
                      <ProgressBar percentage={Math.min(pct, 100)} />
                    </div>

                    <div className="mt-1">
                      {isSoldOut ? (
                        <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-white/5 px-4 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">
                          Sold out
                        </span>
                      ) : (
                        <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[var(--color-gold)]/10 px-4 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-gold)] transition-all duration-300 ease-[var(--ease-premium)] group-hover:bg-[var(--color-gold)] group-hover:text-black">
                          Enter now <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                </GlassCard>
              </a>
            );
          })}
        </div>
      </AutoReveal>

      <AutoReveal animation="fade-up" delay={200}>
        <a href={getFrontendUrl()} target="_blank" rel="noreferrer">
          <Button
            variant="outline"
            className="rounded-full border-white/20 px-8 py-5 text-base font-semibold text-white transition-all duration-300 ease-[var(--ease-premium)] hover:bg-white/5"
          >
            View all on Online Competitions <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </a>
      </AutoReveal>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: <MousePointerClick className="h-6 w-6" />,
      title: "Pick a competition",
      description: "Browse our active competitions and choose the prize you want to win.",
    },
    {
      icon: <CheckCircle2 className="h-6 w-6" />,
      title: "Answer the question",
      description: "Select your answer to the skill question and complete your entry.",
    },
    {
      icon: <Gift className="h-6 w-6" />,
      title: "Win instantly",
      description: "Every ticket comes with a shot at instant prizes plus the main draw.",
    },
  ];

  return (
    <section className="flex flex-col items-center gap-10 px-6 py-16 sm:gap-14 sm:py-20">
      <AutoReveal animation="fade-up">
        <h2 className="text-center text-3xl font-bold text-white sm:text-4xl md:text-5xl">
          How it works
        </h2>
      </AutoReveal>

      <div className="grid w-full max-w-5xl gap-6 sm:grid-cols-3">
        {steps.map((step, i) => (
          <AutoReveal key={step.title} animation="fade-up" delay={i * 100} className="flex">
            <GlassCard
              variant="surface"
              glow
              className="flex flex-1 flex-col items-center gap-5 p-8 text-center sm:p-10"
            >
              <div className="relative">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-gold)]/10">
                  <span className="text-[var(--color-gold)]">{step.icon}</span>
                </div>
                <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-gold)] font-mono text-xs font-bold text-black">
                  {i + 1}
                </span>
              </div>
              <h3 className="text-xl font-semibold text-white">{step.title}</h3>
              <p className="text-sm leading-relaxed text-white/55">{step.description}</p>
            </GlassCard>
          </AutoReveal>
        ))}
      </div>
    </section>
  );
}

const FAQ_ITEMS = [
  {
    question: "How do I enter a competition?",
    answer:
      "Browse our active competitions, select the prize you want to win, answer the skill question, and complete your entry. It takes less than a minute.",
  },
  {
    question: "What happens if I win?",
    answer:
      "Winners are notified via email shortly after the draw. Instant prizes are credited immediately. For main draws, we'll arrange delivery of your prize.",
  },
  {
    question: "Can I enter multiple times?",
    answer:
      "Yes, each competition has a maximum entry limit per person displayed on the competition page. You can purchase multiple tickets up to that limit.",
  },
  {
    question: "Are there instant prizes?",
    answer:
      "Yes! Every ticket comes with a chance to win instant prizes alongside the main draw. Instant prizes include free entries, gift cards, and more.",
  },
  {
    question: "How are winners verified?",
    answer:
      "All draws are conducted transparently and verified independently. Winners may be required to verify their identity before claiming prizes.",
  },
];

function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="flex flex-col items-center gap-10 px-6 py-16 sm:gap-14 sm:py-20">
      <AutoReveal animation="fade-up">
        <h2 className="text-center text-3xl font-bold text-white sm:text-4xl md:text-5xl">
          Frequently asked
        </h2>
      </AutoReveal>

      <div className="flex w-full max-w-3xl flex-col gap-3">
        {FAQ_ITEMS.map((item, i) => {
          const isOpen = openIndex === i;

          return (
            <AutoReveal key={item.question} animation="fade-up" delay={i * 100}>
              <button
                type="button"
                className={cn(
                  "w-full cursor-pointer rounded-2xl border border-white/10 bg-[var(--glass-bg)] backdrop-blur-24 text-left transition-all duration-300 ease-[var(--ease-luxury)] hover:border-white/20",
                  isOpen && "border-[var(--color-gold)]/30"
                )}
                onClick={() => setOpenIndex(isOpen ? null : i)}
                aria-expanded={isOpen}
              >
                <div className="flex items-center justify-between p-5 sm:p-6">
                  <h3 className="pr-4 text-base font-semibold text-white sm:text-lg">
                    {item.question}
                  </h3>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 text-white/40 transition-transform duration-300 ease-[var(--ease-premium)]",
                      isOpen && "rotate-180 text-[var(--color-gold)]"
                    )}
                  />
                </div>
                {isOpen && (
                  <div className="border-t border-white/5 px-5 pb-5 sm:px-6 sm:pb-6">
                    <p className="text-sm leading-relaxed text-white/55">{item.answer}</p>
                  </div>
                )}
              </button>
            </AutoReveal>
          );
        })}
      </div>
    </section>
  );
}

function FooterCta() {
  return (
    <section className="flex flex-col items-center gap-8 px-6 py-24 sm:py-32">
      <AutoReveal animation="fade">
        <div className="h-px w-24 bg-gradient-to-r from-transparent via-[var(--color-gold)] to-transparent" />
      </AutoReveal>

      <AutoReveal animation="scale" delay={50}>
        <h2 className="text-center text-4xl font-bold leading-[1.05] text-white sm:text-6xl md:text-7xl">
          Ready to win?
        </h2>
      </AutoReveal>

      <AutoReveal animation="fade-up" delay={100}>
        <p className="max-w-md text-center text-base leading-relaxed text-white/50">
          Browse our competitions and take your shot at life-changing prizes.
        </p>
      </AutoReveal>

      <AutoReveal animation="fade-up" delay={150}>
        <a href={getFrontendUrl()} target="_blank" rel="noreferrer">
          <Button
            size="lg"
            className="rounded-full bg-[var(--color-gold)] px-12 py-6 text-lg font-semibold tracking-wide text-black shadow-[0_12px_64px_var(--color-gold-glow)] transition-all duration-300 ease-[var(--ease-premium)] hover:scale-[1.05] hover:bg-[var(--color-gold)]/90 sm:px-16 sm:py-7"
          >
            Visit Online Competitions <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </a>
      </AutoReveal>

      <AutoReveal animation="fade-up" delay={200}>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
          <div className="flex items-center gap-2 text-white/30">
            <ShieldCheck className="h-4 w-4" />
            <span className="font-mono text-[9px] uppercase tracking-[0.15em]">SSL Secure</span>
          </div>
          <div className="flex items-center gap-2 text-white/30">
            <Award className="h-4 w-4" />
            <span className="font-mono text-[9px] uppercase tracking-[0.15em]">
              GamCare Certified
            </span>
          </div>
          <div className="flex items-center gap-2 text-white/30">
            <ShieldCheck className="h-4 w-4" />
            <span className="font-mono text-[9px] uppercase tracking-[0.15em]">
              Fair Draw Guarantee
            </span>
          </div>
        </div>
      </AutoReveal>

      <AutoReveal animation="fade" delay={250}>
        <div className="mt-12 h-px w-24 bg-gradient-to-r from-transparent via-[var(--color-gold)] to-transparent" />
      </AutoReveal>
    </section>
  );
}

export function IndexPage({ competitions, stats }: IndexPageProps) {
  return (
    <div className="min-h-screen bg-[var(--color-bg-deep)]">
      <Header />
      <HeroSection />
      <TrustBar stats={stats} />
      <CompetitionsGrid competitions={competitions} />
      <HowItWorks />
      <FaqSection />
      <FooterCta />
    </div>
  );
}
