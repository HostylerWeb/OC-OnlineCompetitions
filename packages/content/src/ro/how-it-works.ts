import type { ContentFeature, HowItWorksAltPath, HowItWorksStep } from "../content-types";

export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    stepNumber: 1,
    title: "Vezi Concursurile",
    description:
      "Explorează concursurile noastre de lux și găsește un premiu care te entuziasmează.",
    icon: "Search",
  },
  {
    stepNumber: 2,
    title: "Selectează Biletele",
    description: "Alege câte bilete dorești - mai multe bilete îți măresc șansele.",
    icon: "Ticket",
  },
  {
    stepNumber: 3,
    title: "Întrebare de abilități (dacă e cazul)",
    description:
      "Unele concursuri cer o întrebare cu variante multiple. Răspunde corect pentru a finaliza intrarea.",
    icon: "Gamepad2",
  },
  {
    stepNumber: 4,
    title: "Finalizează Achiziția",
    description: "Finalizare rapidă și securizată cu card, Apple Pay sau Google Pay.",
    icon: "CreditCard",
  },
  {
    stepNumber: 5,
    title: "Așteaptă Extragerea",
    description:
      "Relaxează-te și urmărește numărătoarea inversă. Câștigătorii sunt selectați aleatoriu.",
    icon: "Clock",
  },
  {
    stepNumber: 6,
    title: "Câștigă și Sărbătorește",
    description:
      "Câștigătorii sunt notificați prin email, iar premiile sunt expediate în termen de 14 zile.",
    icon: "Trophy",
  },
];

export const HOW_IT_WORKS_ALT_PATHS: HowItWorksAltPath[] = [
  {
    title: "Participare gratuită prin poștă",
    description:
      "Preferi să nu plătești online? Trimite o participare gratuită prin poștă pentru orice concurs activ.",
    icon: "Mail",
    href: "/free-postal-entry",
  },
  {
    title: "Recomandă prietenii",
    description: "Distribuie Online Competitions și câștigă bilete gratuite când prietenii participă.",
    icon: "Users",
    href: "/dashboard/referrals",
  },
];

export const HOW_IT_WORKS_FEATURES: ContentFeature[] = [
  {
    title: "Extrageri verificate aleatoriu",
    description:
      "Fiecare câștigător este selectat folosind generare certificată de numere aleatoare.",
    icon: "Shield",
  },
  {
    title: "Plăți securizate",
    description: "Checkout criptat cu protecție antifraudă la fiecare comandă.",
    icon: "Lock",
  },
  {
    title: "Suport dedicat",
    description:
      "Echipa noastră este aici pentru a te ajuta în fiecare zi în timpul programului de lucru.",
    icon: "Headphones",
  },
];
